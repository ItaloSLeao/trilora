import { useState } from 'react'
import { Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { useWorkspace } from '../application/workspace'
import { newLabel, removeSubject } from '../domain/catalog'
import type { Collection } from '../domain/model'
import { Editor, type EditorTarget } from '../ui/Editor'
import { Empty, Modal, PageTitle, Panel } from '../ui/components'

const sections = {
  subjects: 'Disciplinas',
  concepts: 'Conceitos',
  goals: 'Objetivos',
  activities: 'Atividades',
}
type Section = keyof typeof sections
export function Knowledge({ tab }: { tab: string }) {
  const kind = Object.hasOwn(sections, tab) ? (tab as Section) : 'subjects'
  const { data, save, error } = useWorkspace()
  const [editor, edit] = useState<EditorTarget | null>(null)
  const [deleting, remove] = useState('')
  const [failed, setFailed] = useState(false)
  const records = data[kind]
  const subjectName = (id: string) =>
    data.subjects.find((s) => s.id === id)?.name
  const goalName = (id: string) => data.goals.find((g) => g.id === id)?.name
  const create = (type: Collection) => edit({ kind: type })
  const available =
    kind === 'subjects' ||
    (kind === 'activities' ? data.goals.length > 0 : data.subjects.length > 0)
  const prerequisite =
    kind === 'activities' && data.subjects.length ? 'goals' : 'subjects'
  return (
    <>
      <PageTitle
        title="Conhecimentos"
        subtitle="Organize o que você quer aprender e como vai praticar."
      >
        <button
          className="primary"
          onClick={() => create(available ? kind : prerequisite)}
        >
          <Plus size={17} />
          {newLabel[available ? kind : prerequisite]}
        </button>
      </PageTitle>
      <nav className="tabs" aria-label="Cadastros">
        {Object.entries(sections).map(([key, label]) => (
          <a
            href={'#conhecimentos/' + key}
            aria-current={key === kind ? 'page' : undefined}
            key={key}
          >
            {label}
          </a>
        ))}
      </nav>
      <Panel
        title={sections[kind]}
        action={<span className="badge">{records.length}</span>}
      >
        {!records.length && (
          <Empty>
            {kind === 'subjects'
              ? 'Cadastre sua primeira disciplina para começar o plano.'
              : kind === 'concepts'
                ? 'Agrupe os conceitos da disciplina por unidade temática e indique o que estudar antes.'
                : kind === 'goals'
                  ? 'Escreva um objetivo observável, como resolver uma equação ou explicar um fenômeno.'
                  : 'Vincule uma atividade prática a um objetivo para usá-la no modo de estudo.'}
          </Empty>
        )}
        {records.map((item) => (
          <div className="list-row" key={item.id}>
            {'color' in item && (
              <span
                className="subject-dot"
                style={{ background: item.color }}
              />
            )}
            <div className="grow">
              <strong>{item.name}</strong>
              <small>
                {'unit' in item
                  ? [
                      subjectName(item.subject),
                      item.unit,
                      item.prerequisite
                        ? 'Requer ' +
                          data.concepts.find((c) => c.id === item.prerequisite)
                            ?.name
                        : 'Sem pré-requisito',
                    ].join(' · ')
                  : 'subject' in item
                    ? subjectName(item.subject)
                    : 'goal' in item
                      ? goalName(item.goal)
                      : `${data.concepts.filter((c) => c.subject === item.id).length} conceitos · ${data.goals.filter((c) => c.subject === item.id).length} objetivos`}
              </small>
            </div>
            {'done' in item && (
              <button
                className="text-btn"
                aria-pressed={item.done}
                onClick={() =>
                  save(
                    (d) => ({
                      ...d,
                      goals: d.goals.map((g) =>
                        g.id === item.id ? { ...g, done: !g.done } : g,
                      ),
                    }),
                    'Objetivo atualizado.',
                  )
                }
              >
                <Check size={15} />
                {item.done ? 'Concluído' : 'Concluir'}
              </button>
            )}
            <button
              className="icon-btn"
              aria-label={'Editar ' + item.name}
              onClick={() => edit({ kind, id: item.id })}
            >
              <Pencil size={16} />
            </button>
            {kind === 'subjects' && (
              <button
                className="icon-btn"
                aria-label={'Excluir ' + item.name}
                onClick={() => {
                  remove(item.id)
                  setFailed(false)
                }}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </Panel>
      {editor && <Editor target={editor} close={() => edit(null)} />}
      {deleting && (
        <Modal title="Excluir disciplina?" close={() => remove('')}>
          <p>
            A exclusão de <strong>{subjectName(deleting)}</strong> exige que
            seus vínculos tenham sido removidos.
          </p>
          {failed && <p role="alert">{error}</p>}
          <div className="actions">
            <button className="secondary" onClick={() => remove('')}>
              Cancelar
            </button>
            <button
              className="primary"
              onClick={async () => {
                if (
                  await save(
                    (d) => removeSubject(d, deleting),
                    'Disciplina excluída.',
                  )
                )
                  remove('')
                else setFailed(true)
              }}
            >
              Confirmar exclusão
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
