import { useEffect, useState } from 'react'
import { useRemote, type Notice } from './remote'
import { Panel } from '../ui/components'
export function MonitorSummary() {
  const { user, call } = useRemote(),
    [rows, set] = useState<Notice[]>([]),
    [error, fail] = useState('')
  useEffect(() => {
    let live = true
    if (user)
      call<Notice[]>('notices')
        .then((r) => {
          if (live) set(r)
        })
        .catch(() => {
          if (live) fail('Monitor indisponível.')
        })
    return () => {
      live = false
    }
  }, [user, call])
  if (!user) return null
  return (
    <Panel
      title="Monitor acadêmico"
      action={<a href="#inteligencia">Abrir central</a>}
    >
      {error && <p role="status">{error}</p>}
      {rows
        .filter((n) => ['pendente', 'aceita'].includes(n.status))
        .slice(0, 3)
        .map((n) => (
          <p className="list-row" key={n.id}>
            {n.details.reason}
            <a
              className="text-btn"
              href={
                n.details.action === 'tutor'
                  ? '#tutor/' + encodeURIComponent(n.details.concept)
                  : '#' + n.details.action
              }
            >
              {n.details.action === 'tutor' ? 'Praticar com o Tutor' : 'Abrir'}
            </a>
          </p>
        ))}
      <small>
        {rows.filter((n) => n.status === 'aceita').length} recomendações aceitas
        nos registros exibidos.
      </small>
    </Panel>
  )
}
