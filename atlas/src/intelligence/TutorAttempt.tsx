import { useState } from 'react'
import { rate } from '../domain/practice'
import { useWorkspace } from '../application/workspace'
import { Panel, Field } from '../ui/components'

export function TutorAttempt({ id }: { id: string }) {
  const { data, save } = useWorkspace(),
    card = data.cards.find((c) => c.id === id)
  const [round] = useState(() => crypto.randomUUID()),
    [draft, setDraft] = useState(''),
    [revealed, reveal] = useState(false)
  const attempt = data.reviews.find((r) => r.round === round && r.card === id)
  if (!card) return null
  return (
    <Panel title="Praticar a questão aprovada">
      <strong>{card.question}</strong>
      <Field label="Sua tentativa (somente nesta tela)">
        <textarea
          maxLength={2000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </Field>
      {revealed ? (
        <>
          <p>{card.answer}</p>
          {attempt ? (
            <p role="status">
              Tentativa registrada. Próxima revisão em {attempt.due}.
            </p>
          ) : (
            <div className="actions-inline">
              {[false, true].map((correct) => (
                <button
                  className="secondary"
                  key={String(correct)}
                  onClick={() =>
                    save(
                      (d) => rate(d, id, round, true, correct, Date.now()),
                      'Autoavaliação salva.',
                    )
                  }
                >
                  {correct ? 'Registrar acerto' : 'Registrar erro'}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <button
          disabled={!draft.trim()}
          className="secondary"
          onClick={() => reveal(true)}
        >
          Conferir critério
        </button>
      )}
    </Panel>
  )
}
