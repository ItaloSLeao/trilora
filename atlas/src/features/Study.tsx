import { useState, type FormEvent } from 'react'
import { Clock3, Flag, Pause, Play } from 'lucide-react'
import { useWorkspace } from '../application/workspace'
import { useClock } from '../application/clock'
import { finishStudy, startStudy } from '../domain/practice'
import { duration } from '../domain/dates'
import { Empty, Field, PageTitle, Panel, Pick } from '../ui/components'

function Plan({ activityId }: { activityId: string }) {
  const { data, save } = useWorkspace()
  const clock = useClock()
  const suggested = data.activities.find((a) => a.id === activityId)
  const target = data.goals.find((g) => g.id === suggested?.goal && !g.done)
  const [subject, setSubject] = useState(
    target?.subject ?? data.subjects[0]?.id ?? '',
  )
  const [goal, setGoal] = useState(target?.id ?? '')
  const [activity, setActivity] = useState(target ? activityId : '')
  const [timed, setTimed] = useState(true)
  const [busy, setBusy] = useState(false)
  async function start(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    const plan = {
      id: crypto.randomUUID(),
      subject,
      goal: goal || crypto.randomUUID(),
      activity: activity || crypto.randomUUID(),
      timed,
    }
    if (
      (await save((d) => {
        const next = {
          ...d,
          goals: goal
            ? d.goals
            : [
                ...d.goals,
                {
                  id: plan.goal,
                  subject,
                  name:
                    'Estudar ' +
                    (d.subjects.find((s) => s.id === subject)?.name ??
                      'a disciplina'),
                  done: false,
                },
              ],
          activities: activity
            ? d.activities
            : [
                ...d.activities,
                { id: plan.activity, goal: plan.goal, name: 'Prática livre' },
              ],
        }
        return startStudy(next, plan, Date.now())
      }, 'Sessão iniciada.')) &&
      timed
    )
      clock.resume(plan.id, 0)
    setBusy(false)
  }
  const goals = data.goals.filter((g) => g.subject === subject && !g.done)
  const activities = data.activities.filter((a) => a.goal === goal)
  return (
    <Panel title="Planejar a sessão">
      <form id="study-plan" onSubmit={start}>
        <Pick
          label="Disciplina"
          value={subject}
          rows={data.subjects}
          set={(v) => {
            setSubject(v)
            setGoal('')
            setActivity('')
          }}
        />
        <Pick
          label="Objetivo (opcional)"
          optional
          value={goal}
          rows={goals}
          set={(v) => {
            setGoal(v)
            setActivity('')
          }}
        />
        <Pick
          label="Atividade (opcional)"
          optional
          value={activity}
          rows={activities}
          set={setActivity}
        />
        {!data.subjects.length ? (
          <Empty>
            <a href="#conhecimentos/subjects">Cadastre uma disciplina</a> para
            montar o plano.
          </Empty>
        ) : null}
        <label className="inline-check">
          <input
            type="checkbox"
            checked={timed}
            onChange={(e) => setTimed(e.target.checked)}
          />
          Usar cronômetro
        </label>
        <div className="actions">
          <button className="primary" disabled={!subject || busy}>
            <Play size={17} />
            Iniciar sessão
          </button>
        </div>
      </form>
    </Panel>
  )
}

function ReflectionForm({ id }: { id: string }) {
  const { save } = useWorkspace()
  const [form, set] = useState({
    achieved: '',
    difficulty: '',
    revisit: '',
    adjustment: '',
  })
  const [busy, setBusy] = useState(false)
  const prompts = {
    achieved: 'O que você conseguiu realizar?',
    difficulty: 'Qual dificuldade encontrou?',
    revisit: 'O que pretende revisar?',
    adjustment: 'Como deseja ajustar seu plano?',
  }
  return (
    <Panel title="Avaliar e refletir">
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (busy) return
          setBusy(true)
          if (
            await save(
              (d) => finishStudy(d, id, form, Date.now()),
              'Sessão e reflexão salvas.',
            )
          )
            location.hash = 'progresso'
          setBusy(false)
        }}
      >
        {(Object.keys(prompts) as (keyof typeof form)[]).map((k) => (
          <Field
            key={k}
            label={prompts[k] + (k === 'achieved' ? '' : ' (opcional)')}
          >
            <textarea
              required={k === 'achieved'}
              maxLength={2000}
              value={form[k]}
              onChange={(e) => set({ ...form, [k]: e.target.value })}
            />
          </Field>
        ))}
        <div className="actions">
          <button className="primary" disabled={busy}>
            Salvar sessão e reflexão
          </button>
        </div>
      </form>
    </Panel>
  )
}

