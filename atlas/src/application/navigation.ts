import { useEffect, useState } from 'react'
export const pages = {
  painel: 'Visão geral',
  conhecimentos: 'Conhecimentos',
  agenda: 'Agenda',
  revisao: 'Flashcards',
  estudo: 'Modo de estudo',
  progresso: 'Progresso',
  inteligencia: 'Acompanhamento',
  tutor: 'Tutor',
  dados: 'Meus dados',
} as const
export type Page = keyof typeof pages
export function useRoute() {
  const [hash, set] = useState(location.hash)
  useEffect(() => {
    const sync = () => set(location.hash)
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  const [path, tab = ''] = hash.slice(1).split('/')
  if (
    path === 'inteligencia' &&
    (tab === 'tutor' || tab.startsWith('tutor:'))
  ) {
    return { page: 'tutor' as const, tab: tab.slice(6) }
  }
  return {
    page:
      path && Object.hasOwn(pages, path) ? (path as Page) : ('painel' as Page),
    tab,
  }
}
