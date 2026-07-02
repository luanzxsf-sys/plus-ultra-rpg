import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { signOut, setOnline, getServerConfig, getAllProfiles, updateTheme } from '../lib/supabase'
import { ToastContainer, notify } from '../components/Toast'
import Avatar from '../components/Avatar'

import ChatView      from './views/ChatView'
import ExploreView   from './views/ExploreView'
import NpcsView      from './views/NpcsView'
import FichaView     from './views/FichaView'
import QuirkView     from './views/QuirkView'
import InventoryView from './views/InventoryView'
import QuestsView    from './views/QuestsView'
import RankingView   from './views/RankingView'
import FeedView      from './views/FeedView'
import PlayersView   from './views/PlayersView'
import DiceView      from './views/DiceView'
import SettingsView  from './views/SettingsView'

const VIEWS = [
  { id:'chat',     label:'Chat Geral',     ico:'💬', cat:'Encenação' },
  { id:'explore',  label:'Locais',         ico:'🗺️', cat:'Encenação' },
  { id:'npcs',     label:'NPCs',           ico:'🎭', cat:'Encenação' },
  { id:'ficha',    label:'Ficha',          ico:'📋', cat:'Personagem' },
  { id:'quirk',    label:'Quirk',          ico:'✨', cat:'Personagem' },
  { id:'inv',      label:'Inventário',     ico:'🎒', cat:'Personagem' },
  { id:'quests',   label:'Missões',        ico:'📜', cat:'Missões', badge:true },
  { id:'ranking',  label:'Ranking',        ico:'🏆', cat:'Missões' },
  { id:'feed',     label:'Feed',           ico:'📰', cat:'Comunidade' },
  { id:'players',  label:'Jogadores',      ico:'👥', cat:'Comunidade' },
  { id:'dice',     label:'Dados',          ico:'🎲', cat:'Sistema' },
  { id:'settings', label:'Configurações',  ico:'⚙️', cat:'Sistema' },
]
const CATS = ['Encenação','Personagem','Missões','Comunidade','Sistema']

// Aplica tema ao DOM
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme || 'dark')
}

