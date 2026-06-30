import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import AuthPage from './pages/AuthPage'
import AppShell from './pages/AppShell'

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="spinner" />
      <div style={{ fontFamily: 'Bangers, cursive', fontSize: 18, letterSpacing: 2, color: 'var(--blue-l)' }}>
        PLUS ULTRA RPG
      </div>
    </div>
  )
}

export default function App() {
  const { session, loading } = useAuth()

  if (loading) return <LoadingScreen />

  return (
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
  )
}
