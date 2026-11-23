import { documentSchema, requireRule, type Atlas } from './model'

export function validate(input: unknown): Atlas {
  requireRule(typeof input === 'object' && input !== null && 'schemaVersion' in input, 'Formato Atlas inválido.')
  requireRule(input.schemaVersion === 1, 'Versão de esquema incompatível. Use uma versão compatível do Atlas.')
  const parsed = documentSchema.safeParse(input)
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path.join('.')
    throw new Error(`Dados inválidos em ${path || 'arquivo'}. Verifique os campos e seus limites.`)
  }
  const d = parsed.data
  const records = [...d.subjects, ...d.concepts, ...d.goals, ...d.activities, ...d.tasks, ...d.decks, ...d.cards, ...d.reviews, ...d.sessions, ...d.reflections, ...(d.active ? [d.active] : [])]
  requireRule(new Set(records.map(item => item.id)).size === records.length, 'Há identificadores duplicados.')
  requireRule(new Set(d.subjects.map(s => s.name.toLocaleLowerCase('pt-BR'))).size === d.subjects.length, 'Já existe uma disciplina com esse nome.')
  const subjects = new Set(d.subjects.map(s => s.id))
  const concepts = new Map(d.concepts.map(c => [c.id, c]))
  const goals = new Map(d.goals.map(g => [g.id, g]))
  const activities = new Map(d.activities.map(a => [a.id, a]))
  const decks = new Map(d.decks.map(row => [row.id, row]))
  const cards = new Map(d.cards.map(row => [row.id, row]))
  for (const item of [...d.concepts, ...d.goals, ...d.decks, ...d.tasks]) requireRule(subjects.has(item.subject), 'A disciplina possui vínculos ou está ausente.')
  const resolved = new Set<string>()
  for (const c of d.concepts) {
    let node: typeof c | undefined = c
    const path = new Set<string>()
    while (node && !resolved.has(node.id)) {
      requireRule(!path.has(node.id), 'O pré-requisito criaria um ciclo.')
      path.add(node.id)
      if (!node.prerequisite) break
      node = concepts.get(node.prerequisite)
      requireRule(node?.subject === c.subject, 'Escolha um pré-requisito da mesma disciplina.')
    }
    path.forEach(key => resolved.add(key))
  }
  for (const a of d.activities) requireRule(goals.has(a.goal), 'A atividade precisa de um objetivo.')
  for (const t of d.tasks) requireRule(!t.goal || goals.get(t.goal)?.subject === t.subject, 'A tarefa e o objetivo devem ter a mesma disciplina.')
  for (const c of d.cards) {
    const group = decks.get(c.deck)
    requireRule(group && (!c.concept || concepts.get(c.concept)?.subject === group.subject), 'Cartão, conceito e baralho precisam pertencer à mesma disciplina.')
  }
  const attempts = new Set<string>()
  for (const r of d.reviews) {
    requireRule(cards.has(r.card) && (!r.concept || concepts.has(r.concept)), 'Tentativa com cartão ou conceito ausente.')
    const key = JSON.stringify([r.round, r.card])
    requireRule(!attempts.has(key), 'Este cartão já foi avaliado nesta rodada.')
    attempts.add(key)
  }
  for (const s of [...d.sessions, ...(d.active ? [d.active] : [])]) {
    requireRule(goals.get(s.goal)?.subject === s.subject && activities.get(s.activity)?.goal === s.goal, 'Vínculos da sessão inconsistentes.')
    requireRule(s.timed || s.elapsedMs === 0, 'Tempo registrado em sessão sem cronômetro.')
  }
  for (const s of d.sessions) requireRule(s.endedAt >= s.startedAt, 'Fim anterior ao início da sessão.')
  const reflected = new Set(d.reflections.map(r => r.session))
  requireRule(reflected.size === d.reflections.length && reflected.size === d.sessions.length && d.sessions.every(s => reflected.has(s.id)), 'Cada sessão concluída precisa da sua reflexão.')
  return d
}
