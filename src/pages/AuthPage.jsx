import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn, signUpWithChar } from '../lib/supabase'

/* ── colour palette for avatar preview ── */
const COLORS = [
  { key: 'purple', bg: 'linear-gradient(135deg,#7c3aed,#5b21b6)' },
  { key: 'blue',   bg: 'linear-gradient(135deg,#2563eb,#1d4ed8)' },
  { key: 'red',    bg: 'linear-gradient(135deg,#dc2626,#991b1b)' },
  { key: 'green',  bg: 'linear-gradient(135deg,#16a34a,#15803d)' },
  { key: 'gold',   bg: 'linear-gradient(135deg,#d97706,#b45309)' },
  { key: 'pink',   bg: 'linear-gradient(135deg,#db2777,#be185d)' },
  { key: 'teal',   bg: 'linear-gradient(135deg,#0891b2,#0e7490)' },
  { key: 'gray',   bg: 'linear-gradient(135deg,#374151,#1f2937)' },
]

function initials(name) {
  if (!name) return '?'
  const p = name.trim().split(' ')
  return (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase()
}

/* ─────────────────────────────────────────────
   LOGIN FORM
───────────────────────────────────────────── */
function LoginForm({ onSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await signIn({ email, password })
    setLoading(false)
    if (err) {
      setError(
        err.message.includes('Invalid login')
          ? 'E-mail ou senha incorretos.'
          : err.message.includes('Email not confirmed')
          ? 'Confirme seu e-mail antes de entrar.'
          : err.message
      )
    } else {
      onSuccess()
    }
  }

  return (
    <form onSubmit={handleLogin}>
      {error && <div className="auth-error">⚠️ {error}</div>}

      <div className="field">
        <label>E-mail</label>
        <input
          className="input"
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <div className="field">
        <label>Senha</label>
        <input
          className="input"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          minLength={6}
        />
      </div>

      <button
        className="btn btn-p btn-full btn-lg"
        type="submit"
        disabled={loading}
        style={{ marginTop: 8 }}
      >
        {loading ? '⏳ Entrando...' : '⚡ Entrar'}
      </button>
    </form>
  )
}

/* ─────────────────────────────────────────────
   REGISTER FORM
───────────────────────────────────────────── */
function RegisterForm({ onSuccess }) {
  const [step, setStep] = useState(1)           // 1 = conta, 2 = personagem
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    charName: '',
    charAlias: '',
    charColor: 'purple',
    heroType: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }))
    setError('')
  }

  function validateStep1() {
    if (!form.username.trim()) return 'Nome de usuário obrigatório.'
    if (form.username.length < 3) return 'Usuário deve ter no mínimo 3 caracteres.'
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) return 'Usuário: apenas letras, números e _.'
    if (!form.email.trim()) return 'E-mail obrigatório.'
    if (form.password.length < 6) return 'Senha deve ter no mínimo 6 caracteres.'
    if (form.password !== form.confirmPassword) return 'As senhas não coincidem.'
    return null
  }

  function handleNext(e) {
    e.preventDefault()
    const err = validateStep1()
    if (err) { setError(err); return }
    setError('')
    setStep(2)
  }

  async function handleRegister(e) {
    e.preventDefault()
    if (!form.charName.trim()) { setError('Nome do personagem obrigatório.'); return }
    setLoading(true)
    setError('')

    const { error: err } = await signUpWithChar({
      email: form.email,
      password: form.password,
      username: form.username,
      charName: form.charName,
      charAlias: form.charAlias,
      charColor: form.charColor,
    })

    setLoading(false)

    if (err) {
      if (err.message.includes('already registered')) {
        setError('Este e-mail já está cadastrado. Faça login.')
        setStep(1)
      } else {
        setError(err.message)
      }
      return
    }

    setSuccess('✅ Conta criada! Verifique seu e-mail para confirmar e depois faça login.')
  }

  const selectedColor = COLORS.find(c => c.key === form.charColor) || COLORS[0]

  /* STEP 1 */
  if (step === 1) return (
    <form onSubmit={handleNext}>
      {error && <div className="auth-error">⚠️ {error}</div>}

      <div className="field">
        <label>Nome de usuário</label>
        <input
          className="input"
          type="text"
          placeholder="seu_nick"
          value={form.username}
          onChange={e => set('username', e.target.value)}
          required
          autoComplete="username"
        />
        <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 4 }}>
          Apenas letras, números e underline. Será exibido para todos.
        </div>
      </div>

      <div className="field">
        <label>E-mail</label>
        <input
          className="input"
          type="email"
          placeholder="seu@email.com"
          value={form.email}
          onChange={e => set('email', e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <div className="field">
        <label>Senha</label>
        <input
          className="input"
          type="password"
          placeholder="Mínimo 6 caracteres"
          value={form.password}
          onChange={e => set('password', e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
        />
      </div>

      <div className="field">
        <label>Confirmar senha</label>
        <input
          className="input"
          type="password"
          placeholder="Repita a senha"
          value={form.confirmPassword}
          onChange={e => set('confirmPassword', e.target.value)}
          required
          autoComplete="new-password"
        />
      </div>

      <button className="btn btn-p btn-full btn-lg" type="submit" style={{ marginTop: 8 }}>
        Próximo → Personagem
      </button>
    </form>
  )

  /* STEP 2 */
  return (
    <form onSubmit={handleRegister}>
      {error && <div className="auth-error">⚠️ {error}</div>}
      {success && <div className="auth-success">{success}</div>}

      {!success && (
        <>
          {/* Preview do avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, padding: '12px 14px', background: 'var(--panel)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div
              style={{
                width: 52, height: 52, borderRadius: '50%',
                background: selectedColor.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Bangers, cursive', fontSize: 22, color: '#fff',
                flexShrink: 0, boxShadow: '0 0 16px rgba(124,58,237,.3)'
              }}
            >
              {initials(form.charName || form.username)}
            </div>
            <div>
              <div style={{ fontFamily: 'Bangers, cursive', fontSize: 18, letterSpacing: 1, color: '#fff' }}>
                {form.charName || '—'}
              </div>
              <div style={{ fontSize: 9, color: 'var(--gold)', letterSpacing: 2, textTransform: 'uppercase' }}>
                {form.charAlias ? `"${form.charAlias}"` : 'Seu codinome'}
              </div>
              <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>
                @{form.username}
              </div>
            </div>
          </div>

          <div className="field">
            <label>Nome do personagem *</label>
            <input
              className="input"
              type="text"
              placeholder="Ex: Emi Yakumo"
              value={form.charName}
              onChange={e => set('charName', e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label>Codinome heroico (opcional)</label>
            <input
              className="input"
              type="text"
              placeholder='Ex: "Shadowlace"'
              value={form.charAlias}
              onChange={e => set('charAlias', e.target.value)}
            />
          </div>

          <div className="field">
            <label>Tipo de herói (opcional)</label>
            <input
              className="input"
              type="text"
              placeholder="Ex: Herói de Captura, Vilão, Suporte..."
              value={form.heroType}
              onChange={e => set('heroType', e.target.value)}
            />
          </div>

          <div className="field">
            <label>Cor do avatar</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {COLORS.map(c => (
                <div
                  key={c.key}
                  onClick={() => set('charColor', c.key)}
                  style={{
                    width: 28, height: 28,
                    borderRadius: '50%',
                    background: c.bg,
                    cursor: 'pointer',
                    border: form.charColor === c.key
                      ? '2px solid #fff'
                      : '2px solid transparent',
                    transition: 'border .15s',
                    boxShadow: form.charColor === c.key ? '0 0 8px rgba(255,255,255,.4)' : 'none'
                  }}
                  title={c.key}
                />
              ))}
            </div>
            <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 6 }}>
              Você pode adicionar foto de perfil depois no painel.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-g"
              type="button"
              onClick={() => { setStep(1); setError('') }}
              style={{ flexShrink: 0 }}
            >
              ← Voltar
            </button>
            <button
              className="btn btn-p btn-full btn-lg"
              type="submit"
              disabled={loading}
            >
              {loading ? '⏳ Criando conta...' : '✦ Criar Herói'}
            </button>
          </div>

          <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 10, textAlign: 'center' }}>
            Você precisará confirmar seu e-mail para ativar a conta.
          </div>
        </>
      )}

      {success && (
        <button
          className="btn btn-g btn-full"
          type="button"
          onClick={() => window.location.reload()}
          style={{ marginTop: 8 }}
        >
          ← Voltar para o Login
        </button>
      )}
    </form>
  )
}

/* ─────────────────────────────────────────────
   AUTH PAGE (container)
───────────────────────────────────────────── */
export default function AuthPage() {
  const [tab, setTab] = useState('login')   // 'login' | 'register'
  const navigate = useNavigate()

  return (
    <div className="auth-page">
      <div className="auth-box">
        {/* Logo */}
        <div className="auth-logo">
          <div className="logo-title">PLUS ULTRA</div>
          <div className="logo-sub">Hero RPG Platform</div>
          <div style={{ marginTop: 8 }}>
            <span className="logo-badge">U.A. High · Online</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12, lineHeight: 1.5 }}>
            Plataforma de RPG textual baseada em Boku no Hero Academia.
            <br />Crie seu herói, jogue com amigos e escreva sua história.
          </div>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          <div
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => setTab('login')}
          >
            ⚡ Entrar
          </div>
          <div
            className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => setTab('register')}
          >
            ✦ Cadastrar
          </div>
        </div>

        {tab === 'login'
          ? <LoginForm onSuccess={() => navigate('/')} />
          : <RegisterForm onSuccess={() => setTab('login')} />
        }

        <div className="auth-footer">
          Plus Ultra RPG &copy; {new Date().getFullYear()} &nbsp;·&nbsp; Todos os dados ficam seguros no Supabase
        </div>
      </div>
    </div>
  )
}
