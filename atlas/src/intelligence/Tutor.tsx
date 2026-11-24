import { BookOpen, MessageCircle, Plus } from 'lucide-react'
import { ServiceLogin } from './Center'
import './tutor.css'
import { TutorAttempt } from './TutorAttempt'
import { useCallback, useEffect, useState, useRef } from 'react'
import { useWorkspace } from '../application/workspace'
import { Field, PageTitle, Panel, Pick } from '../ui/components'
import {
  useRemote,
  useAction,
  type Result,
  type Doc,
  type Thread,
} from './remote'

const maxDocumentBytes = 4 * 1024 * 1024

interface Message {
  id: number
  question: string
  result: Result
}
export function TutorPage({ tab }: { tab: string }) {
  const { user, logout } = useRemote()
  let conceptId = ''
  try {
    conceptId = decodeURIComponent(tab)
  } catch {
    /* A malformed bookmark opens the tutor without a concept. */
  }
  return (
    <>
      <PageTitle
        title="Tutor"
        subtitle="Converse sobre seus materiais de estudo."
      >
        {user && (
          <button className="secondary" onClick={logout}>
            Sair de {user}
          </button>
        )}
      </PageTitle>
      {user ? <Tutor conceptId={conceptId} /> : <ServiceLogin />}
    </>
  )
}

