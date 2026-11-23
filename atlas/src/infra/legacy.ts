import { z } from 'zod'
import { blank, civil, instant, priority, requireRule, type Atlas } from '../domain/model'
import { validate } from '../domain/integrity'

const key = z.string().min(1).max(128).refine(value => value.trim() === value)
const text = (min: number, max: number) => z.string().max(max).refine(v => v.trim().length >= min)
const name = text(2, 80)
const stamp = z.string().refine(s => Number.isFinite(Date.parse(s)) && new Date(s).toISOString() === s)
const segment = z.object({ start: instant, end: instant })
const timerBase = { id: key, subject: key, startedAt: instant, segments: z.array(segment) }
const schema = z.object({
  subjects: z.array(z.object({ id: key, name, color: z.string().regex(/^#[\da-f]{6}$/i) })),
  tasks: z.array(z.object({ id: key, subject: key, title: text(2,120), date: civil, priority, done: z.boolean() })),
  flashcards: z.object({
    decks: z.array(z.object({ id: key, subject: key, name, description: text(0,500) })),
    cards: z.array(z.object({ id: key, deck: key, question: text(1,500), answer: text(1,2000) })),
    sessions: z.array(z.object({ id: key, deck: key, subject: key, deckName: name, startedAt: stamp, completedAt: stamp, reviews: z.array(z.object({ card: key, correct: z.boolean() })).min(1) })).optional(),
  }).optional(),
  studyTimer: z.object({
    active: z.object({ ...timerBase, running: z.boolean() }).nullable(),
    sessions: z.array(z.object({ ...timerBase, subjectName: name, endedAt: instant, durationMs: instant })),
  }).optional(),
})

export function parseLegacy(raw: string) {
  let value: unknown
  try { value = JSON.parse(raw) } catch { throw new Error('JSON legado corrompido.') }
  const result = schema.safeParse(value)
  requireRule(result.success, 'Estrutura inválida na cópia de trilora-v1.')
  const old = result.data
  const { sessions = [], active = null } = old.studyTimer ?? {}
  const flash = old.flashcards
  const records = [...old.subjects, ...old.tasks, ...(flash?.decks ?? []), ...(flash?.cards ?? []), ...(flash?.sessions ?? []), ...sessions, ...(active ? [active] : [])]
  requireRule(new Set(records.map(r => r.id)).size === records.length, 'Identificador legado duplicado.')
  for (const s of flash?.sessions ?? []) {
    requireRule(Date.parse(s.completedAt) >= Date.parse(s.startedAt) && new Set(s.reviews.map(r => r.card)).size === s.reviews.length, 'Sessão de revisão legada inválida.')
  }
  for (const s of [...sessions, ...(active ? [active] : [])]) {
    let end = s.startedAt
    let total = 0
    for (const part of s.segments) {
      requireRule(part.start >= end && part.end > part.start, 'Intervalos legados inconsistentes.')
      total += part.end - part.start
      end = part.end
    }
    if ('endedAt' in s) requireRule(s.endedAt >= end && s.durationMs === total, 'Duração legada inválida.')
  }
  requireRule(!active || old.subjects.some(s => s.id === active.subject), 'Cronômetro legado sem disciplina.')
  return old
}

export function migrateLegacy(raw: string): Atlas {
  const old = parseLegacy(raw)
  return validate({ ...blank(), legacySource: raw, subjects: old.subjects,
    tasks: old.tasks.map(({ title, ...task }) => ({ ...task, name: title, goal: null })),
    decks: old.flashcards?.decks ?? [],
    cards: (old.flashcards?.cards ?? []).map(c => ({ ...c, concept: null })),
  })
}

export function readLegacy(getStorage = () => window.localStorage) {
  let raw: string | null
  try { raw = getStorage().getItem('trilora-v1') }
  catch { throw new Error('Armazenamento legado indisponível neste navegador.') }
  requireRule(raw !== null, 'A chave trilora-v1 está ausente nesta origem. Você também pode importar uma cópia JSON.')
  return migrateLegacy(raw)
}
