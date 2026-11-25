import { useState } from 'react'
import { useWorkspace } from '../application/workspace'
import { shiftDay, dateLabel } from '../domain/dates'
import { dueCards } from '../domain/practice'
import { Panel, Pick } from '../ui/components'
export function PracticeHistory({ today }: { today: string }) {
  const { data } = useWorkspace(),
    [concept, choose] = useState('')
  const rows = data.reviews.filter((r) => !concept || r.concept === concept)
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(today, i - 6))
  const buckets = days.map((day) => {
    const list = rows.filter((r) => r.day === day)
    return {
      day,
      total: list.length,
      correct: list.filter((r) => r.correct).length,
    }
  })
  const count = buckets.reduce((n, r) => n + r.total, 0),
    correct = buckets.reduce((n, r) => n + r.correct, 0)
  const pending = dueCards(data, today).filter(
    (c) => !concept || c.concept === concept,
  ).length
  return (
    <Panel title="Prática nos últimos sete dias">
      <Pick
        label="Filtrar por conceito"
        rows={data.concepts}
        optional
        value={concept}
        set={choose}
      />
      <p>
        {buckets.filter((b) => b.total).length} dias com prática · {pending}{' '}
        cartões pendentes.
      </p>
      {count ? (
        <>
          <p>
            {correct} acertos em {count} tentativas (
            {Math.round((100 * correct) / count)}% observados).
          </p>
          <ol className="bars">
            {buckets.map((b) => (
              <li key={b.day}>
                <span>{dateLabel(b.day)}</span>
                <span className="bar-track">
                  <i
                    style={{
                      width: (b.total ? (100 * b.correct) / b.total : 0) + '%',
                    }}
                  />
                </span>
                <span>
                  {b.correct}/{b.total}
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p>Nenhuma tentativa do Atlas neste período.</p>
      )}
      <p className="hint">
        Cada barra mostra acertos marcados pelo estudante divididos pelas
        tentativas daquele dia. O histórico importado do Trilora não registra o
        dia de cada tentativa.
      </p>
    </Panel>
  )
}
