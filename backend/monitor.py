from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from zoneinfo import ZoneInfo
import json
import os

from psycopg.types.json import Jsonb
from .contracts import Fact, Preferences

EVENTS = {
    "task": "task_created",
    "assessment": "assessment_scheduled",
    "goal": "learning_objective_created",
    "activity": "activity_planned",
    "session": "study_session_completed",
    "start": "study_session_started",
    "review": "review_completed",
    "reflection": "reflection_submitted",
    "concept": "concept_registered",
    "card": "card_scheduled",
}


def event_id(kind, key):
    return sha256(json.dumps([kind, key]).encode()).hexdigest()


def record(db, owner, kind, key, info, at=None):
    db.execute(
        "INSERT INTO event VALUES(%s,%s,%s,COALESCE(%s,now()),%s) ON CONFLICT DO NOTHING",
        (owner, event_id(kind, key), kind, at, Jsonb(info)),
    )


def synchronize(db, owner, old, facts):
    before = {(f["kind"], f["id"]): f for f in old}
    for f in facts:
        previous = before.get((f.kind, f.id))
        info = {"subject": f.subject, "concept": f.concept, "entity": f.id}
        if not previous:
            record(db, owner, EVENTS[f.kind], f.id, info, f.at)
            if f.kind == "review" and f.concept:
                record(
                    db,
                    owner,
                    "concept_practiced",
                    f.id,
                    {**info, "correct": f.correct},
                    f.at,
                )
            if f.kind == "session":
                record(db, owner, "learning_activity_completed", f.id, info, f.at)
        if f.done and f.kind in ("goal", "task") and not (previous or {}).get("done"):
            record(
                db,
                owner,
                "learning_objective_completed"
                if f.kind == "goal"
                else "task_completed",
                f.id,
                info,
            )


def analyze(facts, pref, today):
    notices = []
    attempts = defaultdict(list)
    due = defaultdict(list)
    deadlines = defaultdict(list)
    concepts = {f.id: f for f in facts if f.kind == "concept"}

    def add(code, entity, category, priority, reason, evidence, action):
        notices.append(
            dict(
                id=event_id(code, entity.id),
                category=category,
                priority=priority,
                reason=reason,
                subject=entity.subject,
                concept=entity.concept
                or (entity.id if entity.kind == "concept" else ""),
                evidence=[event_id(EVENTS[e.kind], e.id) for e in evidence],
                action=action,
                rule=code,
            )
        )

    for f in facts:
        if f.kind == "review" and f.correct is not None:
            attempts[f.concept].append(f)
        if f.kind == "card" and f.due and f.due <= today:
            due[f.concept].append(f)
        if (
            f.kind in ("assessment", "task")
            and not f.done
            and f.due
            and (f.due - today).days <= pref.horizon
        ):
            deadlines[f.due].append(f)
            late = f.due < today
            add(
                "prazo",
                f,
                "prazos",
                90 if late else 70,
                f"{f.name} · prazo {'vencido' if late else 'previsto'} em {f.due}.",
                [f],
                "agenda",
            )
        if f.kind == "goal":
            activities = [a for a in facts if a.kind == "activity" and a.goal == f.id]
            if f.done:
                add(
                    "objetivo-concluido",
                    f,
                    "progresso",
                    20,
                    f"Você marcou {f.name} como concluído.",
                    [f],
                    "progresso",
                )
            elif not activities:
                add(
                    "objetivo-sem-atividade",
                    f,
                    "planejamento",
                    40,
                    f"O objetivo {f.name} ainda não tem atividade.",
                    [f],
                    "conhecimentos/activities",
                )
    for day, items in deadlines.items():
        if len(items) > pref.daily_capacity:
            add(
                "concentracao",
                items[0],
                "planejamento",
                80,
                f"{len(items)} prazos em {day} superam sua capacidade de {pref.daily_capacity} atividades.",
                items,
                "agenda",
            )
    for key, c in concepts.items():
        recent = sorted(attempts[key], key=lambda f: str(f.at))[-max(5, pref.errors) :]
        misses = [f for f in recent if not f.correct]
        tests = [
            f
            for items in deadlines.values()
            for f in items
            if f.kind == "assessment" and f.subject == c.subject
        ]
        pending = due[key]
        if (
            len(misses) >= pref.errors and recent and not recent[-1].correct
        ) or pending:
            reason = f"{c.name}: {len(misses)} erro(s) nas últimas {len(recent)} tentativas e {len(pending)} cartão(ões) pendentes."
            if tests:
                reason += " Há avaliação próxima na disciplina."
            if c.prerequisite in concepts and not attempts[c.prerequisite]:
                reason += (
                    " Retome o pré-requisito "
                    + concepts[c.prerequisite].name
                    + ", sem prática registrada."
                )
            add(
                "pratica",
                c,
                "prática",
                50
                + min(20, len(misses) * int(os.getenv("ADAPT_ERROR_WEIGHT", "5")))
                + (int(os.getenv("ADAPT_EXAM_WEIGHT", "25")) if tests else 0),
                reason,
                recent + pending + tests,
                "tutor",
            )
        elif len(recent) >= 3 and all(f.correct for f in recent[-3:]):
            add(
                "aprofundamento",
                c,
                "progresso",
                30,
                f"Três acertos recentes em {c.name}. Experimente outra aplicação.",
                recent[-3:],
                "tutor",
            )
    return sorted(notices, key=lambda n: (-n["priority"], n["id"]))


