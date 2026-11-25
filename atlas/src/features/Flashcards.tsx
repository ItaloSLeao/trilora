import { useState } from 'react'
import { Layers, Pencil, Play, Plus } from 'lucide-react'
import { useWorkspace } from '../application/workspace'
import { dayOf, dateLabel } from '../domain/dates'
import { dueCards, lastReviews, rate } from '../domain/practice'
import { legacyHistory } from '../application/insights'
import { Editor, type EditorTarget } from '../ui/Editor'
import { Empty, Modal, PageTitle, Panel } from '../ui/components'

interface Round {
  id: string
  queue: string[]
  index: number
}
function Review({ initial, close }: { initial: Round; close: () => void }) {
  const { data, save, error } = useWorkspace()
  const [round, setRound] = useState(initial)
  const [revealed, show] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const card = data.cards.find((c) => c.id === round.queue[round.index])
  const attempts = data.reviews.filter((r) => r.round === round.id)
  const last = attempts.find((r) => r.card === card?.id)
  const correct = attempts.filter((r) => r.correct).length
  const grade = async (result: boolean) => {
    if (!card || busy || last) return
    setBusy(true)
    setFailed(
      !(await save(
        (d) => rate(d, card.id, round.id, revealed, result, Date.now()),
        'Tentativa salva.',
      )),
    )
    setBusy(false)
  }
  return (
    <Modal title={card ? 'Revisar cartões' : 'Resumo da revisão'} close={close}>
      {card ? (
        <>
          <p className="metadata">
            Cartão {round.index + 1} de {round.queue.length}
          </p>
          <h3 className="question">{card.question}</h3>
          {revealed ? (
            <div className="answer">
              <strong>Resposta</strong>
              <p>{card.answer}</p>
            </div>
          ) : (
            <p className="hint">
              Tente responder de memória antes de conferir.
            </p>
          )}
          {failed && error && <p role="alert">{error}</p>}
          {last ? (
            <>
              <p role="status" className="feedback">
                {last.correct
                  ? 'Você marcou um acerto.'
                  : 'Você sinalizou dificuldade. Releia a resposta e explique com suas palavras.'}{' '}
                Próxima revisão em {dateLabel(last.due, { dateStyle: 'long' })}.
              </p>
              <div className="actions">
                <button
                  autoFocus
                  className="primary"
                  onClick={() => {
                    setRound({ ...round, index: round.index + 1 })
                    show(false)
                    setFailed(false)
                  }}
                >
                  {round.index + 1 === round.queue.length
                    ? 'Ver resumo'
                    : 'Próximo cartão'}
                </button>
              </div>
            </>
          ) : (
            <div className="actions">
              {revealed ? (
                <>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => grade(false)}
                  >
                    Errei
                  </button>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => grade(true)}
                  >
                    Acertei
                  </button>
                </>
              ) : (
                <button className="primary" onClick={() => show(true)}>
                  Mostrar resposta
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <p>
            {attempts.length} tentativa(s) salva(s) · {correct} acerto(s) ·{' '}
            {attempts.length - correct} erro(s).
          </p>
          <p className="hint">
            As próximas datas estão disponíveis no histórico de cada cartão.
          </p>
          <div className="actions">
            <button className="primary" onClick={close}>
              Concluir revisão
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

export function Flashcards({ tab }: { tab: string }) {
  const { data } = useWorkspace()
  const [selected, select] = useState(tab)
  const [editor, edit] = useState<EditorTarget | null>(null)
  const [round, start] = useState<Round | null>(null)
  const [history, showHistory] = useState('')
  const today = dayOf()
  const deck = data.decks.find((d) => d.id === selected)
  const allDue = dueCards(data, today)
  const latest = lastReviews(data)
  const queue = (ids: string[]) =>
    start({ id: crypto.randomUUID(), queue: ids, index: 0 })
  const old = history
    ? legacyHistory(data).reviews.filter((r) => r.card === history)
    : []
  return (
    <>
      <PageTitle
        title="Flashcards"
        subtitle="Recupere de memória, confira sua resposta e programe a próxima revisão."
      >
        <button
          className="primary"
          onClick={() =>
            edit({ kind: data.subjects.length ? 'decks' : 'subjects' })
          }
        >
          <Plus size={17} />
          {data.subjects.length ? 'Novo baralho' : 'Nova disciplina'}
        </button>
      </PageTitle>
      <div className="stack">
        <Panel
          title="Revisão de hoje"
          action={<span className="badge">{allDue.length} pendentes</span>}
        >
          {allDue.length ? (
            <div className="actions-inline">
              <p>Há cartões novos ou com revisão prevista até hoje.</p>
              <button
                className="primary"
                onClick={() => queue(allDue.map((c) => c.id))}
              >
                <Play size={16} />
                Revisar pendentes
              </button>
            </div>
          ) : (
            <Empty>
              {data.cards.length
                ? 'Revisões em dia. Confira a próxima data no seu baralho.'
                : 'Crie um baralho e adicione perguntas para iniciar a revisão.'}
            </Empty>
          )}
        </Panel>
        <Panel title="Meus baralhos">
          {!data.decks.length && (
            <Empty>Seus baralhos serão organizados por disciplina.</Empty>
          )}
          {data.decks.map((group) => {
            const count = data.cards.filter((c) => c.deck === group.id).length
            return (
              <div key={group.id} className="list-row">
                <span className="icon-box lilac">
                  <Layers size={20} />
                </span>
                <div className="grow">
                  <strong>{group.name}</strong>
                  <small>
                    {data.subjects.find((s) => s.id === group.subject)?.name} ·{' '}
                    {count} cartão(ões)
                  </small>
                  {group.description && <small>{group.description}</small>}
                </div>
                <button
                  className="text-btn"
                  onClick={() => select(group.id)}
                  aria-pressed={deck?.id === group.id}
                >
                  Abrir
                </button>
                <button
                  className="icon-btn"
                  aria-label={'Editar ' + group.name}
                  onClick={() => edit({ kind: 'decks', id: group.id })}
                >
                  <Pencil size={16} />
                </button>
              </div>
            )
          })}
        </Panel>
        {deck && (
          <Panel
            title={deck.name}
            action={
              <button
                className="secondary"
                onClick={() => edit({ kind: 'cards', deck: deck.id })}
              >
                <Plus size={16} />
                Novo cartão
              </button>
            }
          >
            {data.cards
              .filter((c) => c.deck === deck.id)
              .map((c) => (
                <div className="list-row" key={c.id}>
                  <div className="grow">
                    <strong>{c.question}</strong>
                    <small>
                      {data.concepts.find((k) => k.id === c.concept)?.name ??
                        'Sem conceito'}{' '}
                      ·{' '}
                      {latest.has(c.id)
                        ? 'Revisar em ' + dateLabel(latest.get(c.id)!.due)
                        : 'Primeira revisão'}
                    </small>
                  </div>
                  <button
                    className="text-btn"
                    onClick={() => showHistory(c.id)}
                  >
                    Histórico
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={'Editar ' + c.question}
                    onClick={() => edit({ kind: 'cards', id: c.id })}
                  >
                    <Pencil size={16} />
                  </button>
                </div>
              ))}
            {!data.cards.some((c) => c.deck === deck.id) && (
              <Empty>Adicione a primeira pergunta deste baralho.</Empty>
            )}
          </Panel>
        )}
      </div>
      {editor && <Editor target={editor} close={() => edit(null)} />}
      {round && <Review initial={round} close={() => start(null)} />}
      {history && (
        <Modal title="Histórico do cartão" close={() => showHistory('')}>
          <h3>{data.cards.find((c) => c.id === history)?.question}</h3>
          {data.reviews
            .filter((r) => r.card === history)
            .reverse()
            .map((r) => (
              <p className="list-row" key={r.id}>
                {new Date(r.at).toLocaleString('pt-BR')} ·{' '}
                {r.correct ? 'Acerto' : 'Erro'} · Próxima em {dateLabel(r.due)}
              </p>
            ))}
          {old.map((r) => (
            <p className="list-row" key={r.id}>
              {dateLabel(dayOf(r.at))} · {r.correct ? 'Acerto' : 'Erro'} no
              Trilora original
            </p>
          ))}
          {!latest.has(history) && !old.length && (
            <Empty>Ainda sem tentativas.</Empty>
          )}
        </Modal>
      )}
    </>
  )
}
