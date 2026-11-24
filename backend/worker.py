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
          WHERE id=(SELECT d.id FROM document d JOIN workspace w ON d.owner=w.owner WHERE coalesce((w.prefs->>'tutor_enabled')::boolean,true) AND status IN ('pendente','processando') AND retry_at<=now()
          ORDER BY retry_at FOR UPDATE OF d SKIP LOCKED LIMIT 1) RETURNING *""").fetchone()
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


def monitor_once(now=None):
    from datetime import datetime, timezone, timedelta

    now = now or datetime.now(timezone.utc)
    with connect() as db:
        db.execute("""DELETE FROM message m USING conversation c,workspace w
            WHERE m.convo=c.id AND c.owner=w.owner AND
            m.created < now()-make_interval(days=>coalesce((w.prefs->>'retention_days')::int,90))""")
        db.execute("""DELETE FROM event e USING workspace w WHERE e.owner=w.owner
            AND e.occurred < now()-make_interval(days=>coalesce((w.prefs->>'retention_days')::int,90))""")
        for row in db.execute(
            "SELECT * FROM workspace WHERE snapshot!='{}'::jsonb AND next_check<=%s ORDER BY next_check FOR UPDATE SKIP LOCKED",
            (now,),
        ).fetchall():
            evaluate(db, row, now)
            db.execute(
                "UPDATE workspace SET next_check=%s WHERE owner=%s",
                (now + timedelta(minutes=1), row["owner"]),
            )


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
