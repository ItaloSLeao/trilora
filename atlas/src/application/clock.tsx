import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useWorkspace } from './workspace'
import { measured, updateActive, type Anchor } from '../domain/practice'
import type { Active } from '../domain/model'

interface Clock {
  elapsed: number
  running: boolean
  pending: boolean
  resume: (id: string, base: number) => void
  stop: (id: string, next?: Active['phase']) => Promise<boolean>
}
const Context = createContext<Clock | null>(null)
export const useClock = () => useContext(Context)!
export function ClockProvider({ children }: { children: ReactNode }) {
  const { data, save } = useWorkspace()
  const anchor = useRef<(Anchor & { id: string }) | null>(null)
  const frozen = useRef<{ id: string; elapsed: number; phase: Active['phase'] } | null>(null)
  const writing = useRef(false)
  const [, redraw] = useState(0)
  const active = data.active
  const resume = (id: string, base: number) => {
    if (frozen.current || anchor.current) return
    anchor.current = { id, base, start: performance.now() }
    redraw(n => n+1)
  }
  const stop = useCallback(async (id: string, phase: Active['phase'] = 'practice') => {
    if (active?.id !== id) return false
    const elapsed = frozen.current?.elapsed ?? (anchor.current?.id === id ? measured(anchor.current,performance.now()) : active.elapsedMs)
    const next = frozen.current?.phase ?? phase
    anchor.current = null
    const point = { id, elapsed, phase: next }
    frozen.current = point
    redraw(n => n+1)
    const ok = await save(d => updateActive(d,id,elapsed,next), next === 'reflect' ? 'Prática registrada. Complete a reflexão.' : 'Tempo salvo.')
    if (ok && frozen.current === point) frozen.current = null
    redraw(n => n+1)
    return ok
  },[active,save])
  useEffect(() => {
    const checkpoint = async () => {
      const point = anchor.current
      if (!point || writing.current) return
      const elapsed = measured(point,performance.now())
      writing.current = true
      const ok = await save(d => updateActive(d,point.id,elapsed))
      writing.current = false
      if (!ok && anchor.current === point) {
        anchor.current = null
        frozen.current = { id: point.id, elapsed: measured(point,performance.now()), phase:'practice' }
        redraw(n => n+1)
      }
    }
    const tick = window.setInterval(() => { if (anchor.current) redraw(n => n+1) }, 300)
    const interval = window.setInterval(checkpoint,5000)
    const hidden = () => { if (document.hidden) void checkpoint() }
    document.addEventListener('visibilitychange',hidden)
    window.addEventListener('pagehide',checkpoint)
    return () => { clearInterval(tick); clearInterval(interval); document.removeEventListener('visibilitychange',hidden); window.removeEventListener('pagehide',checkpoint) }
  },[save])
  const running = !!active && active.phase === 'practice' && anchor.current?.id === active.id
  const pending = !!active && frozen.current?.id === active.id
  const elapsed = running && anchor.current ? measured(anchor.current,performance.now()) : pending ? frozen.current!.elapsed : active?.elapsedMs ?? 0
  return <Context.Provider value={{ elapsed, running, pending, resume, stop }}>{children}</Context.Provider>
}
