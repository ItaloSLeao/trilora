import hashlib
import logging
import time
from collections import defaultdict, deque
from threading import Lock
from uuid import UUID

import bcrypt
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from psycopg.types.json import Jsonb
from starlette.concurrency import run_in_threadpool
from .contracts import Decision, Preferences, Question, Snapshot, Thread
from .db import connect, password_bytes
from .ingest import LIMIT, check, filename
from .monitor import evaluate, synchronize
from .rag import OllamaModels, respond

app = FastAPI(title="Trilora Intelligence", version="1.0")
security = HTTPBasic()
failures = defaultdict(deque)
lock = Lock()
dummy = bcrypt.hashpw(b"unknown", bcrypt.gensalt())


def identity(request: Request, credentials: HTTPBasicCredentials = Depends(security)):
    ip = request.client.host if request.client else "local"
    now = time.monotonic()
    with lock:
        attempts = failures[ip]
        while attempts and attempts[0] < now - 60:
            attempts.popleft()
        if len(attempts) >= 12:
            raise HTTPException(429, "Aguarde um minuto.")
        attempts.append(now)
    with connect() as db:
        row = db.execute(
            "SELECT id,secret FROM account WHERE login=%s", (credentials.username,)
        ).fetchone()
    if (
        not bcrypt.checkpw(
            password_bytes(credentials.password), row["secret"] if row else dummy
        )
        or not row
    ):
        raise HTTPException(401, "Credenciais inválidas.")
    with lock:
        if now in attempts:
            attempts.remove(now)
    return row["id"]


User = Depends(identity)


def found(row):
    if not row:
        raise HTTPException(404, "Registro indisponível.")
    return row


@app.middleware("http")
async def guard(request, call_next):
    from fastapi.responses import JSONResponse

    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        if request.headers.get("x-atlas-action") != "1":
            return JSONResponse({"detail": "Ação não autorizada."}, 403)
        size = request.headers.get(
            "content-length", "0" if "transfer-encoding" not in request.headers else ""
        )
        if not size.isdigit() or int(size) > LIMIT:
            return JSONResponse({"detail": "Corpo ausente ou muito extenso."}, 413)
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.get("/api/health")
def health():
    with connect() as db:
        db.execute("SELECT version FROM atlas_migration LIMIT 1")
    return {"status": "ok"}


@app.get("/api/state")
def state(owner=User):
    with connect() as db:
        row = db.execute(
            "SELECT revision,prefs FROM workspace WHERE owner=%s", (owner,)
        ).fetchone()
        return {
            **row,
            "prefs": Preferences(**row["prefs"]),
            "tokens": db.execute(
                "SELECT coalesce(sum(tokens),0) AS n FROM usage WHERE owner=%s",
                (owner,),
            ).fetchone()["n"],
        }


@app.put("/api/projection")
def sync(body: Snapshot, owner=User):
    with connect() as db:
        row = db.execute(
            "SELECT * FROM workspace WHERE owner=%s FOR UPDATE", (owner,)
        ).fetchone()
        if row["revision"] != body.revision:
            raise HTTPException(
                409,
                "Projeção alterada. Reabra a central e confira antes de sincronizar.",
            )
        synchronize(db, owner, row["snapshot"].get("facts", []), body.facts)
        row = db.execute(
            "UPDATE workspace SET snapshot=%s,revision=revision+1 WHERE owner=%s RETURNING *",
            (Jsonb({"facts": [f.model_dump(mode="json") for f in body.facts]}), owner),
        ).fetchone()
        evaluate(db, row)
        return {"revision": row["revision"]}


@app.put("/api/preferences")
def preferences(body: Preferences, owner=User):
    with connect() as db:
        row = db.execute(
            "UPDATE workspace SET prefs=%s WHERE owner=%s RETURNING *",
            (Jsonb(body.model_dump()), owner),
        ).fetchone()
        evaluate(db, row)
    return {"saved": True}


