import { useEffect, useState } from 'react'
import { dayOf } from '../domain/dates'

export function useToday() {
  const [day,setDay] = useState(() => dayOf())
  useEffect(() => {
    let timer: number
    function refresh() {
      clearTimeout(timer)
      const now = new Date()
      setDay(dayOf(now))
      const midnight = new Date(now)
      midnight.setHours(24,0,0,0)
      timer = window.setTimeout(refresh,Math.max(1,midnight.getTime()-now.getTime()))
    }
    refresh()
    window.addEventListener('focus',refresh)
    return () => { clearTimeout(timer); window.removeEventListener('focus',refresh) }
  },[])
  return day
}
