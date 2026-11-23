import { z } from 'zod'

export const id = z.string().trim().min(1).max(128)
export const title = z.string().trim().min(2, 'Use pelo menos dois caracteres.').max(160)
export const instant = z.number().int().nonnegative().max(8640000000000000)
export const civil = z.iso.date().refine(day => day >= '0001-01-01', 'Data inválida.')
export const priority = z.enum(['Alta', 'Média', 'Baixa'])
const note = z.string().trim().max(2000)
const subject = z.strictObject({ id, name: title, color: z.string().regex(/^#[\da-f]{6}$/i) })
const concept = z.strictObject({ id, subject: id, name: title, unit: title, prerequisite: id.nullable() })
const goal = z.strictObject({ id, subject: id, name: title, done: z.boolean() })
const activity = z.strictObject({ id, goal: id, name: title })
const task = z.strictObject({ id, subject: id, goal: id.nullable(), name: title, date: civil, priority, done: z.boolean() })
const deck = z.strictObject({ id, subject: id, name: title, description: note })
const card = z.strictObject({ id, deck: id, concept: id.nullable(), question: z.string().trim().min(1).max(500), answer: note.min(1) })
const review = z.strictObject({ id, card: id, concept: id.nullable(), question: card.shape.question, at: instant, correct: z.boolean(), due: civil, stage: z.number().int().min(0).max(4), round: id })
const plan = { id, subject: id, goal: id, activity: id, startedAt: instant, timed: z.boolean(), elapsedMs: instant }
const active = z.strictObject({ ...plan, phase: z.enum(['practice', 'reflect']) })
const session = z.strictObject({ ...plan, endedAt: instant })
const reflection = z.strictObject({ id, session: id, achieved: note.min(1), difficulty: note, revisit: note, adjustment: note })

export const documentSchema = z.strictObject({
  schemaVersion: z.literal(1),
  subjects: z.array(subject), concepts: z.array(concept), goals: z.array(goal),
  activities: z.array(activity), tasks: z.array(task), decks: z.array(deck),
  cards: z.array(card), reviews: z.array(review), sessions: z.array(session),
  reflections: z.array(reflection), active: active.nullable(), legacySource: z.string().nullable(),
})
export type Atlas = z.infer<typeof documentSchema>
export type Task = Atlas['tasks'][number]
export type Active = z.infer<typeof active>
export type Reflection = z.infer<typeof reflection>
export type Collection = 'subjects' | 'concepts' | 'goals' | 'activities' | 'tasks' | 'decks' | 'cards'
export type Entity<K extends Collection> = Atlas[K][number]
export function blank(): Atlas {
  return { schemaVersion: 1, subjects: [], concepts: [], goals: [], activities: [], tasks: [], decks: [], cards: [], reviews: [], sessions: [], reflections: [], active: null, legacySource: null }
}
export function requireRule(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message)
}