def page_rows(table, fields, order, owner, offset):
    with connect() as db:
        return db.execute(
            f"SELECT {fields} FROM {table} WHERE owner=%s ORDER BY {order} LIMIT 100 OFFSET %s",
            (owner, offset),
        ).fetchall()


@app.get("/api/events")
def events(offset: int = Query(0, ge=0), owner=User):
    return page_rows("event", "*", "occurred DESC,id", owner, offset)


@app.get("/api/notices")
def notices(offset: int = Query(0, ge=0), owner=User):
    return page_rows(
        "notice",
        "*",
        "(status='pendente') DESC,(details->>'priority')::int DESC,created DESC,id",
        owner,
        offset,
    )


@app.get("/api/reports")
def reports(offset: int = Query(0, ge=0), owner=User):
    return page_rows("report", "week,details", "week DESC", owner, offset)


@app.patch("/api/notices/{key}")
def decide(key: str, body: Decision, owner=User):
    with connect() as db:
        return found(
            db.execute(
                """UPDATE notice SET seen=true,status=CASE WHEN %s='lida' THEN status ELSE %s END WHERE id=%s AND owner=%s RETURNING status""",
                (body.status, body.status, key, owner),
            ).fetchone()
        )


@app.get("/api/documents")
def documents(offset: int = Query(0, ge=0), owner=User):
    return page_rows(
        "document", "id,name,subject,concept,status,error", "name,id", owner, offset
    )


@app.post("/api/documents", status_code=201)
async def upload(
    request: Request,
    name: str = Query(max_length=200),
    subject: str = Query(min_length=1, max_length=128),
    concept: str = Query("", max_length=128),
    owner=User,
):
    name = filename(name)
    blob = await request.body()

    def store():
        try:
            check(name, blob)
        except ValueError as exc:
            raise HTTPException(422, str(exc))
        with connect() as db:
            db.execute("SELECT id FROM account WHERE id=%s FOR UPDATE", (owner,))
            if (
                db.execute(
                    "SELECT count(*) AS n FROM document WHERE owner=%s", (owner,)
                ).fetchone()["n"]
                >= 100
            ):
                raise HTTPException(429, "Limite de 100 documentos.")
            return db.execute(
                """INSERT INTO document(owner,subject,concept,name,digest,content) VALUES(%s,%s,%s,%s,%s,%s)
                ON CONFLICT(owner,subject,concept,digest) DO UPDATE SET digest=excluded.digest RETURNING id,status""",
                (owner, subject, concept, name, hashlib.sha256(blob).hexdigest(), blob),
            ).fetchone()

    return await run_in_threadpool(store)


@app.post("/api/documents/{key}/retry")
def retry(key: UUID, owner=User):
    with connect() as db:
        return found(
            db.execute(
                "UPDATE document SET attempts=0,status='pendente',retry_at=now(),error='' WHERE id=%s AND owner=%s AND status='falhou' RETURNING id",
                (key, owner),
            ).fetchone()
        )


@app.get("/api/documents/{key}/source/{ordinal}")
def source(key: UUID, ordinal: int, owner=User):
    with connect() as db:
        return found(
            db.execute(
                "SELECT name,page,ordinal,body FROM chunk JOIN document ON doc=document.id WHERE document.id=%s AND owner=%s AND ordinal=%s",
                (key, owner, ordinal),
            ).fetchone()
        )


@app.get("/api/documents/{key}/file")
def document_file(key: UUID, owner=User):
    with connect() as db:
        row = found(
            db.execute(
                "SELECT name,content FROM document WHERE owner=%s AND id=%s",
                (owner, key),
            ).fetchone()
        )
    return Response(row["content"], media_type="application/octet-stream")


@app.delete("/api/documents/{key}")
def remove_doc(key: UUID, owner=User):
    with connect() as db:
        found(
            db.execute(
                "DELETE FROM document WHERE owner=%s AND id=%s RETURNING id",
                (owner, key),
            ).fetchone()
        )
        db.execute(
            "DELETE FROM conversation WHERE owner=%s AND %s=ANY(docs)", (owner, key)
        )
    return {"deleted": True}


