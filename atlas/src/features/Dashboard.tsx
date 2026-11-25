import { MonitorSummary } from '../intelligence/MonitorSummary'
import { useState } from 'react'
import {
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  ChevronRight,
  Clock3,
  Compass,
  Flag,
  Layers,
  ListChecks,
  Play,
  Plus,
  Route,
  Target,
} from 'lucide-react'
import { recommendations, recent, totals } from '../application/insights'
import { useWorkspace } from '../application/workspace'
import { nearTasks } from '../domain/agenda'
import { asDate, dateLabel, dayOf, duration, shiftDay } from '../domain/dates'
import { dueCards } from '../domain/practice'
import { PageTitle, Panel, Empty, Metric } from '../ui/components'
import { Editor } from '../ui/Editor'
import { TaskList } from './Agenda'

const icons = { study: BookOpen, cards: Layers, task: ListChecks, plan: Route }
export function Suggestions({ today }: { today: string }) {
  const { data } = useWorkspace()
  return (
    <div>
      {recommendations(data, today).map((r) => {
        const Icon = icons[r.type]
        return (
          <a href={r.target} className="suggestion" key={r.type + r.title}>
            <span
              className={
                'icon-box ' +
                { study: 'blue', cards: 'lilac', task: 'sand', plan: 'sage' }[
                  r.type
                ]
              }
            >
              <Icon size={21} />
            </span>
            <div>
              <strong>{r.title}</strong>
              <small>{r.reason}</small>
            </div>
            <ChevronRight size={17} />
          </a>
        )
      })}
    </div>
  )
}
function Week({ today }: { today: string }) {
  const { data } = useWorkspace()
  const [selection, select] = useState('')
  const day = selection || today
  const monday = shiftDay(today, -((asDate(today).getDay() + 6) % 7))
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(monday, i))
  const tasks = data.tasks.filter((t) => !t.done && t.date === day)
  return (
    <Panel
      title="Minha semana"
      action={
        <a className="text-btn" href="#agenda" aria-label="Abrir agenda">
          <CalendarDays size={18} />
        </a>
      }
    >
      <p className="week-month">
        {dateLabel(monday)} – {dateLabel(days[6]!)}
      </p>
      <div className="week">
        {days.map((d) => (
          <button
            key={d}
            aria-label={dateLabel(d, { dateStyle: 'full' })}
            aria-pressed={d === day}
            onClick={() => select(d)}
          >
            <small>{dateLabel(d, { weekday: 'short' }).slice(0, 3)}</small>
            <b>{Number(d.slice(-2))}</b>
          </button>
        ))}
      </div>
      <div className="week-tasks">
        <CalendarCheck2 size={18} />
        <div>
          {tasks.length ? (
            tasks.map((t) => <p key={t.id}>{t.name}</p>)
          ) : (
            <p>Sem tarefas para {day === today ? 'hoje' : dateLabel(day)}.</p>
          )}
        </div>
      </div>
    </Panel>
  )
}
export function Dashboard({ today }: { today: string }) {
  const { data } = useWorkspace()
  const [adding, add] = useState(false)
  const due = dueCards(data, today)
  const upcoming = nearTasks(data.tasks, today)
  const activity = recent(data).slice(0, 4)
  const goals = data.goals.filter((g) => !g.done)
  const total = totals(data)
  return (
    <>
      <PageTitle
        title="Painel de estudos"
        subtitle="Seu planejamento e suas próximas atividades, em um só lugar."
      >
        <button className="secondary" onClick={() => add(true)}>
          <Plus size={17} />
          {data.subjects.length ? 'Nova tarefa' : 'Nova disciplina'}
        </button>
      </PageTitle>
      <section className="hero">
        <div>
          <p className="hero-label">
            <Compass size={16} /> Modo de estudo
          </p>
          <h2>
            {data.active ? 'Continue sua sessão.' : 'Estude com um objetivo.'}
          </h2>
          <p className="hero-description">
            {data.active
              ? 'Sua atividade está salva. Retome a prática ou complete a reflexão.'
              : 'Escolha uma atividade, pratique no seu ritmo e registre o que aprendeu.'}
          </p>
          <a className="hero-button" href="#estudo">
            <Play size={15} fill="currentColor" />
            {data.active ? 'Retomar sessão' : 'Preparar sessão'}
          </a>
        </div>
      </section>
      <section className="metrics" aria-label="Resumo do espaço">
        <Metric
          icon={ListChecks}
          tone="sand"
          value={data.tasks.filter((t) => !t.done).length}
          label="Tarefas pendentes"
        />
        <Metric
          icon={Layers}
          tone="lilac"
          value={due.length}
          label="Cartões para revisar"
        />
        <Metric
          icon={Clock3}
          tone="sage"
          value={duration(total.time)}
          label="Tempo de estudo"
        />
      </section>
      <div className="dashboard-grid">
        <div className="stack">
          <Panel
            title="Sugestões para hoje"
            action={<Compass size={18} className="panel-icon" />}
          >
            <Suggestions today={today} />
          </Panel>
          <Panel
            title="Próximos prazos"
            action={
              <a className="text-btn" href="#agenda">
                Ver agenda
              </a>
            }
          >
            {upcoming.length ? (
              <TaskList tasks={upcoming.slice(0, 5)} />
            ) : (
              <Empty>
                Sem tarefas vencidas ou com prazo nos próximos sete dias.
              </Empty>
            )}
          </Panel>
          <Panel
            title="Atividade recente"
            action={
              <a className="text-btn" href="#progresso">
                Ver histórico
              </a>
            }
          >
            {activity.length ? (
              activity.map((r) => (
                <div className="list-row" key={r.id}>
                  <span className="icon-box blue">
                    <Clock3 size={17} />
                  </span>
                  <div className="grow">
                    <strong>{r.title}</strong>
                    <small>
                      {r.detail} · {dateLabel(dayOf(r.at))}
                    </small>
                  </div>
                </div>
              ))
            ) : (
              <Empty>Suas revisões e sessões concluídas aparecerão aqui.</Empty>
            )}
          </Panel>
        </div>
        <div className="stack">
          <Week today={today} />
          <MonitorSummary />
          <Panel
            title="Objetivos em andamento"
            action={<Target size={18} className="panel-icon" />}
          >
            {goals.slice(0, 4).map((g) => (
              <div key={g.id} className="list-row">
                <Flag size={16} />
                <div className="grow">
                  <strong>{g.name}</strong>
                  <small>
                    {data.subjects.find((s) => s.id === g.subject)?.name}
                  </small>
                </div>
              </div>
            ))}
            {!goals.length && (
              <Empty>
                Defina algo que você quer conseguir explicar, resolver ou
                demonstrar.
              </Empty>
            )}
            <a href="#conhecimentos/goals" className="text-btn">
              Abrir objetivos
            </a>
          </Panel>
        </div>
      </div>
      {adding && (
        <Editor
          target={{ kind: data.subjects.length ? 'tasks' : 'subjects' }}
          close={() => add(false)}
        />
      )}
    </>
  )
}
