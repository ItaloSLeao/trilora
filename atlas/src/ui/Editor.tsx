import { useState, type FormEvent } from 'react'
import { draftFor, labels, newLabel, storeEntity, type Draft } from '../domain/catalog'
import type { Collection } from '../domain/model'
import { useWorkspace } from '../application/workspace'
import { Field, Modal, Pick } from './components'

export interface EditorTarget { kind: Collection; id?: string; deck?: string }
export function Editor({ target: { kind, id, deck }, close }: { target: EditorTarget; close: () => void }) {
  const { data, save, error } = useWorkspace()
  const [f, set] = useState(() => {
    const value = draftFor(data, kind, id)
    return deck ? { ...value, deck } : value
  })
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const put = <K extends keyof Draft>(k: K, v: Draft[K]) => set(old => ({ ...old, [k]: v }))
  const subject = kind === 'cards' ? data.decks.find(d => d.id === f.deck)?.subject : f.subject
  const concepts = data.concepts.filter(c => c.subject === subject && c.id !== id)
  const goals = data.goals.filter(g => g.subject === subject)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    const key = id ?? crypto.randomUUID()
    const ok = await save(d => storeEntity(d, kind, key, f), 'Alterações salvas.')
    setBusy(false)
    if (ok) close()
    else setFailed(true)
  }
  return <Modal title={id ? 'Editar ' + labels[kind] : newLabel[kind]} close={close}>
    <form onSubmit={submit}>
      {kind !== 'cards' && <Field label={kind === 'goals' ? 'O que você quer conseguir fazer?' : 'Nome'}><input required minLength={2} maxLength={160} value={f.name} onChange={e => put('name', e.target.value)} placeholder={kind === 'goals' ? 'Ex.: Explicar as etapas da mitose' : undefined}/></Field>}
      {kind === 'subjects' && <Field label="Cor da disciplina"><input type="color" value={f.color} onChange={e => put('color',e.target.value)}/></Field>}
      {['concepts','goals','tasks','decks'].includes(kind) && <Pick label="Disciplina" rows={data.subjects} value={f.subject} set={v => set({ ...f, subject: v, goal: '', prerequisite: '' })}/>}
      {kind === 'concepts' && <><Field label="Unidade temática"><input required minLength={2} maxLength={160} value={f.unit} onChange={e => put('unit',e.target.value)}/></Field><Pick label="Pré-requisito (opcional)" optional rows={concepts} value={f.prerequisite} set={v => put('prerequisite',v)}/></>}
      {kind === 'activities' && <Pick label="Objetivo" rows={data.goals} value={f.goal} set={v => put('goal',v)}/>}
      {kind === 'tasks' && <><Pick label="Objetivo (opcional)" optional rows={goals} value={f.goal} set={v => put('goal',v)}/><Field label="Prazo"><input required type="date" min="0001-01-01" max="9999-12-31" value={f.date} onChange={e => put('date',e.target.value)}/></Field><Field label="Prioridade"><select value={f.priority} onChange={e => put('priority',e.target.value as Draft['priority'])}>{['Alta','Média','Baixa'].map(p => <option key={p}>{p}</option>)}</select></Field></>}
      {kind === 'decks' && <Field label="Descrição (opcional)"><textarea maxLength={2000} value={f.description} onChange={e => put('description',e.target.value)}/></Field>}
      {kind === 'cards' && <><Pick label="Baralho" rows={data.decks} value={f.deck} set={v => set({ ...f, deck: v, concept: '' })}/><Pick label="Conceito (opcional)" optional rows={concepts} value={f.concept} set={v => put('concept',v)}/><Field label="Pergunta"><textarea required maxLength={500} value={f.question} onChange={e => put('question',e.target.value)}/></Field><Field label="Resposta"><textarea required maxLength={2000} value={f.answer} onChange={e => put('answer',e.target.value)}/></Field></>}
      {failed && error && <p role="alert" className="error">{error}</p>}
      <footer className="actions"><button type="button" className="secondary" onClick={close}>Cancelar</button><button className="primary" disabled={busy}>Salvar</button></footer>
    </form>
  </Modal>
}
