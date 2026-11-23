import type { Atlas } from '../domain/model'
import { lastReviews } from '../domain/practice'
import { dayOf } from '../domain/dates'

export function projection(d: Atlas) {
  const subject = (goal: string) =>
    d.goals.find((g) => g.id === goal)?.subject ?? ''
  const latest = lastReviews(d)
  return [
    ...d.tasks.map((t) => ({
      kind: t.assessment ? 'assessment' : 'task',
      id: t.id,
      name: t.name,
      subject: t.subject,
      goal: t.goal ?? '',
      due: t.date,
      done: t.done,
    })),
    ...d.goals.map((g) => ({
      kind: 'goal',
      id: g.id,
      name: g.name,
      subject: g.subject,
      done: g.done,
    })),
    ...d.activities.map((a) => ({
      kind: 'activity',
      id: a.id,
      name: a.name,
      goal: a.goal,
      subject: subject(a.goal),
    })),
    ...d.concepts.map((c) => ({
      kind: 'concept',
      id: c.id,
      name: c.name,
      subject: c.subject,
      prerequisite: c.prerequisite ?? '',
    })),
    ...d.cards.map((c) => ({
      kind: 'card',
      id: c.id,
      subject: d.decks.find((g) => g.id === c.deck)?.subject ?? '',
      concept: c.concept ?? '',
      due: latest.get(c.id)?.due ?? dayOf(),
    })),
    ...d.reviews.map((r) => ({
      kind: 'review',
      id: r.id,
      at: new Date(r.at).toISOString(),
      concept: r.concept ?? '',
      correct: r.correct,
    })),
    ...[...d.sessions, ...(d.active ? [d.active] : [])].map((s) => ({
      kind: 'start',
      id: s.id,
      subject: s.subject,
      goal: s.goal,
      at: new Date(s.startedAt).toISOString(),
    })),
    ...d.sessions.map((s) => ({
      kind: 'session',
      id: s.id,
      subject: s.subject,
      goal: s.goal,
      at: new Date(s.endedAt).toISOString(),
      duration_ms: s.elapsedMs,
    })),
    ...d.reflections.map((r) => ({
      kind: 'reflection',
      id: r.id,
      at: new Date(
        d.sessions.find((s) => s.id === r.session)!.endedAt,
      ).toISOString(),
    })),
  ]
}