def evaluate(db, row, now=None):
    now = now or datetime.now(timezone.utc)
    prefs = Preferences(**row["prefs"])
    clock = now.astimezone(ZoneInfo(prefs.timezone))
    facts = [Fact(**f) for f in row["snapshot"].get("facts", [])]
    owner = row["owner"]
    cutoff = now - timedelta(days=prefs.retention_days)
    retained = [f for f in facts if not f.at or f.at >= cutoff]
    if len(retained) != len(facts):
        db.execute(
            "UPDATE workspace SET snapshot=%s WHERE owner=%s",
            (Jsonb({"facts": [f.model_dump(mode="json") for f in retained]}), owner),
        )
        facts = retained
    generated = analyze(facts, prefs, clock.date()) if prefs.enabled else []
    active_ids = []
    for n in generated:
        if n["category"] not in prefs.categories:
            continue
        active_ids.append(n["id"])
        if n["rule"] == "prazo":
            f = next(f for f in facts if event_id("prazo", f.id) == n["id"])
            if f.due < clock.date():
                record(db, owner, "task_overdue", f.id, {"entity": f.id})
        quiet = (clock.hour - prefs.quiet_start) % 24 < (
            prefs.quiet_end - prefs.quiet_start
        ) % 24
        if quiet:
            continue
        db.execute(
            """INSERT INTO notice(owner,id,details) VALUES(%s,%s,%s) ON CONFLICT(owner,id) DO UPDATE
        SET details=excluded.details,status=CASE WHEN notice.status='expirada' THEN 'pendente' ELSE notice.status END,
        seen=CASE WHEN notice.status='expirada' THEN false ELSE notice.seen END,
        created=CASE WHEN notice.status='expirada' THEN now() ELSE notice.created END
        WHERE notice.status!='expirada' OR notice.created < now()-make_interval(hours=>%s)""",
            (owner, n["id"], Jsonb(n), prefs.frequency_hours),
        )
    db.execute(
        "UPDATE notice SET status='expirada' WHERE owner=%s AND status IN ('pendente','aceita') AND NOT(id=ANY(%s::text[]))",
        (owner, active_ids),
    )
    week = clock.date() - timedelta(days=clock.weekday())
    recent = [
        f
        for f in facts
        if f.at and week <= f.at.astimezone(clock.tzinfo).date() <= clock.date()
    ]
    counts = Counter(f.kind for f in recent)
    summary = dict(
        sessions=counts["session"],
        reviews=counts["review"],
        correct=sum(f.correct is True for f in recent if f.kind == "review"),
        goals=sorted({f.goal for f in recent if f.goal}),
        future=[
            f.name
            for f in facts
            if f.kind in ("task", "assessment")
            and not f.done
            and f.due
            and clock.date() <= f.due <= clock.date() + timedelta(days=7)
        ],
        next=[n["reason"] for n in generated[:3]],
    )
    db.execute(
        "INSERT INTO report VALUES(%s,%s,%s) ON CONFLICT(owner,week) DO UPDATE SET details=excluded.details",
        (owner, week, Jsonb(summary)),
    )
    for table, column in [
        ("event", "occurred"),
        ("notice", "created"),
        ("report", "week"),
        ("message", "created"),
    ]:
        if table == "message":
            db.execute(
                "DELETE FROM message WHERE convo IN (SELECT id FROM conversation WHERE owner=%s) AND created < now()-make_interval(days=>%s)",
                (owner, prefs.retention_days),
            )
        else:
            db.execute(
                f"DELETE FROM {table} WHERE owner=%s AND {column}<now()-make_interval(days=>%s)",
                (owner, prefs.retention_days),
            )
