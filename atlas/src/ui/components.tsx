import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X, type LucideIcon } from 'lucide-react'

export function Modal({
  title,
  children,
  close,
}: {
  title: string
  children: ReactNode
  close: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const label = useId()
  useEffect(() => {
    const previous = document.activeElement
    const dialog = ref.current
    dialog?.showModal()
    return () => {
      dialog?.close()
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby={label}
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
    >
      <div className="dialog-heading">
        <h2 id={label}>{title}</h2>
        <button className="icon-btn" onClick={close} aria-label="Fechar">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  )
}
export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>
}
export function PageTitle({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children?: ReactNode
}) {
  return (
    <header className="page-title">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {children}
    </header>
  )
}
export function Panel({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="panel">
      <header className="panel-heading">
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}
export function Metric({
  icon: Icon,
  tone,
  value,
  label,
}: {
  icon: LucideIcon
  tone: string
  value: string | number
  label: string
}) {
  return (
    <div className="metric">
      <span className={'icon-box ' + tone}>
        <Icon size={21} />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  )
}
export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}
export function Pick({
  label,
  value,
  set,
  rows,
  optional = false,
}: {
  label: string
  value: string
  set: (v: string) => void
  rows: { id: string; name: string }[]
  optional?: boolean
}) {
  return (
    <Field label={label}>
      <select
        required={!optional}
        value={value}
        onChange={(e) => set(e.target.value)}
      >
        <option value="">{optional ? 'Sem vínculo' : 'Selecione'}</option>
        {rows.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </Field>
  )
}
