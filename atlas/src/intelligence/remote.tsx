import { projection } from './projection'
import { useWorkspace } from '../application/workspace'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export interface Prefs {
  tutor_enabled: boolean
  enabled: boolean
  categories: string[]
  quiet_start: number
  quiet_end: number
  timezone: string
  frequency_hours: number
  retention_days: number
  horizon: number
  errors: number
  daily_capacity: number
}
export interface State {
  prefs: Prefs
  revision: number
  tokens: number
}
export interface Notice {
  id: string
  status: string
  seen: boolean
  created: string
  details: {
    reason: string
    priority: number
    category: string
    concept: string
    subject: string
    evidence: string[]
    action: string
  }
}
export interface Doc {
  id: string
  subject: string
  concept: string
  name: string
  status: string
  error: string
}
export interface Thread {
  id: string
  subject: string
  concept: string
  docs: string[]
  created: string
}
export interface Result {
  answer: string
  question: string
  expected: string
  choices: string[]
  sources: {
    id: string
    document: string
    ordinal: number
    page: number | null
    name: string
    body: string
  }[]
}
type Call = <T>(path: string, method?: string, body?: unknown) => Promise<T>
async function request<T>(
  auth: string,
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const file = body instanceof File
  const r = await fetch('/api/' + path, {
    method,
    headers: {
      Authorization: 'Basic ' + auth,
      'X-Atlas-Action': '1',
      ...(file ? {} : { 'Content-Type': 'application/json' }),
    },
    body: file ? body : body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    redirect: 'error',
  })
  if (
    !r.ok ||
    (r.status !== 204 &&
      !r.headers.get('content-type')?.includes('application/json'))
  ) {
    const info = await r.json().catch(() => null)
    throw new Error(
      typeof info?.detail === 'string'
        ? info.detail
        : 'Serviço indisponível ou solicitação inválida.',
    )
  }
  return r.status === 204 ? (undefined as T) : await r.json()
}
async function readStream(
  auth: string,
  path: string,
  payload: unknown,
  signal: AbortSignal,
  onDraft: (text: string) => void,
) {
  const res = await fetch('/api/' + path, {
    method: 'POST',
    redirect: 'error',
    signal,
    headers: {
      Authorization: 'Basic ' + auth,
      'X-Atlas-Action': '1',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok || !res.body) throw Error('Não foi possível iniciar a resposta.')
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let pending = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done)
        throw Error(
          'Resposta interrompida. Consulte o histórico antes de repetir.',
        )
      pending += value
      const lines = pending.split('\n')
      pending = lines.pop() ?? ''
      for (const line of lines) {
        const message = JSON.parse(line)
        if (message.error) throw Error(message.error)
        if (message.done) return
        if (typeof message.draft === 'string') onDraft(message.draft)
      }
    }
  } finally {
    reader.releaseLock()
  }
}
interface Remote {
  file: (id: string) => Promise<Blob>
  stream: (
    path: string,
    payload: unknown,
    signal: AbortSignal,
    onDraft: (text: string) => void,
  ) => Promise<void>
  syncing: boolean
  setSync: (revision: number | null) => void
  user: string
  call: Call
  login: (name: string, password: string) => Promise<void>
  logout: () => void
}
const RemoteContext = createContext<Remote | null>(null)
export const useRemote = () => useContext(RemoteContext)!
export function RemoteProvider({ children }: { children: ReactNode }) {
  const [session, set] = useState({ user: '', auth: '' })
  const call: Call = useCallback(
    (path, method, body) => request(session.auth, path, method, body),
    [session.auth],
  )
  const { data, report } = useWorkspace()
  const [syncing, setSyncing] = useState(false)
  const cursor = useRef<number | null>(null)
  const sequence = useRef(0)
  const queue = useRef(Promise.resolve())
  const facts = syncing ? JSON.stringify(projection(data)) : ''
  const setSync = (revision: number | null) => {
    sequence.current++
    cursor.current = revision
    setSyncing(revision !== null)
  }
  useEffect(() => {
    if (!syncing) return
    const version = sequence.current
    const id = setTimeout(() => {
      queue.current = queue.current.then(async () => {
        if (version !== sequence.current || cursor.current === null) return
        try {
          const result = await call<{ revision: number }>('projection', 'PUT', {
            revision: cursor.current,
            facts: JSON.parse(facts),
          })
          if (version === sequence.current) cursor.current = result.revision
        } catch (e) {
          if (version === sequence.current) {
            setSync(null)
            report(e)
          }
        }
      })
    }, 250)
    return () => clearTimeout(id)
  }, [syncing, facts, call, report])
  async function login(name: string, password: string) {
    const auth = btoa(
      String.fromCharCode(...new TextEncoder().encode(name + ':' + password)),
    )
    await request(auth, 'state')
    set({ user: name, auth })
  }
  return (
    <RemoteContext.Provider
      value={{
        user: session.user,
        call,
        login,
        stream: (path, payload, signal, onDraft) =>
          readStream(session.auth, path, payload, signal, onDraft),
        file: async (id) => {
          const response = await fetch(
            '/api/documents/' + encodeURIComponent(id) + '/file',
            {
              headers: { Authorization: 'Basic ' + session.auth },
              cache: 'no-store',
              redirect: 'error',
            },
          )
          if (
            !response.ok ||
            response.headers.get('content-type') !== 'application/octet-stream'
          )
            throw Error('Arquivo indisponível.')
          return response.blob()
        },
        syncing,
        setSync,
        logout: () => {
          setSync(null)
          set({ user: '', auth: '' })
        },
      }}
    >
      {children}
    </RemoteContext.Provider>
  )
}
export function useAction() {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no serviço.')
    } finally {
      setBusy(false)
    }
  }
  return { busy, run, error }
}
