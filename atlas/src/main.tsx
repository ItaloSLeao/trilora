import { createRoot } from 'react-dom/client'
import { WorkspaceProvider } from './application/workspace'
import { useRoute } from './application/navigation'
import { Shell } from './ui/Shell'
import { Knowledge } from './features/Knowledge'
import { Agenda } from './features/Agenda'
import './ui/base.css'
import './ui/calendar.css'

function App() {
  const { page, tab } = useRoute()
  return <Shell page={page}>{page === 'conhecimentos' ? <Knowledge tab={tab}/> : page === 'agenda' ? <Agenda/> : <h1>Meu espaço de estudo</h1>}</Shell>
}
createRoot(document.getElementById('root')!).render(<WorkspaceProvider><App/></WorkspaceProvider>)
