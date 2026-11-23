import { BookCheck, Clock3, Layers } from 'lucide-react'
import { useWorkspace } from '../application/workspace'
import { legacyHistory, totals } from '../application/insights'
import { duration, dateLabel, dayOf } from '../domain/dates'
import { dueCards } from '../domain/practice'
import { Empty, Metric, PageTitle, Panel } from '../ui/components'
import { Suggestions } from './Dashboard'

export function Progress({ today }: { today: string }) {
  const { data } = useWorkspace()
  const legacy = legacyHistory(data)
  const total = totals(data)
  const attempts = [...data.reviews,...legacy.reviews].sort((a,b) => b.at-a.at)
  const concepts = data.concepts.map(c => ({ ...c, attempts:data.reviews.filter(r => r.concept === c.id) }))
  const sessions = [
    ...data.sessions.map(s => ({ id:s.id,at:s.endedAt,time:s.elapsedMs,timed:s.timed,title:data.activities.find(a => a.id === s.activity)?.name,
      goal:data.goals.find(g => g.id === s.goal)?.name,reflection:data.reflections.find(r => r.session === s.id) })),
    ...legacy.sessions.map(s => ({ id:s.id,at:s.endedAt,time:s.durationMs,timed:true,title:s.subjectName,goal:'Tempo importado do Trilora',reflection:undefined })),
  ].sort((a,b) => b.at-a.at)
  const recent = sessions.filter(s => s.timed).slice(0,7).reverse()
  const peak = Math.max(1,...recent.map(s => s.time))
  const lastMiss = data.reviews.filter(r => r.concept).at(-1)
  const missedConcept = lastMiss && !lastMiss.correct ? data.concepts.find(c => c.id === lastMiss.concept) : undefined
  return <><PageTitle title="Progresso" subtitle="Compare a prática registrada com os resultados das suas tentativas."/>
    <div className="stack"><Panel title="Engajamento"><div className="metrics compact"><Metric icon={BookCheck} tone="blue" label="Sessões concluídas" value={total.sessions}/><Metric icon={Clock3} tone="sage" label="Tempo efetivo" value={duration(total.time)}/><Metric icon={Layers} tone="lilac" label="Atividades realizadas" value={new Set(data.sessions.map(s => s.activity)).size}/></div><p className="hint">O tempo indica participação. A compreensão pode ser investigada nas tentativas e reflexões.</p></Panel>
    <div className="two-col"><Panel title="Tentativas por conceito"><p className="summary-line"><b>{attempts.length}</b> revisões realizadas · <b>{dueCards(data,today).length}</b> cartões pendentes</p><p className="hint">Cada contagem representa uma autoavaliação. Um cartão pode contribuir várias vezes.</p>
    {concepts.map(c => <div key={c.id} className="list-row"><div className="grow"><strong>{c.name}</strong><small>{c.attempts.filter(r => r.correct).length} acerto(s) · {c.attempts.filter(r => !r.correct).length} erro(s)</small></div></div>)}{!concepts.length && <Empty>Associe cartões a conceitos para acompanhar as tentativas de cada um.</Empty>}<small className="metadata">Sem conceito na tentativa: {attempts.filter(r => !r.concept).length}</small></Panel>
    <Panel title="Próximos passos">{missedConcept && <p className="feedback">Retome {missedConcept.name}. Na última tentativa vinculada a um conceito você marcou uma dificuldade.</p>}<Suggestions today={today}/></Panel></div>
    <Panel title="Tempo nas últimas sessões">{recent.length ? <ol className="bars">{recent.map(s => <li key={s.id}><span>{dateLabel(dayOf(s.at))} · {s.title}</span><span className="bar-track"><i style={{width:(100*s.time/peak)+'%'}}/></span><strong>{duration(s.time)}</strong></li>)}</ol> : <Empty>As sessões cronometradas formarão a sequência de durações.</Empty>}</Panel>
    <Panel title="Sessões e reflexões">{!sessions.length && <Empty>Conclua uma atividade no modo de estudo para registrar sua reflexão.</Empty>}{sessions.map(s => <details key={s.id} className="history"><summary><strong>{s.title}</strong> · {dateLabel(dayOf(s.at))} · {s.timed ? duration(s.time) : 'Sem cronômetro'}</summary><p>{s.goal}</p>{s.reflection && <dl>{([['Realização',s.reflection.achieved],['Dificuldade',s.reflection.difficulty],['Revisar',s.reflection.revisit],['Ajuste no plano',s.reflection.adjustment]]).filter(([,v]) => v).map(([k,v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}</details>)}</Panel>
    <Panel title="Histórico de tentativas">{!attempts.length && <Empty>As avaliações feitas nos flashcards aparecerão aqui.</Empty>}{attempts.map(r => <div className="list-row" key={r.id}><div className="grow"><strong>{r.question}</strong><small>{new Date(r.at).toLocaleString('pt-BR')} · {r.concept ? data.concepts.find(c => c.id === r.concept)?.name : 'Sem conceito'}{'round' in r ? '' : ' · Histórico importado, horário da sessão'}</small></div><span className={'badge '+(r.correct ? '' : 'warm')}>{r.correct ? 'Acerto' : 'Erro'}</span></div>)}</Panel></div></>
}
