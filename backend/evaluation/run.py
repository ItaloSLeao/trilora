"""Execute somente contra um banco descartável, com Ollama local."""

import json
import os
import secrets
import sys
import time
from pathlib import Path
from fastapi.testclient import TestClient
from backend.api import app
from backend.db import migrate, create_user
from backend.worker import index_once
from backend.rag import OllamaModels
from .score import CASES, evaluate


def run(output):
    os.environ["DATABASE_URL"] = os.environ["ATLAS_TEST_DATABASE_URL"]
    migrate()
    name = "avaliacao-" + secrets.token_hex(6)
    password = secrets.token_urlsafe(18)
    create_user(name, password)
    client = TestClient(app, headers={"x-atlas-action": "1"})
    client.auth = (name, password)
    docs = {}
    records = []
    try:
        for path in sorted(CASES.with_name("corpus").iterdir()):
            response = client.post(
                "/api/documents",
                params={"name": path.name, "subject": "avaliacao"},
                content=path.read_bytes(),
            )
            response.raise_for_status()
            docs[path.name] = response.json()["id"]
            index_once(OllamaModels())
        for case in json.loads(CASES.read_text()):
            thread = client.post(
                "/api/conversations",
                json={
                    "subject": "avaliacao",
                    "docs": [docs[n] for n in case["selected"]],
                },
            )
            thread.raise_for_status()
            start = time.monotonic()
            result = client.post(
                "/api/conversations/" + thread.json()["id"] + "/messages",
                json={"question": case["question"]},
            )
            result.raise_for_status()
            answer = result.json()
            records.append(
                {
                    "id": case["id"],
                    "answer": answer["answer"],
                    "cited": [s["name"] for s in answer["sources"]],
                    "retrieved": answer["retrieved"],
                    "abstained": not answer["citations"],
                    "latency_ms": round((time.monotonic() - start) * 1000),
                    "tokens": answer["tokens"],
                }
            )
            output.write_text(json.dumps(records, ensure_ascii=False, indent=2))
        print(json.dumps(evaluate(records, 2), ensure_ascii=False, indent=2))
    finally:
        client.delete("/api/account")


if __name__ == "__main__":
    run(Path(sys.argv[1]))
