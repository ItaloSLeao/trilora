import json
import logging
import subprocess
import sys
import time
from .db import connect
from .monitor import evaluate, record
from .rag import OllamaModels


def index_once(provider):
    with connect() as db:
        db.execute(
            "UPDATE document SET status='falhou',error='Processamento interrompido. Reprocesse o arquivo.' WHERE status='processando' AND attempts>=3 AND retry_at<=now()"
        )
        job = db.execute("""UPDATE document SET status='processando',attempts=attempts+1,retry_at=now()+interval '20 minutes'
          WHERE id=(SELECT id FROM document WHERE status IN ('pendente','processando') AND retry_at<=now()
          ORDER BY retry_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *""").fetchone()
    if not job:
        return False
    try:
        run = subprocess.run(
            [sys.executable, "-m", "backend.ingest", job["name"]],
            input=job["content"],
            capture_output=True,
            timeout=25,
        )
        if run.returncode:
            raise ValueError(run.stderr.decode()[:160])
        parts = json.loads(run.stdout)
        vectors = []
        for i in range(0, len(parts), 16):
            vectors.extend(provider.embed([p["body"] for p in parts[i : i + 16]]))
        with connect() as db:
            valid = db.execute(
                "SELECT id FROM document WHERE id=%s AND attempts=%s AND status='processando' FOR UPDATE",
                (job["id"], job["attempts"]),
            ).fetchone()
            if not valid:
                return True
            db.execute("DELETE FROM chunk WHERE doc=%s", (job["id"],))
            with db.cursor() as cursor:
                cursor.executemany(
                    "INSERT INTO chunk(doc,ordinal,page,body,embedding) VALUES(%s,%s,%s,%s,%s::vector)",
                    [
                        (job["id"], i + 1, p["page"], p["body"], str(v))
                        for i, (p, v) in enumerate(zip(parts, vectors, strict=True))
                    ],
                )
            db.execute(
                "UPDATE document SET status='pronto',error='',model=%s WHERE id=%s",
                (provider.embedding_model, job["id"]),
            )
            record(
                db,
                job["owner"],
                "document_indexed",
                str(job["id"]),
                {"document": str(job["id"])},
            )
    except Exception as exc:
        error = (
            str(exc)[:160]
            if isinstance(exc, ValueError) and "run" in locals() and run.returncode
            else "Indexação indisponível. Confira o modelo configurado."
        )
        with connect() as db:
            db.execute(
                "UPDATE document SET status=%s,error=%s,retry_at=now()+interval '1 minute' WHERE id=%s AND attempts=%s",
                (
                    "falhou"
                    if job["attempts"] >= 3 or isinstance(exc, ValueError)
                    else "pendente",
                    error,
                    job["id"],
                    job["attempts"],
                ),
            )
    return True


def monitor_once():
    with connect() as db:
        for row in db.execute(
            "SELECT * FROM workspace WHERE snapshot!='{}'::jsonb FOR UPDATE SKIP LOCKED"
        ).fetchall():
            evaluate(db, row)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    mode = sys.argv[1]
    while True:
        try:
            if mode == "monitor":
                monitor_once()
                from .push import deliver_once

                deliver_once()
            elif index_once(OllamaModels()):
                continue
        except Exception as exc:
            logging.error(json.dumps({"job": mode, "error": type(exc).__name__}))
        time.sleep(60 if mode == "monitor" else 3)
