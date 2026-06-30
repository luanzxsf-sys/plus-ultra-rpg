import { useState, useCallback, useEffect, useRef } from 'react'

let _show = null

export function useToast() {
  const [toasts, setToasts] = useState([])

  const show = useCallback((msg, type = 'info') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
  }, [])

  useEffect(() => { _show = show }, [show])

  return { toasts, show }
}

export function notify(msg, type = 'info') {
  if (_show) _show(msg, type)
}

export function ToastContainer() {
  const { toasts } = useToast()
  return (
    <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} className="toast" style={{
          borderColor: t.type === 'error' ? 'rgba(220,38,38,.4)' : t.type === 'success' ? 'rgba(22,163,74,.4)' : 'var(--glow)'
        }}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}
