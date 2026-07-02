import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signUpAccount, signIn } from '../lib/supabase'

function LoginForm({ onSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    const { error: err } = await signIn({ email, password })
    setLoading(false)
    if (err) {
      setError(
        err.message.includes('Invalid login') ? 'E-mail ou senha incorretos.' :
        err.message.includes('Email not confirmed') ? 'Confirme seu e-mail antes de entrar.' :
        err.message
      )
    } else { onSuccess() }
  }

  return (
    <form onSubmit={handleLogin}>
      {error && <div className="auth-error">⚠️ {error}</div>}
      <div className="field">
        <label>E-mail</label>
        <input className="input" type="email" placeholder="seu@email.com" value={email}
          onChange={e => setEmail(e.target.value)} required autoComplete="email" />
      </div>
      <div className="field">
        <label>Senha</label>
        <input className="input" type="password" placeholder="••••••••" value={password}
          onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
      </div>
      <button className="btn btn-p btn-full btn-lg" type="submit" disabled={loading} style={{ marginTop: 8 }}>
        {loading ? '⏳ Entrando...' : '⚡ Entrar'}
      </button>
    </form>
  )
}

function RegisterForm() {
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setError('') }

  async function handleRegister(e) {
    e.preventDefault()
    if (!form.username.trim()) return setError('Nome de usuário obrigatório.')
    if (form.username.length < 3) return setError('Usuário deve ter no mínimo 3 caracteres.')
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) return setError('Usuário: apenas letras, números e _')
    if (form.password.length < 6) return setError('Senha deve ter no mínimo 6 caracteres.')
    if (form.password !== form.confirm) return setError('As senhas não coincidem.')
    setLoading(true)
    const { error: err } = await signUpAccount({ email: form.email, password: form.password, username: form.username })
    setLoading(false)
    if (err) {
      setError(err.message.includes('already registered') ? 'Este e-mail já está cadastrado.' : err.message)
    } else {
      setSuccess('✅ Conta criada! Verifique seu e-mail para confirmar e depois faça login.')
    }
  }

  if (success) return (
    <div>
      <div className="auth-success">{success}</div>
      <button className="btn btn-g btn-full" onClick={() => window.location.reload()}>← Ir para o Login</button>
    </div>
  )

  return (
    <form onSubmit={handleRegister}>
      {error && <div className="auth-error">⚠️ {error}</div>}
      <div className="field">
        <label>Nome de usuário</label>
        <input className="input" type="text" placeholder="seu_nick" value={form.username}
          onChange={e => set('username', e.target.value)} required />
        <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 4 }}>Apenas letras, números e _. Será exibido para todos.</div>
      </div>
      <div className="field">
        <label>E-mail</label>
        <input className="input" type="email" placeholder="seu@email.com" value={form.email}
          onChange={e => set('email', e.target.value)} required />
      </div>
      <div className="field">
        <label>Senha</label>
        <input className="input" type="password" placeholder="Mínimo 6 caracteres" value={form.password}
          onChange={e => set('password', e.target.value)} required minLength={6} />
      </div>
      <div className="field">
        <label>Confirmar senha</label>
        <input className="input" type="password" placeholder="Repita a senha" value={form.confirm}
          onChange={e => set('confirm', e.target.value)} required />
      </div>
      <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 12, padding: '8px 10px', background: 'rgba(37,99,235,.08)', borderRadius: 6, border: '1px solid rgba(37,99,235,.2)' }}>
        ℹ️ Você vai criar seu personagem depois de entrar, dentro da plataforma.
      </div>
      <button className="btn btn-p btn-full btn-lg" type="submit" disabled={loading}>
        {loading ? '⏳ Criando conta...' : '✦ Criar Conta'}
      </button>
    </form>
  )
}

export default function AuthPage() {
  const [tab, setTab] = useState('login')
  const navigate = useNavigate()

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-logo">
          <div className="logo-title">PLUS ULTRA</div>
          <div className="logo-sub">Hero RPG Platform</div>
          <div style={{ marginTop: 8 }}><span className="logo-badge">U.A. High · Online</span></div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12, lineHeight: 1.5 }}>
            Plataforma de RPG textual baseada em Boku no Hero Academia.
          </div>
        </div>
        <div className="auth-tabs">
          <div className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>⚡ Entrar</div>
          <div className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>✦ Cadastrar</div>
        </div>
        {tab === 'login'
          ? <LoginForm onSuccess={() => navigate('/')} />
          : <RegisterForm />
        }
        <div className="auth-footer">Plus Ultra RPG © {new Date().getFullYear()}</div>
      </div>
    </div>
  )
}