@app.post("/api/conversations")
def create_conversation(body: Thread, owner=User):
    with connect() as db:
        rows = db.execute(
            "SELECT id FROM document WHERE id=ANY(%s) AND owner=%s AND subject=%s AND (concept='' OR %s='' OR concept=%s) AND status='pronto' FOR SHARE",
            (body.docs, owner, body.subject, body.concept, body.concept),
        ).fetchall()
        if {r["id"] for r in rows} != set(body.docs):
            raise HTTPException(422, "Seleção de documentos indisponível.")
        return db.execute(
            "INSERT INTO conversation(owner,subject,concept,docs) VALUES(%s,%s,%s,%s) RETURNING id",
            (owner, body.subject, body.concept, body.docs),
        ).fetchone()


@app.get("/api/conversations")
def conversations(offset: int = Query(0, ge=0), owner=User):
    return page_rows(
        "conversation",
        "id,subject,concept,docs,created",
        "created DESC,id",
        owner,
        offset,
    )


@app.delete("/api/conversations/{key}")
def forget(key: UUID, owner=User):
    with connect() as db:
        return found(
            db.execute(
                "DELETE FROM conversation WHERE id=%s AND owner=%s RETURNING id",
                (key, owner),
            ).fetchone()
        )


@app.get("/api/conversations/{key}/messages")
def messages(key: UUID, offset: int = Query(0, ge=0), owner=User):
    with connect() as db:
        found(
            db.execute(
                "SELECT id FROM conversation WHERE id=%s AND owner=%s", (key, owner)
            ).fetchone()
        )
        return db.execute(
            "SELECT question,result,id FROM message WHERE convo=%s ORDER BY id DESC LIMIT 50 OFFSET %s",
            (key, offset),
        ).fetchall()[::-1]


@app.post("/api/conversations/{key}/messages")
def ask(key: UUID, body: Question, owner=User, provider=Depends(OllamaModels)):
    with connect() as db:
        found(
            db.execute(
                "SELECT id FROM conversation WHERE id=%s AND owner=%s", (key, owner)
            ).fetchone()
        )
        pref = db.execute(
            "SELECT prefs FROM workspace WHERE owner=%s", (owner,)
        ).fetchone()
        if not Preferences(**pref["prefs"]).tutor_enabled:
            raise HTTPException(403, "O tutor está desativado nas preferências.")
        usage = db.execute(
            """INSERT INTO usage VALUES(%s,date_trunc('hour',now()),1,0) ON CONFLICT(owner,bucket) DO UPDATE SET requests=usage.requests+1
        WHERE usage.requests<30 RETURNING bucket""",
            (owner,),
        ).fetchone()
        if not usage:
            raise HTTPException(429, "Limite de 30 consultas por hora.")
    with connect() as db:
        thread = found(
            db.execute(
                "SELECT * FROM conversation WHERE id=%s AND owner=%s FOR UPDATE",
                (key, owner),
            ).fetchone()
        )
        try:
            answer = respond(db, owner, thread, body, provider)
        except Exception as exc:
            logging.warning('{"event":"model_error","type":"%s"}', type(exc).__name__)
            raise HTTPException(
                503,
                "Inferência indisponível ou resposta inválida. Confira os modelos e tente novamente.",
            )
        db.execute(
            "INSERT INTO message(convo,question,result) VALUES(%s,%s,%s)",
            (key, body.question, Jsonb(answer)),
        )
        db.execute(
            "UPDATE usage SET tokens=tokens+%s WHERE owner=%s AND bucket=%s",
            (answer["tokens"], owner, usage["bucket"]),
        )
        return answer


@app.delete("/api/account")
def erase(owner=User):
    with connect() as db:
        db.execute("DELETE FROM account WHERE id=%s", (owner,))
    return Response(status_code=204)


