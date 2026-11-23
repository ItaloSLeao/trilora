import { requireRule, type Atlas, type Collection, type Entity } from './model'
import { dayOf } from './dates'

export const labels = { subjects: 'disciplina', concepts: 'conceito', goals: 'objetivo', activities: 'atividade', tasks: 'tarefa', decks: 'baralho', cards: 'cartão' }
export const newLabel = { subjects: 'Nova disciplina', concepts: 'Novo conceito', goals: 'Novo objetivo', activities: 'Nova atividade', tasks: 'Nova tarefa', decks: 'Novo baralho', cards: 'Novo cartão' }
export interface Draft {
  name: string; color: string; subject: string; unit: string; prerequisite: string;
  goal: string; date: string; priority: 'Alta' | 'Média' | 'Baixa'; deck: string;
  concept: string; description: string; question: string; answer: string; done: boolean
}
export function draftFor(d: Atlas, kind: Collection, key?: string): Draft {
  const item = d[kind].find(r => r.id === key)
  const defaults: Draft = { name: '', color: '#387467', subject: d.subjects[0]?.id ?? '', unit: '', prerequisite: '', goal: '', date: dayOf(), priority: 'Média', deck: d.decks[0]?.id ?? '', concept: '', description: '', question: '', answer: '', done: false }
  if (kind === 'activities') defaults.goal = d.goals[0]?.id ?? ''
  return { ...defaults, ...item, prerequisite: item && 'prerequisite' in item ? item.prerequisite ?? '' : '', concept: item && 'concept' in item ? item.concept ?? '' : '', goal: item && 'goal' in item ? item.goal ?? '' : defaults.goal }
}
function upsert<K extends Collection>(d: Atlas, kind: K, entity: Entity<K>): Atlas {
  const rows: Entity<K>[] = [...d[kind]] as Entity<K>[]
  const index = rows.findIndex(r => r.id === entity.id)
  if (index < 0) rows.push(entity)
  else rows[index] = entity
  return { ...d, [kind]: rows }
}
export function storeEntity(d: Atlas, kind: Collection, id: string, fields: Draft) {
  const { name, subject, color, unit, goal, deck, question, answer, date, priority, done, description } = fields
  switch (kind) {
    case 'subjects': return upsert(d, kind, { id, name, color })
    case 'concepts': return upsert(d, kind, { id, name, subject, unit, prerequisite: fields.prerequisite || null })
    case 'goals': return upsert(d, kind, { id, subject, name, done })
    case 'activities': return upsert(d, kind, { id, goal, name })
    case 'tasks': return upsert(d, kind, { id, name, subject, goal: goal || null, date, priority, done })
    case 'decks': return upsert(d, kind, { id, name, subject, description })
    case 'cards': return upsert(d, kind, { id, deck, concept: fields.concept || null, question, answer })
  }
}
export function removeSubject(d: Atlas, id: string) {
  const linked = [...d.tasks, ...d.decks, ...d.concepts, ...d.goals].some(item => item.subject === id)
  requireRule(!linked, 'A disciplina possui vínculos. Reorganize os conceitos, objetivos, tarefas ou baralhos antes de excluir.')
  return { ...d, subjects: d.subjects.filter(s => s.id !== id) }
}
