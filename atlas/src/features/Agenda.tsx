import { useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Plus } from 'lucide-react'
import { useWorkspace } from '../application/workspace'
import { monthDays, moveMonth } from '../domain/agenda'
import { dateLabel, dayOf, shiftDay } from '../domain/dates'
import type { Task } from '../domain/model'
import { Editor, type EditorTarget } from '../ui/Editor'
import { Empty, Field, PageTitle, Panel } from '../ui/components'

export function TaskList({
  tasks,
  edit,
}: {
  tasks: Task[]
  edit?: (id: string) => void
}) {
  const { data, save } = useWorkspace()
  const today = dayOf()
  return (
    <>
      {tasks.map((t) => (
        <div className="list-row" key={t.id}>
          <input
            aria-label={'Concluir ' + t.name}
            type="checkbox"
            checked={t.done}
            onChange={() =>
              save(
                (d) => ({
                  ...d,
                  tasks: d.tasks.map((row) =>
                    row.id === t.id ? { ...row, done: !row.done } : row,
                  ),
                }),
                'Tarefa atualizada.',
              )
            }
          />
          <div className="grow">
            <strong className={t.done ? 'completed' : ''}>{t.name}</strong>
            <small>
              {data.subjects.find((s) => s.id === t.subject)?.name} ·{' '}
              {dateLabel(t.date)}
              {t.goal
                ? ' · ' + data.goals.find((g) => g.id === t.goal)?.name
                : ''}{' '}
              · Prioridade {t.priority.toLowerCase()}
            </small>
          </div>
          {!t.done && t.date <= shiftDay(today, 7) && (
            <span className="badge warm">
              {t.date < today
                ? 'Em atraso'
                : t.date === today
                  ? 'Hoje'
                  : 'Em breve'}
            </span>
          )}
          {edit && (
            <button
              className="icon-btn"
              aria-label={'Editar ' + t.name}
              onClick={() => edit(t.id)}
            >
              <Pencil size={16} />
            </button>
          )}
        </div>
      ))}
    </>
  )
}
export function Agenda() {
  const { data } = useWorkspace()
  const today = dayOf()
  const [month, setMonth] = useState(today.slice(0, 7))
  const [day, setDay] = useState('')
  const [subject, setSubject] = useState('')
  const [status, setStatus] = useState('')
  const [query, search] = useState('')
  const [editor, edit] = useState<EditorTarget | null>(null)
  const tasks = data.tasks
    .filter(
      (t) =>
        (!subject || t.subject === subject) &&
        (!status || t.done === (status === 'done')) &&
        t.name
          .toLocaleLowerCase('pt-BR')
          .includes(query.trim().toLocaleLowerCase('pt-BR')),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
  const filtered = tasks.filter((t) => !day || t.date === day)
  const changeMonth = (next: string) => {
    setMonth(next)
    setDay('')
  }
  return (
    <>
      <PageTitle
        title="Agenda"
        subtitle="Acompanhe os prazos e as atividades ligadas aos seus objetivos."
      >
        <button
          className="primary"
          onClick={() =>
            edit({ kind: data.subjects.length ? 'tasks' : 'subjects' })
          }
        >
          <Plus size={17} />
          {data.subjects.length ? 'Nova tarefa' : 'Nova disciplina'}
        </button>
      </PageTitle>
      <div className="filters">
        <Field label="Buscar tarefa">
          <input
            type="search"
            value={query}
            onChange={(e) => search(e.target.value)}
          />
        </Field>
        <Field label="Disciplina">
          <select value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">Todas</option>
            {data.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Situação">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todas</option>
            <option value="pending">Pendentes</option>
            <option value="done">Concluídas</option>
          </select>
        </Field>
      </div>
      <div className="stack">
        <Panel
          title={dateLabel(month + '-01', { month: 'long', year: 'numeric' })}
          action={
            <div className="actions-inline">
              <button
                className="icon-btn"
                aria-label="Mês anterior"
                disabled={month === '0001-01'}
                onClick={() => changeMonth(moveMonth(month, -1))}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="text-btn"
                onClick={() => {
                  setMonth(today.slice(0, 7))
                  setDay(today)
                }}
              >
                Hoje
              </button>
              <button
                className="icon-btn"
                aria-label="Próximo mês"
                disabled={month === '9999-12'}
                onClick={() => changeMonth(moveMonth(month, 1))}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          }
        >
          <div className="calendar">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((w) => (
              <strong key={w}>{w}</strong>
            ))}
            {monthDays(month).map((date, i) => {
              if (!date) return <span key={i} />
              const count = tasks.filter((t) => t.date === date).length
              return (
                <button
                  key={date}
                  aria-label={
                    dateLabel(date, { dateStyle: 'full' }) +
                    ', ' +
                    count +
                    ' tarefas'
                  }
                  aria-pressed={day === date}
                  className={today === date ? 'today' : ''}
                  onClick={() => setDay(day === date ? '' : date)}
                >
                  {Number(date.slice(-2))}
                  {count > 0 && <small>{count}</small>}
                </button>
              )
            })}
          </div>
        </Panel>
        <Panel
          title={day ? 'Tarefas de ' + dateLabel(day) : 'Todas as tarefas'}
          action={
            day && (
              <button className="text-btn" onClick={() => setDay('')}>
                Ver todas
              </button>
            )
          }
        >
          {filtered.length ? (
            <TaskList
              tasks={filtered}
              edit={(id) => edit({ kind: 'tasks', id })}
            />
          ) : (
            <Empty>Nenhuma tarefa para esta seleção.</Empty>
          )}
        </Panel>
      </div>
      {editor && <Editor target={editor} close={() => edit(null)} />}
    </>
  )
}
