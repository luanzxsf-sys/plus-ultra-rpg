import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { signOut, setOnline, getServerConfig, getAllProfiles, updateTheme } from '../lib/supabase'
import { ToastContainer, notify } from '../components/Toast'
import Avatar from '../components/Avatar'
import { calcLevel } from '../lib/gameSystem'

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

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme || 'dark')
}

export default function AppShell() {
  const { user, profile, character, refreshCharacter } = useAuth()
  const [view, setView]               = useState('chat')
  const [serverName, setServerName]   = useState('Plus Ultra RPG')
  const [questCount, setQuestCount]   = useState(0)
  const [onlineCount, setOnlineCount] = useState(1)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === '1')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)

  function toggleCollapsed() {
    setCollapsed(c => { localStorage.setItem('sidebar-collapsed', c ? '0' : '1'); return !c })
  }

  const char  = character
  const theme = profile?.theme || 'dark'
  // char.level is now stored in DB and updated by addXpToCharacter
  // Fall back to calcLevel only for old rows that don't have level yet
  const level = char?.level ?? calcLevel(char?.xp_total ?? char?.xp ?? 0)
  const xpPct = char && char.xp_max > 0 ? Math.min(100, Math.round(char.xp / char.xp_max * 100)) : 0

  useEffect(() => { applyTheme(theme) }, [theme])

  useEffect(() => {
    getServerConfig().then(({ data }) => { if (data?.server_name) setServerName(data.server_name) })
  }, [])

  useEffect(() => {
    if (user) setOnline(user.id, true)
    return () => { if (user) setOnline(user.id, false) }
  }, [user])

  useEffect(() => {
    const poll = () => getAllProfiles().then(({ data }) => {
      if (data) setOnlineCount(data.filter(p => p.is_online).length)
    })
    poll()
    const t = setInterval(poll, 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    function handle(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  async function handleSignOut() {
    if (user) await setOnline(user.id, false)
    await signOut()
  }

  async function handleThemeChange(t) {
    applyTheme(t)
    if (user) await updateTheme(user.id, t)
  }

  function navigate(id) { setView(id); setSidebarOpen(false) }

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
      <div className={`sidebar-overlay ${sidebarOpen?'show':''}`} onClick={() => setSidebarOpen(false)} />

      <div className={`sidebar ${sidebarOpen?'open':''} ${collapsed?'collapsed':''}`}>
        <button className="sidebar-collapse-btn" onClick={toggleCollapsed} title={collapsed?'Expandir menu':'Recolher menu'}>
          {collapsed?'»':'«'}
        </button>
        <div className="logo">
          <div className="logo-title">{collapsed?'PU':'PLUS ULTRA'}</div>
          {!collapsed && <>
            <div className="logo-sub">Hero RPG Platform</div>
            <div className="logo-badge">{serverName}</div>
          </>}
        </div>

        <nav className="nav">
          {CATS.map(cat => (
            <div key={cat}>
              {!collapsed && <div className="nav-cat">{cat}</div>}
              {VIEWS.filter(v => v.cat === cat).map(v => (
                <div key={v.id} className={`nav-item ${view===v.id?'active':''} ${collapsed?'collapsed':''}`} onClick={() => navigate(v.id)} title={collapsed?v.label:''}>
                  <span className="ico">{v.ico}</span>
                  {!collapsed && v.label}
                  {v.badge && questCount > 0 && <span className="nbadge">{questCount}</span>}
                </div>
              ))}
            </div>
          ))}
        </nav>

        {/* User card */}
        <div className="user-slot" ref={userMenuRef}>
          {collapsed ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'8px 0' }}>
              <div style={{ position:'relative', cursor:'pointer' }} onClick={() => setUserMenuOpen(m => !m)} title={char?.name||profile?.username||'Herói'}>
                <Avatar name={char?.name||profile?.username||'?'} color={char?.avatar_color||'purple'} url={char?.avatar_url||profile?.avatar_url} size={34} />
                <div style={{ position:'absolute', bottom:0, right:0, width:9, height:9, borderRadius:'50%', background:'var(--green)', border:'1.5px solid var(--card)' }} />
              </div>
            </div>
          ) : (
          <div className="u-card">
            <div className="u-row">
              <div style={{ position:'relative', cursor:'pointer' }} onClick={() => setUserMenuOpen(m => !m)}>
                <Avatar name={char?.name||profile?.username||'?'} color={char?.avatar_color||'purple'} url={char?.avatar_url||profile?.avatar_url} size={34} />
                <div style={{ position:'absolute', bottom:0, right:0, width:9, height:9, borderRadius:'50%', background:'var(--green)', border:'1.5px solid var(--card)' }} />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div className="u-name">{char?.name||profile?.username||'Herói'}</div>
                <div className="u-rank" style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <span style={{ fontFamily:'Orbitron,monospace', fontSize:9, color:'var(--gold)', fontWeight:700 }}>Nv.{level}</span>
                  <span style={{ color:'var(--dim)' }}>·</span>
                  <span>{char?.alias||'Configure sua ficha'}</span>
                </div>
              </div>
            </div>
            <div className="xp-bar"><div className="xp-fill" style={{ width:`${xpPct}%` }} /></div>
            <div className="xp-lbl"><span>EXP</span><span>{char?.xp||0} / {char?.xp_max||1000}</span></div>
          </div>
          )}
          {userMenuOpen && (
            <div style={{ position:'absolute', bottom:80, left:10, width:190, background:'var(--panel)', border:'1px solid var(--border)', borderRadius:8, padding:6, zIndex:400, boxShadow:'0 4px 20px rgba(0,0,0,.6)' }}>
              <div style={{ padding:'4px 8px', fontSize:11, color:'var(--dim)', borderBottom:'1px solid var(--border)', marginBottom:4 }}>
                @{profile?.username}
                <span style={{ marginLeft:6, fontFamily:'Orbitron,monospace', fontSize:9, color:'var(--gold)' }}>Nv.{level}</span>
              </div>
              {[{id:'ficha',label:'📋 Minha Ficha'},{id:'quirk',label:'✨ Quirk'},{id:'settings',label:'⚙️ Configurações'}].map(item => (
                <div key={item.id} className="nav-item" style={{ padding:'7px 8px', borderLeft:'none', fontSize:12 }} onClick={() => { navigate(item.id); setUserMenuOpen(false) }}>{item.label}</div>
              ))}
              <div style={{ padding:'7px 8px', borderTop:'1px solid var(--border)', marginTop:4 }}>
                <div style={{ fontSize:9, color:'var(--dim)', marginBottom:5, textTransform:'uppercase', letterSpacing:1 }}>Tema</div>
                <div style={{ display:'flex', gap:5 }}>
                  {[{k:'dark',l:'🌑',tip:'Escuro'},{k:'blue',l:'🌊',tip:'Azul'},{k:'light',l:'☀️',tip:'Claro'},{k:'night',l:'🌃',tip:'Patrulha Noturna'}].map(t => (
                    <button key={t.k} title={t.tip} onClick={() => handleThemeChange(t.k)}
                      style={{ flex:1, padding:'5px 2px', border:`1px solid ${theme===t.k?'var(--blue)':'var(--border)'}`, borderRadius:4, background:theme===t.k?'rgba(59,111,240,.2)':'transparent', cursor:'pointer', fontSize:14 }}>
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

      <div className="main">
        <div className="topbar">
          <button className="hamburger" onClick={() => setSidebarOpen(o => !o)}>☰</button>
          <div className="tb-title">{currentView?.label||'Plus Ultra'}</div>
          <div className="tb-right">
            <span style={{ fontSize:9, color:'var(--muted)', display:'flex', alignItems:'center', gap:3 }}>
              <span className="live" />{onlineCount}
            </span>
            {char?.name && (
              <span style={{ fontFamily:'Orbitron,monospace', fontSize:9, color:'var(--gold)', background:'rgba(242,183,5,.1)', padding:'2px 7px', borderRadius:3, fontWeight:700 }}>
                Nv.{level}
              </span>
            )}
            <button className="btn btn-g btn-sm" onClick={() => navigate('dice')}>🎲</button>
            <button className="btn btn-gold btn-sm" onClick={() => notify('⚡ PLUS ULTRA! +50% poder por 2 turnos!')}>⚡</button>
            <div style={{ cursor:'pointer' }} onClick={() => setUserMenuOpen(o => !o)}>
              <Avatar name={char?.name||profile?.username||'?'} color={char?.avatar_color||'purple'} url={char?.avatar_url||profile?.avatar_url} size={28} ring="online" />
            </div>
          </div>
        </div>
        {renderView()}
      </div>

      <ToastContainer />
    </div>
  )
}
