import argparse
import getpass
import hashlib
import os
from pathlib import Path

import bcrypt
import psycopg
from psycopg.rows import dict_row


def connect():
    return psycopg.connect(
        os.environ["DATABASE_URL"], row_factory=dict_row, connect_timeout=5
    )


def password_bytes(password):
    return hashlib.sha256(password.encode()).hexdigest().encode()


def migrate():
    with connect() as db:
        db.execute("SELECT pg_advisory_xact_lock(190824)")
        db.execute(
            "CREATE TABLE IF NOT EXISTS atlas_migration(version text PRIMARY KEY)"
        )
        for path in sorted(Path(__file__).with_name("migrations").glob("*.sql")):
            if not db.execute(
                "SELECT 1 FROM atlas_migration WHERE version=%s", (path.name,)
            ).fetchone():
                db.execute(path.read_text())
                db.execute("INSERT INTO atlas_migration VALUES(%s)", (path.name,))


def create_user(login, password):
    if len(password) < 12 or not 1 <= len(login) <= 100:
        raise ValueError("Use login de até 100 caracteres e senha de pelo menos 12.")
    digest = bcrypt.hashpw(password_bytes(password), bcrypt.gensalt())
    with connect() as db:
        row = db.execute(
            "INSERT INTO account(login,secret) VALUES(%s,%s) RETURNING id",
            (login, digest),
        ).fetchone()
        db.execute("INSERT INTO workspace(owner) VALUES(%s)", (row["id"],))
        return row["id"]


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["migrate", "user"])
    parser.add_argument("login", nargs="?")
    args = parser.parse_args()
    if args.command == "migrate":
        migrate()
    elif args.login:
        create_user(args.login, getpass.getpass())
    else:
        parser.error("Informe o login.")
