import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  label?: string
}

export function Modal({ open, onClose, children, className = '', label }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      role="presentation"
    >
      <div className={`modal-panel ${className}`} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function ModalHeader({
  title,
  subtitle,
  onClose,
  icon,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  icon?: ReactNode
}) {
  return (
    <header className="modal-header">
      <div className="modal-heading">
        {icon && <span className="modal-icon">{icon}</span>}
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      <button className="icon-btn" onClick={onClose} aria-label="关闭对话框">
        <X size={17} />
      </button>
    </header>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle${checked ? ' is-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-thumb" />
    </button>
  )
}

export function SettingRow({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="setting-row">
      <div className="setting-copy">
        <div className="setting-title">{title}</div>
        {description && <div className="setting-description">{description}</div>}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="segmented">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? 'is-active' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
