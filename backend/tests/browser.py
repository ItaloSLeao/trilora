"""Roteiro optativo de navegador contra PostgreSQL descartável."""

import os
import secrets
import subprocess
import threading
import time
from pathlib import Path
from tempfile import TemporaryDirectory
import uvicorn
from .doubles import TestModels
from ..db import create_user, migrate, connect
from ..api import app
from ..rag import OllamaModels
from ..worker import index_once


def pdf_fixture():
    text = b"BT /F1 12 Tf 10 150 Td (A clorofila absorve luz.) Tj ET"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length "
        + str(len(text)).encode()
        + b" >>\nstream\n"
        + text
        + b"\nendstream",
    ]
    result = b"%PDF-1.4\n"
    offsets = [0]
    for i, obj in enumerate(objects, 1):
        offsets.append(len(result))
        result += f"{i} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref = len(result)
    return (
        result
        + b"xref\n0 6\n0000000000 65535 f \n"
        + b"".join(f"{n:010d} 00000 n \n".encode() for n in offsets[1:])
        + f"trailer << /Size 6 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode()
    )


def main():
    os.environ["DATABASE_URL"] = os.environ["ATLAS_TEST_DATABASE_URL"]
    migrate()
    login = "browser-" + secrets.token_hex(8)
    password = secrets.token_urlsafe(18)
    user = create_user(login, password)
    app.dependency_overrides[OllamaModels] = TestModels
    server = uvicorn.Server(
        uvicorn.Config(app, host="127.0.0.1", port=8001, access_log=False)
    )
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    stop = threading.Event()

    def work():
        while not stop.wait(0.4):
            index_once(TestModels())

    jobs = threading.Thread(target=work, daemon=True)
    try:
        for _ in range(50):
            if server.started:
                break
            if not thread.is_alive():
                raise RuntimeError("Porta 8001 indisponível.")
            time.sleep(0.1)
        if not server.started:
            raise RuntimeError("API indisponível.")
        jobs.start()
        with TemporaryDirectory() as temp:
            pdf = Path(temp) / "botanica.pdf"
            pdf.write_bytes(pdf_fixture())
            subprocess.run(
                ["npm", "--prefix", "atlas", "run", "test:e2e"],
                check=True,
                env={
                    **os.environ,
                    "ATLAS_QA_LOGIN": login,
                    "ATLAS_QA_PASSWORD": password,
                    "ATLAS_QA_PDF": str(pdf),
                },
            )
    finally:
        stop.set()
        server.should_exit = True
        thread.join(5)
        with connect() as db:
            db.execute("DELETE FROM account WHERE id=%s", (user,))


if __name__ == "__main__":
    main()
