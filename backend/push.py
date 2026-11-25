import os
from urllib.parse import urlsplit
from fastapi import HTTPException
from pydantic import Field
from psycopg.types.json import Jsonb
from .contracts import Input, Preferences
from .db import connect


class Keys(Input):
    p256dh: str = Field(pattern=r"^[A-Za-z0-9_-]{86,90}={0,2}$")
    auth: str = Field(pattern=r"^[A-Za-z0-9_-]{21,24}={0,2}$")


class Subscription(Input):
    endpoint: str = Field(max_length=2048)
    keys: Keys


def register(owner, sub):
    if not os.getenv("VAPID_PRIVATE_KEY") or not os.getenv("VAPID_PUBLIC_KEY"):
        raise HTTPException(503, "Web Push não configurado.")
    url = urlsplit(sub.endpoint)
    if (
        url.scheme != "https"
        or url.username
        or url.password
        or url.netloc
        not in {
            "fcm.googleapis.com",
            "updates.push.services.mozilla.com",
            "web.push.apple.com",
        }
    ):
        raise HTTPException(422, "Serviço de push incompatível.")
    with connect() as db:
        updated = db.execute(
            "INSERT INTO push_subscription VALUES(%s,%s,%s) ON CONFLICT(endpoint) DO UPDATE SET keys=excluded.keys WHERE push_subscription.owner=excluded.owner RETURNING endpoint",
            (owner, sub.endpoint, Jsonb(sub.keys.model_dump())),
        ).fetchone()
        if not updated:
            raise HTTPException(
                409, "Este dispositivo já está inscrito em outra conta."
            )
    return {"saved": True}


def deliver_once():
    if not os.getenv("VAPID_PRIVATE_KEY"):
        return
    from pywebpush import webpush, WebPushException
    from datetime import datetime
    from zoneinfo import ZoneInfo

    with connect() as db:
        db.execute("""INSERT INTO push_delivery(endpoint,notice_id,generation)
        SELECT s.endpoint,n.id,n.created FROM push_subscription s JOIN notice n USING(owner)
        WHERE n.status='pendente' AND NOT n.seen AND n.created>now()-interval '1 day' ON CONFLICT DO NOTHING""")
        rows = db.execute("""SELECT d.*,s.keys,w.prefs FROM push_delivery d JOIN push_subscription s USING(endpoint)
        JOIN workspace w ON w.owner=s.owner JOIN notice n ON n.owner=s.owner AND n.id=d.notice_id AND n.created=d.generation
        WHERE n.status='pendente' AND NOT n.seen AND NOT delivered AND attempts<3 AND retry_at<=now()
        LIMIT 5 FOR UPDATE OF d SKIP LOCKED""").fetchall()
        for r in rows:
            p = Preferences(**r["prefs"])
            h = datetime.now(ZoneInfo(p.timezone)).hour
            if (
                not p.enabled
                or (h - p.quiet_start) % 24 < (p.quiet_end - p.quiet_start) % 24
            ):
                continue
            ok = False
            try:
                webpush(
                    subscription_info={"endpoint": r["endpoint"], "keys": r["keys"]},
                    data="Há uma atualização na central do Atlas.",
                    vapid_private_key=os.environ["VAPID_PRIVATE_KEY"],
                    vapid_claims={"sub": os.environ["VAPID_SUBJECT"]},
                    timeout=5,
                    ttl=3600,
                )
                ok = True
            except WebPushException as exc:
                if exc.response is not None and exc.response.status_code in (404, 410):
                    db.execute(
                        "DELETE FROM push_subscription WHERE endpoint=%s",
                        (r["endpoint"],),
                    )
                    continue
            db.execute(
                "UPDATE push_delivery SET attempts=attempts+1,delivered=%s,retry_at=now()+interval '15 minutes' WHERE endpoint=%s AND notice_id=%s AND generation=%s",
                (ok, r["endpoint"], r["notice_id"], r["generation"]),
            )
