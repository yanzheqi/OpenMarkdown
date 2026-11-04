import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { useStore } from '../store/store'

export default function Toasts() {
  const toasts = useStore((state) => state.toasts)
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? AlertCircle : Info
        return (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            <Icon size={15} />
            <span>{toast.message}</span>
            <button onClick={() => useStore.getState().dismissToast(toast.id)} aria-label="关闭提示">
              <X size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
