import { TutorAttempt } from './TutorAttempt'
import { useEffect, useState, useRef } from 'react'
import { useWorkspace } from '../application/workspace'
import { Field, Panel, Pick } from '../ui/components'
import {
  useRemote,
  useAction,
  type Result,
  type Doc,
  type Thread,
} from './remote'

interface Message {
  id: number
  question: string
  result: Result
}
export function Tutor({ conceptId }: { conceptId: string }) {
  const { data } = useWorkspace(),
    { call, stream, file: getFile } = useRemote(),
    { run, error, busy } = useAction()
  const [subject, subjectSet] = useState(
      data.concepts.find((c) => c.id === conceptId)?.subject ??
        data.subjects[0]?.id ??
        '',
    ),
    [concept, conceptSet] = useState(conceptId)
  const [docs, setDocs] = useState<Doc[]>([]),
    [threads, setThreads] = useState<Thread[]>([]),
    [selected, select] = useState<string[]>([]),
    [thread, open] = useState(''),
    [messages, history] = useState<Message[]>([])
  const [file, setFile] = useState<File>(),
    [question, ask] = useState(''),
    [mode, setMode] = useState(conceptId ? 'Praticar' : 'Explicar'),
    [goal, setGoal] = useState(''),
    [level, setLevel] = useState('Inicial'),
    [solution, solve] = useState(false),
    [general, mix] = useState(false)
  const [source, setSource] = useState(''),
    [draft, edit] = useState<Result>(),
    [status, say] = useState('')
  const [practice, practiceCard] = useState('')
  const controller = useRef<AbortController | null>(null)
  const [provisional, preview] = useState('')
  useEffect(() => () => controller.current?.abort(), [])
  async function downloadDocument(d: Doc) {
    const blob = await getFile(d.id)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = d.name
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }
  const refresh = async () => {
    const [d, t] = await Promise.all([
      call<Doc[]>('documents'),
      call<Thread[]>('conversations'),
    ])
    setDocs(d)
    setThreads(t)
  }
  useEffect(() => {
    void run(refresh)
  }, [call])
  useEffect(() => {
    if (!docs.some((d) => ['pendente', 'processando'].includes(d.status)))
      return
    const id = setTimeout(() => void run(refresh), 4000)
    return () => clearTimeout(id)
  }, [docs])
  const reset = () => {
    practiceCard('')
    open('')
    history([])
    select([])
    edit(undefined)
    setSource('')
    ask('')
  }
  const choose = async (t: Thread) => {
    const msgs = await call<Message[]>('conversations/' + t.id + '/messages')
    reset()
    subjectSet(t.subject)
    conceptSet(t.concept)
    setGoal('')
    select(t.docs)
    open(t.id)
    history(msgs)
  }
  const submit = async () => {
    let key = thread
    if (!key) {
      const t = await call<{ id: string }>('conversations', 'POST', {
        subject,
        concept,
        docs: selected,
      })
      key = t.id
      open(key)
      await refresh()
    }
    controller.current = new AbortController()
    try {
      await stream(
        'conversations/' + key + '/stream',
        {
          question,
          mode,
          solution,
          general,
          complexity: level,
          concept_name: data.concepts.find((c) => c.id === concept)?.name ?? '',
          subject_name: data.subjects.find((s) => s.id === subject)?.name ?? '',
          objective: data.goals.find((g) => g.id === goal)?.name ?? '',
        },
        controller.current.signal,
        preview,
      )
    } finally {
      controller.current = null
      preview('')
    }
    history(await call<Message[]>('conversations/' + key + '/messages'))
    ask('')
  }
  return (
    <div className="stack">
      {error && <p role="alert">{error}</p>}
      <p role="status">{busy ? 'Processando…' : status}</p>
      {controller.current && (
        <aside>
          <small>Resposta em elaboração · fontes em verificação</small>
          <p>{provisional}</p>
          <button onClick={() => controller.current?.abort()}>
            Interromper resposta
          </button>
        </aside>
      )}
      <fieldset disabled={busy}>
        <legend>Contexto autorizado</legend>
        <Pick
          label="Disciplina do tutor"
          rows={data.subjects}
          value={subject}
          set={(v) => {
            reset()
            subjectSet(v)
            conceptSet('')
            setGoal('')
          }}
        />
        <Pick
          label="Conceito do tutor"
          optional
          rows={data.concepts.filter((c) => c.subject === subject)}
          value={concept}
          set={(v) => {
            reset()
            conceptSet(v)
          }}
        />
        <Pick
          label="Objetivo compartilhado"
          optional
          rows={data.goals.filter((g) => g.subject === subject)}
          value={goal}
          set={setGoal}
        />
      </fieldset>
      <Panel title="Biblioteca de documentos">
        <p>
          O upload envia o arquivo ao servidor privado. O worker envia o texto
          ao modelo de embeddings configurado. Limite de 4 MiB por arquivo.
        </p>
        <Field label="PDF textual, DOCX, TXT ou Markdown">
          <input
            type="file"
            accept=".pdf,.docx,.txt,.md"
            onChange={(e) => setFile(e.target.files?.[0])}
          />
        </Field>
        <button
          className="primary"
          disabled={!subject || !file || busy}
          onClick={() =>
            run(async () => {
              if (!file) return
              await call(
                'documents?' +
                  new URLSearchParams({ name: file.name, subject, concept }),
                'POST',
                file,
              )
              await refresh()
              say('Arquivo recebido para indexação.')
            })
          }
        >
          Enviar e indexar
        </button>
        {docs
          .filter((d) => d.subject === subject)
          .map((d) => (
            <div className="list-row" key={d.id}>
              <label className="grow">
                <input
                  type="checkbox"
                  checked={selected.includes(d.id)}
                  disabled={
                    d.status !== 'pronto' ||
                    !!thread ||
                    (!!concept && !!d.concept && concept !== d.concept)
                  }
                  onChange={(e) =>
                    select(
                      e.target.checked
                        ? [...selected, d.id]
                        : selected.filter((k) => k !== d.id),
                    )
                  }
                />{' '}
                {d.name}
                <small>
                  {d.status} ·{' '}
                  {data.concepts.find((c) => c.id === d.concept)?.name ??
                    'Disciplina'}{' '}
                  {d.error}
                </small>
              </label>
              <button
                className="text-btn"
                onClick={() => run(() => downloadDocument(d))}
              >
                Baixar original
              </button>
              {d.status === 'falhou' && (
                <button
                  onClick={() =>
                    run(async () => {
                      await call('documents/' + d.id + '/retry', 'POST')
                      await refresh()
                    })
                  }
                >
                  Reprocessar
                </button>
              )}
              <button
                onClick={() => {
                  if (
                    confirm(
                      'Excluir documento, fragmentos e conversas associadas?',
                    )
                  )
                    void run(async () => {
                      await call('documents/' + d.id, 'DELETE')
                      reset()
                      await refresh()
                    })
                }}
              >
                Excluir
              </button>
            </div>
          ))}
      </Panel>
      <Panel title="Conversas">
        <button className="secondary" onClick={reset}>
          Nova conversa
        </button>
        {threads.map((t) => (
          <div className="list-row" key={t.id}>
            <button className="text-btn" onClick={() => run(() => choose(t))}>
              {data.subjects.find((s) => s.id === t.subject)?.name ??
                'Disciplina'}{' '}
              · {new Date(t.created).toLocaleString('pt-BR')}
            </button>
            <button
              onClick={() => {
                if (confirm('Excluir esta conversa?'))
                  void run(async () => {
                    await call('conversations/' + t.id, 'DELETE')
                    if (thread === t.id) reset()
                    await refresh()
                  })
              }}
            >
              Excluir conversa
            </button>
          </div>
        ))}
      </Panel>
      <Panel title="Tutor contextual">
        {messages.map((m) => (
          <article className="history" key={m.id}>
            <strong>{m.question}</strong>
            <p>{m.result.answer}</p>
            {m.result.question && (
              <>
                <p>{m.result.question}</p>
                <ul>
                  {m.result.choices.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <details>
                  <summary>Critério de resposta</summary>
                  {m.result.expected}
                </details>
                <button className="secondary" onClick={() => edit(m.result)}>
                  Revisar para flashcard
                </button>
              </>
            )}
            {m.result.sources.map((s) => (
              <button
                className="text-btn"
                key={s.id}
                onClick={() =>
                  run(async () => {
                    const r = await call<{ body: string }>(
                      'documents/' + s.document + '/source/' + s.ordinal,
                    )
                    setSource(
                      s.name + ' · trecho ' + s.ordinal + ' — ' + r.body,
                    )
                  })
                }
              >
                {s.name} · {s.page ? 'p. ' + s.page + ' · ' : ''}trecho{' '}
                {s.ordinal}
              </button>
            ))}
          </article>
        ))}
        {source && <blockquote>{source}</blockquote>}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void run(submit)
          }}
        >
          <Field label="Modo pedagógico">
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              {['Explicar', 'Orientar', 'Praticar', 'Revisar'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Complexidade">
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              {['Inicial', 'Intermediária', 'Avançada'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          {mode === 'Orientar' && (
            <label className="inline-check">
              <input
                type="checkbox"
                checked={solution}
                onChange={(e) => solve(e.target.checked)}
              />
              Solicitar solução completa
            </label>
          )}
          <label className="inline-check">
            <input
              type="checkbox"
              checked={general}
              onChange={(e) => mix(e.target.checked)}
            />
            Permitir conhecimento geral identificado na resposta
          </label>
          <Field label="Pergunta">
            <textarea
              required
              minLength={2}
              maxLength={2000}
              value={question}
              onChange={(e) => ask(e.target.value)}
            />
          </Field>
          <p>
            Ao enviar, o modelo recebe a pergunta, o objetivo escolhido, os
            trechos recuperados e até três trocas anteriores. Selecione até oito
            documentos prontos. A pergunta e a resposta serão guardadas no
            histórico desta conversa.
          </p>
          <button
            disabled={busy || !selected.length || selected.length > 8}
            className="primary"
          >
            Enviar pergunta
          </button>
        </form>
      </Panel>
      {practice && <TutorAttempt key={practice} id={practice} />}
      {draft && (
        <ApprovedCard
          key={draft.question}
          draft={draft}
          subject={subject}
          concept={concept}
          close={(id) => {
            practiceCard(id)
            edit(undefined)
            say('Cartão salvo no Atlas.')
          }}
        />
      )}
    </div>
  )
}
function ApprovedCard({
  draft,
  subject,
  concept,
  close,
}: {
  draft: Result
  subject: string
  concept: string
  close: (id: string) => void
}) {
  const { data, save } = useWorkspace(),
    decks = data.decks.filter((d) => d.subject === subject)
  const [deck, setDeck] = useState(decks[0]?.id ?? ''),
    [question, setQ] = useState(draft.question),
    [answer, setA] = useState(draft.expected)
  return (
    <Panel title="Conferir antes de salvar">
      <Pick
        label="Baralho de destino"
        rows={decks}
        value={deck}
        set={setDeck}
      />
      {!decks.length && <a href="#revisao">Cadastrar baralho</a>}
      <Field label="Pergunta revisada">
        <textarea
          maxLength={500}
          value={question}
          onChange={(e) => setQ(e.target.value)}
        />
      </Field>
      <Field label="Resposta revisada">
        <textarea
          maxLength={2000}
          value={answer}
          onChange={(e) => setA(e.target.value)}
        />
      </Field>
      <button
        className="primary"
        disabled={!deck || !question.trim() || !answer.trim()}
        onClick={async () => {
          const card = {
            id: crypto.randomUUID(),
            deck,
            concept: concept || null,
            question,
            answer,
          }
          if (
            await save(
              (d) => ({ ...d, cards: [...d.cards, card] }),
              'Cartão aprovado e salvo.',
            )
          )
            close(card.id)
        }}
      >
        Aprovar e salvar flashcard
      </button>
      <a className="text-btn" href="#revisao">
        Praticar e registrar tentativa
      </a>
    </Panel>
  )
}
