import { useState } from 'react'
import { ArchiveRestore, Download, FileUp, Save } from 'lucide-react'
import { useWorkspace } from '../application/workspace'
import { legacyHistory, totals } from '../application/insights'
import { dayOf, duration } from '../domain/dates'
import { requireRule, type Atlas } from '../domain/model'
import { readLegacy } from '../infra/legacy'
import { decode, download, encode } from '../infra/portable'
import { Field, Modal, PageTitle, Panel } from '../ui/components'

export function Portability() {
  const { data,revision,save,error,report,backup } = useWorkspace()
  const [preview,show] = useState<{ data:Atlas; revision:number } | null>(null)
  const [busy,setBusy] = useState(false)
  const [failed,setFailed] = useState(false)
  const [message,announce] = useState('')
  const old = legacyHistory(data)
  const exportFile = (d: Atlas, name='atlas') => { download(encode(d),name+'-'+dayOf()+'.json'); announce('Arquivo preparado para download.') }
  const check = async (read: () => Promise<Atlas> | Atlas) => {
    try {
      requireRule(!data.active, 'Conclua a sessão atual antes de importar dados.')
      const incoming = await read()
      setFailed(false)
      show({data:incoming,revision})
    } catch (err) { report(err) }
  }
  return <><PageTitle title="Meus dados" subtitle="Guarde uma cópia do seu espaço e traga registros de outra instalação."/><div className="stack">
    <Panel title="Exportar Atlas"><p className="hint">O arquivo JSON inclui disciplinas, cartões, tentativas, sessões e reflexões. Guarde-o em um local de sua confiança.</p><div className="study-actions actions-inline"><button className="primary" onClick={() => exportFile(data)}><Download size={16}/>Exportar dados</button><button className="secondary" onClick={async () => { try { exportFile(await backup(),'atlas-anterior') } catch (e) { report(e) } }}><Save size={16}/>Baixar cópia anterior à importação</button></div></Panel>
    <Panel title="Importar arquivo"><p className="hint">Selecione uma exportação do Atlas ou uma cópia JSON de trilora-v1. Confira o conteúdo antes de confirmar.</p><Field label="Arquivo JSON"><input type="file" accept=".json,application/json" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void check(async () => decode(await file.text())) }}/></Field></Panel>
    <Panel title="Trazer dados do Trilora original"><p className="hint">A leitura busca a chave trilora-v1 neste navegador, no mesmo endereço e porta. Para outra origem, importe o arquivo JSON acima.</p><div className="study-actions"><button className="secondary" onClick={() => check(() => readLegacy())}><ArchiveRestore size={16}/>Ler Trilora original</button></div>
    {data.legacySource !== null && <div className="legacy-note"><p>Cópia integral disponível · {old.reviews.length} avaliações e {old.sessions.length} sessões de tempo importadas.</p>{old.active && <p>Cronômetro legado interrompido · {duration(old.active.segments.reduce((s,p) => s+p.end-p.start,0))} confirmados. O rascunho continua disponível na origem e nesta cópia.</p>}<button className="text-btn" onClick={() => download(data.legacySource!,'trilora-v1-original.json')}>Baixar JSON original</button></div>}</Panel>
    <p aria-live="polite">{message}</p></div>
    {preview && <Modal title="Confirmar importação" close={() => { if (!busy) show(null) }}><p>O arquivo contém {preview.data.subjects.length} disciplina(s), {preview.data.tasks.length} tarefa(s), {preview.data.cards.length} cartão(ões), {totals(preview.data).attempts} tentativa(s) e {totals(preview.data).sessions} sessão(ões) concluída(s).</p>
    <p className="feedback">{revision ? 'Confirmar substituirá os registros atuais do Atlas. A cópia anterior ficará disponível para download e substituirá a cópia de segurança mais antiga.' : 'Confirmar criará seu espaço com os registros acima.'} A chave trilora-v1 será preservada.</p>
    {failed && <p role="alert">{error}</p>}<div className="actions"><button className="secondary" disabled={busy} onClick={() => show(null)}>Cancelar</button><button className="primary" disabled={busy} onClick={async () => {
      setBusy(true)
      const ok = await save(current => { requireRule(!current.active,'Conclua a sessão atual antes de importar.'); return preview.data },'Importação concluída.',true,preview.revision)
      setBusy(false)
      if (ok) show(null)
      else setFailed(true)
    }}><FileUp size={16}/>Confirmar importação</button></div></Modal>}</>
}
