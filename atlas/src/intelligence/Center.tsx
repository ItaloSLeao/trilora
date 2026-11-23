import { PushControl } from './PushControl'
import { useCallback, useEffect, useState } from 'react'
import { useWorkspace } from '../application/workspace'
import { Panel, Field, PageTitle } from '../ui/components'
import { projection } from './projection'
import { useAction, useRemote, type Notice, type State } from './remote'
import { Tutor } from './Tutor'

export function Intelligence({ tab }: { tab: string }) {
  const remote = useRemote()
  const [name, setName] = useState(''),
    [password, setPassword] = useState('')
  const { run, busy, error } = useAction()
  return (
    <>
      <PageTitle
        title="Acompanhamento acadêmico"
        subtitle="Monitor, biblioteca e tutor contextualizado."
      />
      {remote.user ? (
        <>
          <div className="tabs">
            <a href="#inteligencia">Central</a>
            <a href="#inteligencia/tutor">Biblioteca e tutor</a>
            <button onClick={remote.logout}>Sair de {remote.user}</button>
          </div>
          {tab.startsWith('tutor') ? (
            <Tutor key={tab} conceptId={decodeURIComponent(tab.slice(6))} />
          ) : (
            <Monitor />
          )}
        </>
      ) : (
        <Panel title="Conectar ao serviço">
          <p>
            Os recursos locais continuam disponíveis. Entre com a conta criada
            pelo administrador do servidor.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void run(async () => {
                await remote.login(name, password)
                setPassword('')
              })
            }}
          >
            <Field label="Usuário">
              <input
                autoComplete="username"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Senha">
              <input
                autoComplete="current-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <button className="primary" disabled={busy}>
              Conectar
            </button>
          </form>
          {error && <p role="alert">{error}</p>}
        </Panel>
      )}
    </>
  )
}
interface Report {
  week: string
  details: {
    sessions: number
    reviews: number
    correct: number
    goals: string[]
    future: string[]
    next: string[]
  }
}
interface Event {
  id: string
  kind: string
  occurred: string
}
function Monitor() {
  const { data } = useWorkspace(),
    { call, logout, syncing, setSync } = useRemote()
  const [state, set] = useState<State>(),
    [notes, notify] = useState<Notice[]>([]),
    [reports, setReports] = useState<Report[]>([]),
    [events, setEvents] = useState<Event[]>([])
  const [notice, say] = useState('')
  const { error, busy, run } = useAction()
  const refresh = useCallback(async () => {
    const [s, n, r, e] = await Promise.all([
      call<State>('state'),
      call<Notice[]>('notices'),
      call<Report[]>('reports'),
      call<Event[]>('events'),
    ])
    set(s)
    notify(n)
    setReports(r)
    setEvents(e)
  }, [call])
  useEffect(() => {
    void run(refresh)
  }, [refresh])
  const serialized = JSON.stringify(projection(data))
  async function decide(n: Notice, status: string) {
    await call('notices/' + n.id, 'PATCH', { status })
    await refresh()
  }
  return (
    <div className="stack">
      {error && <p role="alert">{error}</p>}
      <p role="status">{notice}</p>
      <Panel title="Contexto autorizado">
        <p>
          Compartilhar com o servidor os títulos, vínculos, datas, durações e
          resultados manuais do plano atual. Textos de reflexões, perguntas e
          respostas dos cartões ficam no dispositivo. Cada envio substitui a
          projeção desta conta.
        </p>
        <button
          className="primary"
          disabled={busy || !state || syncing}
          onClick={() =>
            run(async () => {
              await call('projection', 'PUT', {
                revision: state!.revision,
                facts: JSON.parse(serialized),
              })
              await refresh()
              say('Projeção atualizada.')
            })
          }
        >
          Compartilhar plano atual
        </button>
        <label className="inline-check">
          <input
            type="checkbox"
            disabled={!state}
            checked={syncing}
            onChange={(e) =>
              setSync(e.target.checked && state ? state.revision : null)
            }
          />
          Compartilhar alterações futuras enquanto a conta estiver conectada
          nesta aba
        </label>
        <button className="text-btn" onClick={() => run(refresh)}>
          Atualizar central
        </button>
      </Panel>
      <Panel title="Recomendações">
        {!notes.length && <p>Nenhuma recomendação disponível.</p>}
        {notes.map((n) => (
          <article className="history" key={n.id}>
            <strong>{n.details.reason}</strong>
            <p>
              {n.status} · prioridade {n.details.priority} ·{' '}
              {new Date(n.created).toLocaleDateString('pt-BR')}
            </p>
            <details>
              <summary>Evidências</summary>
              {n.details.evidence.map((id) => (
                <p key={id}>
                  {events.find((e) => e.id === id)?.kind ?? 'Registro anterior'}{' '}
                  · {id.slice(0, 12)}
                </p>
              ))}
            </details>
            <div className="actions-inline">
              {n.status === 'pendente' && (
                <>
                  <button
                    className="secondary"
                    onClick={() => run(() => decide(n, 'aceita'))}
                  >
                    Aceitar
                  </button>
                  <button onClick={() => run(() => decide(n, 'ignorada'))}>
                    Ignorar
                  </button>
                </>
              )}
              {!n.seen && (
                <button onClick={() => run(() => decide(n, 'lida'))}>
                  Marcar lida
                </button>
              )}
              {n.status === 'aceita' && (
                <button onClick={() => run(() => decide(n, 'concluída'))}>
                  Concluir
                </button>
              )}
              <a
                className="text-btn"
                href={
                  n.details.action === 'tutor'
                    ? '#inteligencia/tutor:' +
                      encodeURIComponent(n.details.concept)
                    : '#' + n.details.action
                }
              >
                {n.details.action === 'tutor'
                  ? 'Praticar com o Tutor'
                  : 'Abrir atividade'}
              </a>
            </div>
          </article>
        ))}
      </Panel>
      <Panel title="Resumo semanal">
        {reports.map((r) => (
          <details key={r.week}>
            <summary>
              Semana de {r.week} · {r.details.sessions} sessões ·{' '}
              {r.details.reviews} revisões
            </summary>
            <p>
              {r.details.correct} acertos em {r.details.reviews} tentativas.
              Objetivos trabalhados:{' '}
              {r.details.goals
                .map((id) => data.goals.find((g) => g.id === id)?.name ?? id)
                .join(', ') || 'nenhum'}
              . Próximas tarefas: {r.details.future.join(', ') || 'nenhuma'}.
            </p>
            {r.details.next.map((s) => (
              <p key={s}>{s}</p>
            ))}
          </details>
        ))}
      </Panel>
      {state && (
        <Panel title="Preferências">
          <PushControl />
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void run(async () => {
                await call('preferences', 'PUT', state.prefs)
                await refresh()
                say('Preferências salvas.')
              })
            }}
          >
            <label>
              <input
                type="checkbox"
                checked={state.prefs.enabled}
                onChange={(e) =>
                  set({
                    ...state,
                    prefs: { ...state.prefs, enabled: e.target.checked },
                  })
                }
              />{' '}
              Ativar notificações internas
            </label>
            {['prazos', 'prática', 'planejamento', 'progresso'].map((c) => (
              <label className="inline-check" key={c}>
                <input
                  type="checkbox"
                  checked={state.prefs.categories.includes(c)}
                  onChange={(e) =>
                    set({
                      ...state,
                      prefs: {
                        ...state.prefs,
                        categories: e.target.checked
                          ? [...state.prefs.categories, c]
                          : state.prefs.categories.filter((k) => k !== c),
                      },
                    })
                  }
                />
                {c}
              </label>
            ))}
            {(
              [
                ['quiet_start', 'Início do silêncio (hora)'],
                ['quiet_end', 'Fim do silêncio (hora)'],
                ['frequency_hours', 'Intervalo de reapresentação (horas)'],
                ['retention_days', 'Retenção do histórico (dias)'],
                ['daily_capacity', 'Atividades disponíveis por dia'],
                ['errors', 'Limiar de erros'],
                ['horizon', 'Antecedência dos prazos (dias)'],
              ] as const
            ).map(([k, label]) => (
              <Field key={k} label={label}>
                <input
                  required
                  type="number"
                  value={state.prefs[k]}
                  onChange={(e) =>
                    set({
                      ...state,
                      prefs: { ...state.prefs, [k]: Number(e.target.value) },
                    })
                  }
                />
              </Field>
            ))}
            <p>
              Fuso: {state.prefs.timezone}. Consumo registrado: {state.tokens}{' '}
              tokens.
            </p>
            <button className="primary" disabled={busy}>
              Salvar preferências
            </button>
          </form>
          <button
            className="text-btn"
            onClick={() => {
              if (
                confirm(
                  'Excluir permanentemente a conta, documentos e históricos do servidor?',
                )
              )
                void run(async () => {
                  await call('account', 'DELETE')
                  logout()
                })
            }}
          >
            Excluir conta e dados remotos
          </button>
        </Panel>
      )}
      <Panel title="Eventos recentes">
        {events.slice(0, 30).map((e) => (
          <p key={e.id}>
            {e.kind} · {new Date(e.occurred).toLocaleString('pt-BR')}
          </p>
        ))}
      </Panel>
    </div>
  )
}
