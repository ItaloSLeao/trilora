import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  BookOpen,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ChevronRight,
  Compass,
  Database,
  FolderTree,
  Layers,
  LayoutDashboard,
  Map,
  Menu,
  MessagesSquare,
  UserRound,
  PanelLeftClose,
  ShieldCheck,
  Timer,
  type LucideIcon,
} from 'lucide-react'
import { useRemote } from '../intelligence/remote'
import { pages, type Page } from '../application/navigation'

const icons: Record<Page, LucideIcon> = {
  painel: LayoutDashboard,
  conhecimentos: FolderTree,
  agenda: CalendarDays,
  revisao: Layers,
  estudo: Timer,
  progresso: ChartNoAxesColumnIncreasing,
  inteligencia: Compass,
  tutor: MessagesSquare,
  biblioteca: BookOpen,
  perfil: UserRound,
  dados: Database,
}
const groups: { title: string; keys: Page[] }[] = [
  {
    title: 'Meu espaço',
    keys: ['painel', 'agenda', 'conhecimentos', 'inteligencia', 'biblioteca'],
  },
  {
    title: 'Aprendizagem',
    keys: ['revisao', 'estudo', 'progresso', 'tutor'],
  },
]
export function Shell({ page, children }: { page: Page; children: ReactNode }) {
  const { user } = useRemote()
  const [open, setOpen] = useState(false)
  const main = useRef<HTMLElement>(null)
  const previous = useRef(page)
  useEffect(() => {
    if (previous.current !== page) {
      main.current?.focus()
      window.scrollTo(0, 0)
      previous.current = page
    }
    document.title = pages[page] + ' · Trilora Atlas'
    setOpen(false)
  }, [page])
  const item = (key: Page) => {
    const Icon = icons[key]
    return (
      <a
        key={key}
        onClick={() => setOpen(false)}
        className="nav-link"
        aria-current={key === page ? 'page' : undefined}
        href={'#' + key}
      >
        <Icon size={19} />
        {pages[key]}
      </a>
    )
  }
  return (
    <div className="app">
      <a
        className="skip"
        href="#conteudo"
        onClick={(e) => {
          e.preventDefault()
          main.current?.focus()
        }}
      >
        Pular para o conteúdo
      </a>
      <aside className={'sidebar' + (open ? ' open' : '')}>
        <div className="brand-row">
          <a
            className="brand"
            href="#painel"
            aria-label="Trilora Atlas, início"
          >
            <span className="brand-mark">
              <Map size={26} strokeWidth={1.8} />
            </span>
            <strong>
              Trilora <em>Atlas</em>
            </strong>
          </a>
          <button
            className="mobile-menu icon-btn"
            aria-expanded={open}
            aria-controls="menu-atlas"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Fechar navegação' : 'Abrir navegação'}
          >
            {open ? <PanelLeftClose /> : <Menu />}
          </button>
        </div>
        <nav id="menu-atlas" aria-label="Principal">
          {groups.map((g) => (
            <div className="nav-group" key={g.title}>
              <p>{g.title}</p>
              {g.keys.map(item)}
            </div>
          ))}
          <div className="nav-bottom">
            {item('dados')}
            <div className="local">
              <ShieldCheck size={18} />
              <span>
                Espaço local<small>Neste navegador</small>
              </span>
            </div>
          </div>
        </nav>
      </aside>
      <div className="canvas">
        <header className="topbar">
          <div>
            <Compass size={17} />
            <span>Meu espaço</span>
            <ChevronRight size={14} />
            <strong>{pages[page]}</strong>
          </div>
          <a
            href="#perfil"
            className="profile-link"
            aria-label={user ? 'Abrir perfil de ' + user : 'Entrar no perfil'}
          >
            <span className="profile-avatar">
              <UserRound size={19} />
            </span>
            <span>{user || 'Entrar'}</span>
          </a>
        </header>
        <main
          className={page === 'tutor' ? 'chat-page' : undefined}
          id="conteudo"
          tabIndex={-1}
          ref={main}
        >
          {children}
        </main>
        <footer className="app-footer">
          <BookOpen size={15} /> Trilora Atlas
        </footer>
      </div>
    </div>
  )
}