function Tutor({ conceptId }: { conceptId: string }) {
  const { data } = useWorkspace(),
    { call, stream, file: getFile } = useRemote(),
    { run, error, busy } = useAction()
  const upload = useAction()
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
  const [section, showSection] = useState<'chat' | 'library'>('chat')
  const [pendingQuestion, setPendingQuestion] = useState('')
  const [pollError, setPollError] = useState('')
  const uploadInput = useRef<HTMLInputElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  const transcript = useRef<HTMLDivElement>(null)
  const documentsRequest = useRef(0)
  const hasQueuedDocuments = docs.some(
    (d) => d.status === 'pendente' || d.status === 'processando',
  )

  const controller = useRef<AbortController | null>(null)
  const [provisional, preview] = useState('')
  useEffect(() => {
    const element = transcript.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages, pendingQuestion, provisional, section])

  const uploadSizeError = file && file.size > maxDocumentBytes
  const library = docs.filter((d) => d.subject === subject)
  const pendingDocuments = library.some((d) =>
    ['pendente', 'processando'].includes(d.status),
  )
  const readyDocuments = library.some(
    (d) =>
      d.status === 'pronto' &&
      (!concept || !d.concept || d.concept === concept),
  )
  let sourceHint = 'Envie um documento na biblioteca para começar.'
  if (selected.length > 8) sourceHint = 'Selecione no máximo oito documentos.'
  else if (selected.length)
    sourceHint = `${selected.length} documento(s) selecionado(s) para a pergunta.`
  else if (readyDocuments)
    sourceHint = 'Marque pelo menos um documento pronto na biblioteca.'
  else if (pendingDocuments)
    sourceHint =
      'Aguarde a indexação e marque o documento quando estiver pronto.'
  else if (uploadSizeError)
    sourceHint = 'Escolha um arquivo de até 4 MiB na biblioteca.'
  else if (library.length)
    sourceHint =
      'Selecione outro conceito ou confira o status dos documentos na biblioteca.'

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
  const refreshDocuments = useCallback(async () => {
    const request = ++documentsRequest.current
    const next = await call<Doc[]>('documents')
    if (request === documentsRequest.current) {
      setDocs(next)
      setPollError('')
    }
  }, [call])
  const refresh = async () => {
    const [, threads] = await Promise.all([
      refreshDocuments(),
      call<Thread[]>('conversations'),
    ])
    setThreads(threads)
  }
  useEffect(() => {
    void run(refresh)
  }, [call])
  useEffect(() => {
    if (!hasQueuedDocuments) return
    let active = true
    let timer: ReturnType<typeof setTimeout>
    const check = async () => {
      try {
        await refreshDocuments()
      } catch {
        if (active)
          setPollError(
            'Não foi possível atualizar a indexação. Tentaremos novamente.',
          )
      }
      if (active) timer = setTimeout(check, 4000)
    }
    timer = setTimeout(check, 4000)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [hasQueuedDocuments, refreshDocuments])
  const reset = (keepSources = false) => {
    practiceCard('')
    open('')
    history([])
    if (!keepSources) select([])
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
    setPendingQuestion(question)
    try {
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
            concept_name:
              data.concepts.find((c) => c.id === concept)?.name ?? '',
            subject_name:
              data.subjects.find((s) => s.id === subject)?.name ?? '',
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
      setThreads(await call<Thread[]>('conversations'))
    } finally {
      setPendingQuestion('')
    }
  }
  return (
    <div className="stack">
      <nav className="tabs tutor-tabs" aria-label="Área do tutor">
        <button
          type="button"
          aria-pressed={section === 'chat'}
          onClick={() => showSection('chat')}
        >
          Chat
        </button>
        <button
          type="button"
          aria-pressed={section === 'library'}
          onClick={() => showSection('library')}
        >
          Biblioteca de documentos
        </button>
      </nav>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {status && <p role="status">{status}</p>}
      {section === 'library' ? (
        <div className="stack">
          <Panel title="Classificação do documento">
            {' '}
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
          </Panel>
          <Panel title="Biblioteca de documentos">
            <p>
              O upload envia o arquivo ao servidor privado. O worker envia o
              texto ao modelo de embeddings configurado. Limite de 4 MiB por
              arquivo.
            </p>
            <Field label="PDF textual, DOCX, TXT ou Markdown">
              <input
                type="file"
                accept=".pdf,.docx,.txt,.md"
                ref={uploadInput}
                onChange={(e) => setFile(e.target.files?.[0])}
              />
            </Field>
            <button
              className="primary"
              disabled={
                !subject || !file || uploadSizeError || upload.busy || busy
              }
              onClick={() =>
                upload.run(async () => {
                  if (!file) return
                  await call(
                    'documents?' +
                      new URLSearchParams({
                        name: file.name,
                        subject,
                        concept,
                      }),
                    'POST',
                    file,
                  )
                  await refreshDocuments()
                  setFile(undefined)
                  if (uploadInput.current) uploadInput.current.value = ''
                  say('Arquivo recebido para indexação.')
                })
              }
            >
              Enviar e indexar
            </button>
            {uploadSizeError && (
              <p role="alert" className="error">
                O arquivo excede 4 MiB. Para usar um livro grande, envie um
                capítulo menor com texto selecionável.
              </p>
            )}
            {upload.error && (
              <p role="alert" className="error">
                {upload.error}
              </p>
            )}
            {upload.busy && <p role="status">Enviando documento…</p>}
            {pollError && <p role="status">{pollError}</p>}
            {library.map((d) => (
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
                    {d.status === 'pendente' && d.error
                      ? 'Aguardando nova tentativa'
                      : d.status === 'pendente'
                        ? 'Na fila'
                        : d.status === 'processando'
                          ? 'Gerando índice'
                          : d.status}{' '}
                    ·{' '}
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
        </div>
      ) : (
        <div className="tutor-layout">
          <aside
            className="tutor-history panel"
            aria-label="Histórico de conversas"
          >
            <h2>Conversas</h2>
            <button
              className="primary"
              disabled={busy}
              onClick={() => {
                reset(true)
                composer.current?.focus()
              }}
            >
              <Plus size={17} />
              Nova conversa
            </button>
            {!threads.length && (
              <p className="hint">
                Suas conversas aparecerão aqui depois da primeira pergunta.
              </p>
            )}
            {threads.map((t) => (
              <div className="list-row" key={t.id}>
                <button
                  className="tutor-history-link"
                  aria-current={thread === t.id}
                  disabled={busy}
                  onClick={() => run(() => choose(t))}
                >
                  <span>{t.title || 'Conversa sem mensagens'}</span>
                  <small>
                    {data.subjects.find((s) => s.id === t.subject)?.name ??
                      'Disciplina'}
                    {' · '}
                    {new Date(t.created).toLocaleDateString('pt-BR')}
                  </small>
                </button>
                <button
                  disabled={busy}
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
          </aside>
          <section className="tutor-chat panel" aria-label="Tutor contextual">
            <header className="tutor-chat-heading">
              <div>
                <h2>
                  {thread && messages.length
                    ? 'Conversa com o Tutor'
                    : 'Nova conversa'}
                </h2>
                <p className="hint">
                  {data.subjects.find((s) => s.id === subject)?.name ??
                    'Selecione uma disciplina'}
                </p>
              </div>
              <button
                className="secondary"
                onClick={() => showSection('library')}
              >
                <BookOpen size={17} />
                Biblioteca
              </button>
            </header>
            <details className="tutor-options">
              <summary>
                Contexto e documentos{' '}
                {selected.length > 0 && `(${selected.length})`}
              </summary>
              <fieldset disabled={busy}>
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

                {library
                  .filter(
                    (d) =>
                      d.status === 'pronto' &&
                      (!concept || !d.concept || concept === d.concept),
                  )
                  .map((d) => (
                    <label key={d.id} className="inline-check">
                      <input
                        type="checkbox"
                        checked={selected.includes(d.id)}
                        disabled={!!thread}
                        onChange={(e) =>
                          select(
                            e.target.checked
                              ? [...selected, d.id]
                              : selected.filter((id) => id !== d.id),
                          )
                        }
                      />
                      {d.name}
                    </label>
                  ))}
              </fieldset>
            </details>
            <div
              ref={transcript}
              className="tutor-transcript"
              aria-label="Mensagens da conversa"
              role="log"
              aria-busy={!!pendingQuestion}
              tabIndex={0}
            >
              {!messages.length && !pendingQuestion && (
                <div className="tutor-welcome">
                  <MessageCircle size={27} />
                  <strong>O que você quer estudar?</strong>
                  <p>Selecione um material e faça uma pergunta sobre ele.</p>
                </div>
              )}
              {messages.map((m) => (
                <article className="tutor-exchange" key={m.id}>
                  <div className="tutor-human">
                    <small>Você</small>
                    <p>{m.question}</p>
                  </div>
                  <div className="tutor-answer">
                    <small>Tutor</small>
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
                        <button
                          className="secondary"
                          onClick={() => edit(m.result)}
                        >
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
                              'documents/' +
                                s.document +
                                '/source/' +
                                s.ordinal,
                            )
                            setSource(
                              s.name +
                                ' · trecho ' +
                                s.ordinal +
                                ' — ' +
                                r.body,
                            )
                          })
                        }
                      >
                        {s.name} · {s.page ? 'p. ' + s.page + ' · ' : ''}trecho{' '}
                        {s.ordinal}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
              {pendingQuestion && (
                <div className="tutor-exchange">
                  <div className="tutor-human">
                    <small>Você</small>
                    <p>{pendingQuestion}</p>
                  </div>
                  <div className="tutor-answer">
                    <small>Tutor · elaborando resposta</small>
                    {provisional && <p>{provisional}</p>}
                  </div>
                </div>
              )}
            </div>
            {source && (
              <blockquote className="tutor-citation">{source}</blockquote>
            )}
            {pendingQuestion && controller.current && (
              <button
                className="text-btn"
                onClick={() => controller.current?.abort()}
              >
                Interromper resposta
              </button>
            )}
            <form
              className="tutor-composer"
              onSubmit={(e) => {
                e.preventDefault()
                void run(submit)
              }}
            >
              <details className="tutor-options">
                <summary>Modo e complexidade</summary>
                <Field label="Modo pedagógico">
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                  >
                    {['Explicar', 'Orientar', 'Praticar', 'Revisar'].map(
                      (s) => (
                        <option key={s}>{s}</option>
                      ),
                    )}
                  </select>
                </Field>
                <Field label="Complexidade">
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                  >
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
              </details>
              <Field label="Pergunta">
                <textarea
                  ref={composer}
                  placeholder="Pergunte sobre o material selecionado…"
                  rows={2}
                  required
                  minLength={2}
                  maxLength={2000}
                  value={question}
                  onChange={(e) => ask(e.target.value)}
                />
              </Field>
              <p className="hint tutor-privacy">
                Ao enviar, o modelo recebe a pergunta, o objetivo escolhido, os
                trechos recuperados e até três trocas anteriores. A pergunta e a
                resposta serão guardadas no histórico desta conversa.
              </p>
              <p id="tutor-source-hint" role="status" className="hint">
                {sourceHint}
              </p>
              <button
                aria-describedby="tutor-source-hint"
                disabled={busy || !selected.length || selected.length > 8}
                className="primary"
              >
                Enviar pergunta
              </button>
            </form>
          </section>
        </div>
      )}
      {section === 'chat' && practice && (
        <TutorAttempt key={practice} id={practice} />
      )}
      {section === 'chat' && draft && (
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
