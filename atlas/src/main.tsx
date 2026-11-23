import { Intelligence } from './intelligence/Center'
import { RemoteProvider } from './intelligence/remote'
import { createRoot } from 'react-dom/client'
import { WorkspaceProvider } from './application/workspace'
import { useRoute } from './application/navigation'
import { Shell } from './ui/Shell'
import { Knowledge } from './features/Knowledge'
import { Agenda } from './features/Agenda'
import { ClockProvider } from './application/clock'
import { Flashcards } from './features/Flashcards'
import { Study } from './features/Study'
import { Dashboard } from './features/Dashboard'
import { Portability } from './features/Portability'
import { Progress } from './features/Progress'
import { useToday } from './application/today'
import './ui/base.css'
import './ui/dashboard.css'
import './ui/practice.css'
import './ui/calendar.css'

function App() {
  const { page, tab } = useRoute()
  const today = useToday()
  const views = {
    painel: <Dashboard today={today} />,
    conhecimentos: <Knowledge tab={tab} />,
    agenda: <Agenda />,
    revisao: <Flashcards tab={tab} />,
    estudo: <Study activityId={tab} />,
    progresso: <Progress today={today} />,
    inteligencia: <Intelligence tab={tab} />,
    dados: <Portability />,
  }
  return <Shell page={page}>{views[page]}</Shell>
}
createRoot(document.getElementById('root')!).render(
  <WorkspaceProvider>
    <ClockProvider>
      <RemoteProvider>
        <App />
      </RemoteProvider>
    </ClockProvider>
  </WorkspaceProvider>,
)