from .push import Subscription, register
import os


@app.get("/api/push")
def push_config(owner=User):
    return {
        "key": os.getenv("VAPID_PUBLIC_KEY", "")
        if os.getenv("VAPID_PRIVATE_KEY")
        else ""
    }


@app.post("/api/push")
def subscribe(body: Subscription, owner=User):
    return register(owner, body)


@app.delete("/api/push")
def unsubscribe(owner=User):
    with connect() as db:
        db.execute("DELETE FROM push_subscription WHERE owner=%s", (owner,))
    return {"saved": True}


@app.post("/api/conversations/{key}/stream")
async def stream_answer(
    key: UUID, body: Question, owner=User, provider=Depends(OllamaModels)
):
    import asyncio
    import json
    import re
    from threading import Event
    from fastapi.responses import StreamingResponse

    loop = asyncio.get_running_loop()
    updates = asyncio.Queue(maxsize=8)
    stopped = Event()

    def append(item):
        if updates.full():
            updates.get_nowait()
        updates.put_nowait(item)

    def fragment(raw):
        if stopped.is_set():
            raise InterruptedError()
        match = re.search(r'"answer"\s*:\s*"((?:\\.|[^"\\])*)', raw)
        if match:
            try:
                partial = json.loads('"' + match.group(1) + '"')
            except ValueError:
                return
            loop.call_soon_threadsafe(append, {"draft": partial})

    def work():
        if isinstance(provider, OllamaModels):
            provider.on_fragment = fragment
        try:
            ask(key, body, owner, provider)
            loop.call_soon_threadsafe(append, {"done": True})
        except HTTPException as exc:
            loop.call_soon_threadsafe(append, {"error": exc.detail})
        except Exception:
            loop.call_soon_threadsafe(
                append, {"error": "Conexão do tutor interrompida."}
            )

    async def lines():
        task = asyncio.create_task(asyncio.to_thread(work))
        try:
            while True:
                msg = await updates.get()
                yield json.dumps(msg, ensure_ascii=False) + "\n"
                if "done" in msg or "error" in msg:
                    break
        finally:
            stopped.set()
            if task.done():
                task.result()

    return StreamingResponse(
        lines(), media_type="application/x-ndjson", headers={"X-Accel-Buffering": "no"}
    )


@app.get("/api/activities")
def generated_activities(offset: int = Query(0, ge=0), owner=User):
    with connect() as db:
        return db.execute(
            """SELECT m.id,m.convo,c.concept,c.subject,m.created,m.result->>'question' AS question,
            m.result->>'expected' AS criterion,m.result->'sources' AS sources
            FROM message m JOIN conversation c ON m.convo=c.id WHERE c.owner=%s AND coalesce(m.result->>'question','')!=''
            ORDER BY m.id DESC LIMIT 50 OFFSET %s""",
            (owner, offset),
        ).fetchall()


@app.get("/api/progress")
def observed_progress(offset: int = Query(0, ge=0), owner=User):
    from collections import defaultdict

    with connect() as db:
        row = db.execute(
            "SELECT snapshot FROM workspace WHERE owner=%s", (owner,)
        ).fetchone()
    facts = row["snapshot"].get("facts", [])
    attempts = defaultdict(list)
    for f in facts:
        if f["kind"] == "review" and f.get("concept"):
            attempts[f["concept"]].append(f)
    result = []
    for c in sorted(
        (f for f in facts if f["kind"] == "concept"), key=lambda f: f["id"]
    )[offset : offset + 100]:
        history = sorted(attempts[c["id"]], key=lambda r: r.get("at") or "")
        result.append(
            {
                "concept": c["id"],
                "name": c["name"],
                "prerequisite": c["prerequisite"],
                "attempts": len(history),
                "correct": sum(r["correct"] is True for r in history),
                "last_practice": history[-1]["at"] if history else None,
            }
        )
    return result
