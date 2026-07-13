import { Routes, Route, Navigate } from 'react-router-dom'
import { Component, useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import AuthPage from './pages/AuthPage'
import AppShell from './pages/AppShell'

function LoadingScreen() {
  const [showHint, setShowHint] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShowHint(true), 4000)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="loading-screen" style={{ gap: 14 }}>
      <div className="spinner" />
      <div style={{ fontFamily: 'Bangers, cursive', fontSize: 18, letterSpacing: 2, color: 'var(--blue-l)' }}>
        PLUS ULTRA RPG
      </div>
      {showHint && (
        <button className="btn btn-g btn-sm" onClick={() => window.location.reload()}>
          Demorando? Recarregar
        </button>
      )}
    </div>
  )
}

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('App crashed:', error, info) }
  render() {
    if (this.state.error) {
      return (
        <div className="loading-screen" style={{ gap: 14, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div style={{ fontFamily: 'Bangers, cursive', fontSize: 18, letterSpacing: 1, color: 'var(--red-l)' }}>
            Algo deu errado
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 380 }}>
            {this.state.error?.message || 'Erro desconhecido'}
          </div>
          <button className="btn btn-p btn-lg" onClick={() => window.location.reload()}>🔄 Recarregar</button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const { session, loading } = useAuth()

  if (loading) return <LoadingScreen />

  return (
    <ErrorBoundary>
      <Routes>
        <Route
          path="/login"
          element={session ? <Navigate to="/" replace /> : <AuthPage />}
        />
        <Route
          path="/*"
          element={session ? <AppShell /> : <Navigate to="/login" replace />}
        />
      </Routes>
    </ErrorBoundary>
  )
}
