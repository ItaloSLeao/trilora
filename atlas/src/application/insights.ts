import type { Atlas } from '../domain/model'
import { nearTasks } from '../domain/agenda'
import { dateLabel } from '../domain/dates'
import { dueCards } from '../domain/practice'
import { parseLegacy } from '../infra/legacy'

let cache: { raw: string | null; data: ReturnType<typeof extract> } | undefined
function extract(raw: string | null) {
  const legacy = raw ? parseLegacy(raw) : null
  return {
    reviews: (legacy?.flashcards?.sessions ?? []).flatMap(s => s.reviews.map(r => ({ ...r,id:JSON.stringify([s.id,r.card]),at:Date.parse(s.completedAt),question:s.deckName,concept:null }))),
    sessions: legacy?.studyTimer?.sessions ?? [], active: legacy?.studyTimer?.active ?? null,
  }
}
export function legacyHistory(d: Atlas) {
  if (!cache || cache.raw !== d.legacySource) cache = { raw:d.legacySource,data:extract(d.legacySource) }
  return cache.data
}
export function totals(d: Atlas) {
  const legacy = legacyHistory(d)
  return { sessions:d.sessions.length + legacy.sessions.length,
    attempts:d.reviews.length + legacy.reviews.length,
    time:d.sessions.reduce((sum,s) => sum+s.elapsedMs,0) + legacy.sessions.reduce((sum,s) => sum+s.durationMs,0) }
}
export function recommendations(d: Atlas, day: string) {
  const result: { title: string; reason: string; target: string; type:'study'|'cards'|'task'|'plan' }[] = []
  if (d.active) result.push({ title:'Retomar sua sessão',reason:'Uma atividade de estudo aguarda conclusão.',target:'#estudo',type:'study' })
  const due = dueCards(d,day)
  if (due.length) result.push({ title:'Revisar flashcards',reason:`${due.length} cartão(ões) novos ou com revisão prevista até hoje.`,target:'#revisao',type:'cards' })
  const next = nearTasks(d.tasks,day)[0]
  if (next) result.push({ title:next.name,reason:'Tarefa pendente com prazo em '+dateLabel(next.date)+'.',target:'#agenda',type:'task' })
  const goal = d.goals.find(g => !g.done && d.activities.some(a => a.goal === g.id))
  const activity = d.activities.find(a => a.goal === goal?.id)
  if (activity && goal && !d.active) result.push({ title:activity.name,reason:'Atividade do objetivo “'+goal.name+'”, ainda em andamento.',target:'#estudo/'+activity.id,type:'study' })
  if (!result.length) {
    if (!d.subjects.length) result.push({title:'Cadastrar uma disciplina',reason:'Seu plano começa com a área que você quer estudar.',target:'#conhecimentos/subjects',type:'plan'})
    else if (!d.goals.some(g => !g.done)) result.push({title:'Definir um objetivo',reason:'Sua disciplina já está cadastrada. Escolha o que quer conseguir fazer.',target:'#conhecimentos/goals',type:'plan'})
    else result.push({title:'Planejar uma atividade',reason:'Há um objetivo em andamento que pode receber uma prática.',target:'#conhecimentos/activities',type:'plan'})
  }
  return result
}
export function recent(d: Atlas) {
  const legacy = legacyHistory(d)
  return [
    ...d.reviews.map(r => ({id:r.id,at:r.at,title:r.question,detail:r.correct ? 'Revisão · Acerto' : 'Revisão · Erro'})),
    ...d.sessions.map(s => ({id:s.id,at:s.endedAt,title:d.activities.find(a => a.id === s.activity)?.name ?? 'Atividade',detail:'Sessão com reflexão'})),
    ...legacy.reviews.map(r => ({id:'old-review-'+r.id,at:r.at,title:r.question,detail:'Revisão importada · '+(r.correct ? 'Acerto' : 'Erro')})),
    ...legacy.sessions.map(s => ({id:'old-time-'+s.id,at:s.endedAt,title:s.subjectName,detail:'Sessão de tempo importada'})),
  ].sort((a,b) => b.at-a.at)
}
