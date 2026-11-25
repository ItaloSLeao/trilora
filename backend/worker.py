import json
import signal
import logging
import subprocess
import sys
import time
from httpx import TimeoutException
from ollama import ResponseError

from .db import connect
from .monitor import evaluate, record
from .rag import OllamaModels


class StopWorker(BaseException):
    pass


def stop_worker(_signum, _frame):
    raise StopWorker()


def indexing_error(exc, extraction_error):
    if extraction_error:
        return extraction_error
    if isinstance(exc, TimeoutException):
        return "O Ollama excedeu o tempo de espera ao gerar os embeddings."
    if isinstance(exc, ResponseError):
        if exc.status_code == 404:
            return "Modelo de embeddings indisponível no Ollama."
        return "O Ollama não conseguiu gerar os embeddings."
    if isinstance(exc, ConnectionError):
        return "O Ollama está inacessível. Verifique o serviço local."
    return "A indexação falhou. Consulte o terminal do Atlas para detalhes técnicos."


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
    extraction_error = ""
    try:
        run = subprocess.run(
            [sys.executable, "-m", "backend.ingest", job["name"]],
            input=job["content"],
            capture_output=True,
            timeout=25,
        )
        if run.returncode:
            extraction_error = run.stderr.decode(errors="replace").strip()[:160]
            raise ValueError(extraction_error)
        parts = json.loads(run.stdout)
        vectors = []
        for i in range(0, len(parts), 4):
            with connect() as db:
                lease = db.execute(
                    """UPDATE document SET retry_at=now()+interval '20 minutes'
                    WHERE id=%s AND attempts=%s AND status='processando' RETURNING id""",
                    (job["id"], job["attempts"]),
                ).fetchone()
            if not lease:
                return True
            vectors.extend(provider.embed([p["body"] for p in parts[i : i + 4]]))
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
    except StopWorker:
        with connect() as db:
            db.execute(
                """UPDATE document SET status='pendente',attempts=attempts-1,retry_at=now(),error=''
                WHERE id=%s AND attempts=%s AND status='processando'""",
                (job["id"], job["attempts"]),
            )
        raise
    except Exception as exc:
        error = indexing_error(exc, extraction_error)
        logging.warning(
            json.dumps(
                {
                    "job": "index",
                    "error": type(exc).__name__,
                    "attempt": job["attempts"],
                }
            )
        )
        with connect() as db:
            db.execute(
                "UPDATE document SET status=%s,error=%s,retry_at=now()+interval '1 minute' WHERE id=%s AND attempts=%s",
                (
                    "falhou"
                    if job["attempts"] >= 3
                    or isinstance(exc, ValueError)
                    or (isinstance(exc, ResponseError) and exc.status_code == 404)
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


def run_worker(mode):
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


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    signal.signal(signal.SIGTERM, stop_worker)
    try:
        run_worker(sys.argv[1])
    except (StopWorker, KeyboardInterrupt):
        pass
