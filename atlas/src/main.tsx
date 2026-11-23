import { createRoot } from 'react-dom/client'
import { WorkspaceProvider } from './application/workspace'
import { useRoute } from './application/navigation'
import { Shell } from './ui/Shell'
import './ui/base.css'

function App() {
  const { page } = useRoute()
  return <Shell page={page}><h1>Meu espaço de estudo</h1></Shell>
}
createRoot(document.getElementById('root')!).render(<WorkspaceProvider><App/></WorkspaceProvider>)
