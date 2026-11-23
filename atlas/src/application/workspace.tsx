import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Atlas } from '../domain/model'
import { AtlasRepository, errorMessage, type Snapshot } from '../infra/repository'

const repository = new AtlasRepository()
export type Save = (change: (data: Atlas) => Atlas, message?: string, backup?: boolean, expectedRevision?: number) => Promise<boolean>
interface Workspace {
  data: Atlas
  error: string
  revision: number
  save: Save
  backup: () => Promise<Atlas>
  report: (error: unknown) => void
}
const Context = createContext<Workspace | null>(null)
export function useWorkspace() {
  const context = useContext(Context)
  if (!context) throw new Error('Abra o espaço Atlas.')
  return context
}
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>()
  const current = useRef<Snapshot | undefined>(undefined)
  const queue = useRef(Promise.resolve())
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const report = useCallback((e: unknown) => { setNotice(''); setError(errorMessage(e)) }, [])
  useEffect(() => { repository.load().then(s => { current.current = s; setSnapshot(s) }).catch(report) }, [report])
  const save: Save = useCallback((change, message, backup, expected) => {
    const job = queue.current.then(async () => {
      if (!current.current) return false
      try {
        const next = await repository.write(expected ?? current.current.revision, change, backup)
        current.current = next
        setSnapshot(next)
        if (message) { setError(''); setNotice(message) }
        return true
      } catch (err) { report(err); return false }
    })
    queue.current = job.then(() => {})
    return job
  }, [report])
  return <>
    {error && <div className="global-alert" role="alert">{error} <button onClick={() => setError('')} aria-label="Fechar aviso">×</button></div>}
    <div className={notice ? 'toast' : 'sr-only'} role="status">{notice}{notice && <button onClick={() => setNotice('')} aria-label="Fechar confirmação">×</button>}</div>
    {snapshot ? <Context.Provider value={{ ...snapshot, error, save, report, backup: () => repository.backup() }}>{children}</Context.Provider>
      : <main className="boot"><h1>Trilora Atlas</h1>{error ? <><p>Não foi possível abrir o espaço de estudo.</p><button onClick={() => location.reload()}>Tentar novamente</button></> : <p role="status">Abrindo seu espaço de estudo…</p>}</main>}
  </>
}