export default function AppShell() {
  const { user, profile, character, refreshCharacter } = useAuth()
  const [view, setView]           = useState('chat')
  const [serverName, setServerName] = useState('Plus Ultra RPG')
  const [questCount, setQuestCount] = useState(0)
  const [onlineCount, setOnlineCount] = useState(1)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)

  const char  = character
  const theme = profile?.theme || 'dark'

  // Aplica tema ao carregar e quando mudar
  useEffect(() => { applyTheme(theme) }, [theme])

  // Config do servidor
  useEffect(() => {
    getServerConfig().then(({ data }) => { if (data?.server_name) setServerName(data.server_name) })
  }, [])

  // Presença online
  useEffect(() => {
    if (user) setOnline(user.id, true)
    return () => { if (user) setOnline(user.id, false) }
  }, [user])

  // Poll online count
  useEffect(() => {
    const poll = () => getAllProfiles().then(({ data }) => {
      if (data) setOnlineCount(data.filter(p => p.is_online).length)
    })
    poll()
    const t = setInterval(poll, 30000)
    return () => clearInterval(t)
  }, [])

  // Fechar user menu ao clicar fora
  useEffect(() => {
    function handle(e) { if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const xpPct = char && char.xp_max > 0 ? Math.min(100, Math.round(char.xp / char.xp_max * 100)) : 0

  async function handleSignOut() {
    if (user) await setOnline(user.id, false)
    await signOut()
  }

  async function handleThemeChange(t) {
    applyTheme(t)
    if (user) await updateTheme(user.id, t)
  }

  function navigate(id) {
    setView(id)
    setSidebarOpen(false)
  }

  const currentView = VIEWS.find(v => v.id === view)

  function renderView() {
    const props = { onViewChange: navigate, onQuestCountChange: setQuestCount }
    switch (view) {
      case 'chat':     return <ChatView {...props} />
      case 'explore':  return <ExploreView {...props} />
      case 'npcs':     return <NpcsView {...props} />
      case 'ficha':    return <FichaView {...props} onRefreshChar={refreshCharacter} />
      case 'quirk':    return <QuirkView {...props} onRefreshChar={refreshCharacter} />
      case 'inv':      return <InventoryView {...props} />
      case 'quests':   return <QuestsView {...props} />
      case 'ranking':  return <RankingView {...props} />
      case 'feed':     return <FeedView {...props} />
      case 'players':  return <PlayersView {...props} />
      case 'dice':     return <DiceView {...props} />
      case 'settings': return <SettingsView {...props} serverName={serverName} onServerNameChange={setServerName} onThemeChange={handleThemeChange} currentTheme={theme} />
      default:         return <ChatView {...props} />
    }
  }

  return (
    <div className="app">
      {/* Overlay do sidebar mobile */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* ── SIDEBAR ── */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="logo">
          <div className="logo-title">PLUS ULTRA</div>
          <div className="logo-sub">Hero RPG Platform</div>
          <div className="logo-badge">{serverName}</div>
        </div>

        <nav className="nav">
          {CATS.map(cat => (
            <div key={cat}>
              <div className="nav-cat">{cat}</div>
              {VIEWS.filter(v => v.cat === cat).map(v => (
                <div key={v.id} className={`nav-item ${view === v.id ? 'active' : ''}`} onClick={() => navigate(v.id)}>
                  <span className="ico">{v.ico}</span>
                  {v.label}
                  {v.badge && questCount > 0 && <span className="nbadge">{questCount}</span>}
                </div>
              ))}
            </div>
          ))}
        </nav>

        {/* User card */}
        <div className="user-slot" ref={userMenuRef}>
          <div className="u-card">
            <div className="u-row">
              <div style={{ position:'relative', cursor:'pointer' }} onClick={() => setUserMenuOpen(m => !m)}>
                <Avatar name={char?.name || profile?.username || '?'} color={char?.avatar_color || 'purple'} url={char?.avatar_url || profile?.avatar_url} size={34} />
                <div style={{ position:'absolute', bottom:0, right:0, width:9, height:9, borderRadius:'50%', background:'var(--green)', border:'1.5px solid var(--card)' }} />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div className="u-name">{char?.name || profile?.username || 'Herói'}</div>
                <div className="u-rank">{char?.alias ? `"${char.alias}" · ` : ''}{char?.rank || 'Configure sua ficha'}</div>
              </div>
            </div>
            <div className="xp-bar"><div className="xp-fill" style={{ width:`${xpPct}%` }} /></div>
            <div className="xp-lbl"><span>EXP</span><span>{char?.xp||0} / {char?.xp_max||1000}</span></div>
          </div>

          {/* Drop menu */}
          {userMenuOpen && (
            <div style={{ position:'absolute', bottom:80, left:10, width:190, background:'var(--panel)', border:'1px solid var(--glow)', borderRadius:8, padding:6, zIndex:400, boxShadow:'0 4px 20px rgba(0,0,0,.6)' }}>
              <div style={{ padding:'4px 8px', fontSize:11, color:'var(--dim)', borderBottom:'1px solid var(--border)', marginBottom:4 }}>@{profile?.username}</div>
              {[{id:'ficha',label:'📋 Minha Ficha'},{id:'quirk',label:'✨ Quirk'},{id:'settings',label:'⚙️ Configurações'}].map(item => (
                <div key={item.id} className="nav-item" style={{ padding:'7px 8px', borderLeft:'none', fontSize:12 }} onClick={() => { navigate(item.id); setUserMenuOpen(false) }}>{item.label}</div>
              ))}
              <div style={{ padding:'7px 8px', borderTop:'1px solid var(--border)', marginTop:4 }}>
                <div style={{ fontSize:9, color:'var(--dim)', marginBottom:5, textTransform:'uppercase', letterSpacing:1 }}>Tema</div>
                <div style={{ display:'flex', gap:5 }}>
                  {[{k:'dark',l:'🌑',tip:'Escuro'},{k:'blue',l:'🌊',tip:'Azul'},{k:'light',l:'☀️',tip:'Claro'}].map(t => (
                    <button key={t.k} title={t.tip} onClick={() => handleThemeChange(t.k)}
                      style={{ flex:1, padding:'4px 2px', border:`1px solid ${theme===t.k?'var(--blue)':'var(--border)'}`, borderRadius:4, background: theme===t.k?'rgba(37,99,235,.2)':'transparent', cursor:'pointer', fontSize:14 }}>
                      {t.l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="nav-item" style={{ padding:'7px 8px', borderLeft:'none', fontSize:12, color:'var(--red-l)', marginTop:4 }} onClick={handleSignOut}>🚪 Sair</div>
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN ── */}
      <div className="main">
        <div className="topbar">
          <button className="hamburger" onClick={() => setSidebarOpen(o => !o)}>☰</button>
          <div className="tb-title">{currentView?.label || 'Plus Ultra'}</div>
          <span className="tb-sep" style={{ display:'none' }}>›</span>
          <div className="tb-sub" style={{ display:'none' }}><span className="live" />{onlineCount} online</div>
          <div className="tb-right">
            <span style={{ fontSize:9, color:'var(--muted)', display:'flex', alignItems:'center', gap:3 }}><span className="live" />{onlineCount}</span>
            <button className="btn btn-g btn-sm" onClick={() => navigate('dice')}>🎲</button>
            <button className="btn btn-gold btn-sm" onClick={() => notify('⚡ PLUS ULTRA! +50% poder por 2 turnos!')}>⚡</button>
            <div style={{ cursor:'pointer' }} onClick={() => setUserMenuOpen(o => !o)}>
              <Avatar name={char?.name || profile?.username || '?'} color={char?.avatar_color || 'purple'} url={char?.avatar_url || profile?.avatar_url} size={28} ring="online" />
            </div>
          </div>
        </div>

        {renderView()}
      </div>

      <ToastContainer />
    </div>
  )
}