export function Study({ activityId }: { activityId: string }) {
  const { data } = useWorkspace()
  const { active } = data
  const clock = useClock()
  const [busy, setBusy] = useState(false)
  const [stepHint, hint] = useState('')
  const stop = async (next: 'practice' | 'reflect') => {
    if (!active || busy) return
    setBusy(true)
    await clock.stop(active.id, next)
    setBusy(false)
  }
  return (
    <>
      <PageTitle
        title="Modo de estudo"
        subtitle="Escolha uma intenção, pratique e registre o que descobriu."
      />
      <div className="study-layout">
        <div className="steps">
          {['Planejar', 'Praticar', 'Refletir'].map((s, i) => (
            <button
              type="button"
              disabled={busy || clock.pending}
              onClick={() => {
                hint('')
                if (!active) {
                  if (i === 2)
                    hint('Inicie uma prática para registrar a reflexão.')
                  else if (i === 1)
                    (
                      document.getElementById('study-plan') as HTMLFormElement
                    )?.requestSubmit()
                  else
                    document
                      .querySelector<HTMLInputElement>('#study-plan select')
                      ?.focus()
                } else if (i === 2 && active.phase === 'practice')
                  void stop('reflect')
                else if (i === 0)
                  hint(
                    'Seu plano está registrado na sessão abaixo. Conclua a sessão para planejar outra.',
                  )
                else
                  document
                    .querySelector<HTMLElement>('.study-layout .panel')
                    ?.scrollIntoView({ block: 'nearest' })
              }}
              key={s}
              aria-current={
                i === (!active ? 0 : active.phase === 'practice' ? 1 : 2)
                  ? 'step'
                  : undefined
              }
            >
              {s}
            </button>
          ))}
        </div>
        {stepHint && (
          <p role="status" className="hint">
            {stepHint}
          </p>
        )}
        {!active ? (
          <Plan key={activityId} activityId={activityId} />
        ) : (
          <div className="stack">
            <Panel
              title={
                data.activities.find((a) => a.id === active.activity)?.name ??
                'Sessão'
              }
            >
              <p className="metadata">
                {data.subjects.find((s) => s.id === active.subject)?.name} ·{' '}
                {data.goals.find((g) => g.id === active.goal)?.name}
              </p>
              {active.timed && (
                <div className="clock">
                  <Clock3 size={28} />
                  <strong role="timer" aria-label="Tempo efetivo">
                    {duration(clock.elapsed)}
                  </strong>
                </div>
              )}
              <p className="hint">
                {active.phase === 'reflect'
                  ? 'Prática encerrada. Registre o resultado abaixo.'
                  : !active.timed
                    ? 'Sessão sem medição de tempo.'
                    : clock.pending
                      ? 'Medição interrompida. Salve novamente o ponto exibido.'
                      : clock.running
                        ? 'Cronômetro em andamento.'
                        : 'Em pausa. Você pode retomar a partir do último tempo salvo.'}
              </p>
              {active.phase === 'practice' && (
                <div className="actions-inline study-actions">
                  {active.timed &&
                    (clock.pending ? (
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => stop('practice')}
                      >
                        Tentar salvar o tempo
                      </button>
                    ) : clock.running ? (
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => stop('practice')}
                      >
                        <Pause size={16} />
                        Pausar
                      </button>
                    ) : (
                      <button
                        className="secondary"
                        onClick={() =>
                          clock.resume(active.id, active.elapsedMs)
                        }
                      >
                        <Play size={16} />
                        Retomar
                      </button>
                    ))}
                  <button
                    disabled={busy || clock.pending}
                    className="primary"
                    onClick={() => stop('reflect')}
                  >
                    <Flag size={16} />
                    Concluir prática
                  </button>
                </div>
              )}
            </Panel>
            {active.phase === 'reflect' && <ReflectionForm id={active.id} />}
          </div>
        )}
      </div>
    </>
  )
}
