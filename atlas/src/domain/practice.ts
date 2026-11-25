import { dayOf, shiftDay } from './dates'
import { requireRule, type Atlas, type Active, type Reflection } from './model'

export const intervals = [1, 2, 4, 7, 14] as const
export function lastReviews(d: Atlas) {
  return new Map(d.reviews.map((r) => [r.card, r]))
}
export function dueCards(d: Atlas, day: string, deck?: string) {
  const latest = lastReviews(d)
  return d.cards.filter(
    (c) => (!deck || c.deck === deck) && (latest.get(c.id)?.due ?? day) <= day,
  )
}
export function rate(
  d: Atlas,
  cardId: string,
  round: string,
  revealed: boolean,
  correct: boolean,
  at: number,
) {
  requireRule(revealed, 'Revele a resposta antes de avaliar.')
  const card = d.cards.find((c) => c.id === cardId)
  requireRule(card, 'Cartão indisponível.')
  if (d.reviews.some((r) => r.card === cardId && r.round === round)) return d
  const previous = lastReviews(d).get(cardId)
  requireRule(
    !previous || previous.due <= dayOf(at),
    'A próxima revisão deste cartão ainda não venceu.',
  )
  const stage = correct ? Math.min(4, (previous?.stage ?? 0) + 1) : 0
  const due = shiftDay(dayOf(at), intervals[stage]!)
  const review = {
    id: crypto.randomUUID(),
    card: cardId,
    concept: card.concept,
    question: card.question,
    round,
    correct,
    at,
    day: dayOf(at),
    stage,
    due,
  }
  return { ...d, reviews: [...d.reviews, review] }
}
export function startStudy(
  d: Atlas,
  plan: Pick<Active, 'id' | 'subject' | 'goal' | 'activity' | 'timed'>,
  at: number,
): Atlas {
  requireRule(!d.active, 'Já existe uma sessão em andamento.')
  requireRule(
    d.goals.some(
      (g) => g.id === plan.goal && !g.done && g.subject === plan.subject,
    ) &&
      d.activities.some((a) => a.id === plan.activity && a.goal === plan.goal),
    'Selecione uma atividade de um objetivo em andamento.',
  )
  return {
    ...d,
    active: { ...plan, startedAt: at, elapsedMs: 0, phase: 'practice' },
  }
}
export interface Anchor {
  base: number
  start: number
}
export function measured(anchor: Anchor, now: number) {
  return anchor.base + Math.max(0, Math.floor(now - anchor.start))
}
export function updateActive(
  d: Atlas,
  id: string,
  elapsedMs: number,
  phase: Active['phase'] = 'practice',
): Atlas {
  requireRule(
    d.active?.id === id && d.active.phase === 'practice',
    'Sessão modificada. Confira o estado atual.',
  )
  return {
    ...d,
    active: {
      ...d.active,
      elapsedMs: Math.max(d.active.elapsedMs, elapsedMs),
      phase,
    },
  }
}
export function finishStudy(
  d: Atlas,
  id: string,
  reflection: Omit<Reflection, 'id' | 'session'>,
  at: number,
): Atlas {
  if (d.sessions.some((s) => s.id === id)) return d
  requireRule(
    d.active?.id === id && d.active.phase === 'reflect',
    'Conclua a prática antes de registrar o resultado.',
  )
  const { phase: _phase, ...plan } = d.active
  return {
    ...d,
    active: null,
    sessions: [
      ...d.sessions,
      { ...plan, endedAt: Math.max(at, plan.startedAt) },
    ],
    reflections: [
      ...d.reflections,
      { ...reflection, id: crypto.randomUUID(), session: id },
    ],
  }
}
