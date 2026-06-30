import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { signOut, setOnline, getServerConfig, getAllProfiles } from '../lib/supabase'
import { ToastContainer, notify } from '../components/Toast'
import Avatar from '../components/Avatar'
import Modal from '../components/Modal'

// Views
import ChatView from './views/ChatView'
import FichaView from './views/FichaView'
import QuirkView from './views/QuirkView'
import InventoryView from './views/InventoryView'
import QuestsView from './views/QuestsView'
import RankingView from './views/RankingView'
import FeedView from './views/FeedView'
import PlayersView from './views/PlayersView'
import ArenaView from './views/ArenaView'
import ExploreView from './views/ExploreView'
import SettingsView from './views/SettingsView'
import DiceView from './views/DiceView'

const VIEWS = [
  { id: 'chat',     label: 'Salas RP',    ico: '💬', cat: 'Encenação' },
  { id: 'arena',    label: 'Arena',        ico: '⚔️', cat: 'Encenação' },
  { id: 'explore',  label: 'Locais',       ico: '🗺️', cat: 'Encenação' },
  { id: 'ficha',    label: 'Ficha',        ico: '📋', cat: 'Personagem' },
  { id: 'quirk',    label: 'Quirk',        ico: '✨', cat: 'Personagem' },
  { id: 'inv',      label: 'Inventário',   ico: '🎒', cat: 'Personagem' },
  { id: 'quests',   label: 'Missões',      ico: '📜', cat: 'Missões', badge: true },
  { id: 'ranking',  label: 'Ranking',      ico: '🏆', cat: 'Missões' },
  { id: 'feed',     label: 'Feed',         ico: '📰', cat: 'Comunidade' },
  { id: 'players',  label: 'Jogadores',    ico: '👥', cat: 'Comunidade' },
  { id: 'dice',     label: 'Dados',        ico: '🎲', cat: 'Sistema' },
  { id: 'settings', label: 'Configurações',ico: '⚙️', cat: 'Sistema' },
]

const CATS = ['Encenação', 'Personagem', 'Missões', 'Comunidade', 'Sistema']

export default function AppShell() {
  const { user, profile, character, refreshCharacter } = useAuth()
  const [view, setView] = useState('chat')
  const [serverName, setServerName] = useState('Plus Ultra RPG')
  const [questCount, setQuestCount] = useState(0)
  const [onlineCount, setOnlineCount] = useState(1)
  const [showUserMenu, setShowUserMenu] = useState(false)

  // Load server config
  useEffect(() => {
    getServerConfig().then(({ data }) => {
      if (data?.server_name) setServerName(data.server_name)
    })
  }, [])

  // Mark online on mount, offline on unmount
  useEffect(() => {
    if (user) setOnline(user.id, true)
    return () => { if (user) setOnline(user.id, false) }
  }, [user])

  // Poll online count
  useEffect(() => {
    const poll = () => {
      getAllProfiles().then(({ data }) => {
        if (data) setOnlineCount(data.filter(p => p.is_online).length)
      })
    }
    poll()
    const t = setInterval(poll, 30000)
    return () => clearInterval(t)
  }, [])

  const char = character
  const xpPct = char && char.xp_max > 0
    ? Math.min(100, Math.round(char.xp / char.xp_max * 100))
    : 0

  async function handleSignOut() {
    if (user) await setOnline(user.id, false)
    await signOut()
    notify('👋 Até a próxima, herói!')
  }

  const currentView = VIEWS.find(v => v.id === view)

  const viewProps = { onViewChange: setView, onQuestCountChange: setQuestCount }

  function renderView() {
    switch (view) {
      case 'chat':     return <ChatView {...viewProps} />
      case 'arena':    return <ArenaView {...viewProps} />
      case 'explore':  return <ExploreView {...viewProps} />
      case 'ficha':    return <FichaView {...viewProps} />
      case 'quirk':    return <QuirkView {...viewProps} onRefreshChar={refreshCharacter} />
      case 'inv':      return <InventoryView {...viewProps} />
      case 'quests':   return <QuestsView {...viewProps} />
      case 'ranking':  return <RankingView {...viewProps} />
      case 'feed':     return <FeedView {...viewProps} />
      case 'players':  return <PlayersView {...viewProps} />
      case 'dice':     return <DiceView {...viewProps} />
      case 'settings': return <SettingsView {...viewProps} serverName={serverName} onServerNameChange={setServerName} />
      default:         return <ChatView {...viewProps} />
    }
  }

  return (
    <div className="app">
      {/* ── SIDEBAR ── */}
      <div className="sidebar">
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
                <div
                  key={v.id}
                  className={`nav-item ${view === v.id ? 'active' : ''}`}
                  onClick={() => setView(v.id)}
                >
                  <span className="ico">{v.ico}</span>
                  {v.label}
                  {v.badge && questCount > 0 && (
                    <span className="nbadge">{questCount}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </nav>

        {/* ── USER CARD ── */}
        <div className="user-slot">
          <div className="u-card">
            <div className="u-row">
              <div
                style={{ position: 'relative', cursor: 'pointer' }}
                onClick={() => setShowUserMenu(m => !m)}
              >
                <Avatar
                  name={char?.name || profile?.username || '?'}
                  color={char?.avatar_color || 'purple'}
                  url={char?.avatar_url || profile?.avatar_url}
                  size={34}
                />
                <div style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 9, height: 9, borderRadius: '50%',
                  background: 'var(--green)',
                  border: '1px solid var(--card)'
                }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="u-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {char?.name || profile?.username || 'Herói'}
                </div>
                <div className="u-rank">
                  {char?.alias ? `"${char.alias}" · ` : ''}
                  {char?.rank || 'Configure sua ficha'}
                </div>
              </div>
            </div>
            <div className="xp-bar">
              <div className="xp-fill" style={{ width: `${xpPct}%` }} />
            </div>
            <div className="xp-lbl">
              <span>EXP</span>
              <span>{char?.xp || 0} / {char?.xp_max || 1000}</span>
            </div>
          </div>

          {/* User drop-menu */}
          {showUserMenu && (
            <div style={{
              position: 'absolute', bottom: 80, left: 10, width: 190,
              background: 'var(--panel)', border: '1px solid var(--glow)',
              borderRadius: 8, padding: 6, zIndex: 200,
              boxShadow: '0 4px 20px rgba(0,0,0,.6)'
            }}>
              <div style={{ padding: '4px 8px', fontSize: 11, color: 'var(--dim)', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                @{profile?.username}
              </div>
              <div
                className="nav-item"
                style={{ padding: '7px 8px', borderLeft: 'none', fontSize: 12 }}
                onClick={() => { setView('ficha'); setShowUserMenu(false) }}
              >
                📋 Minha Ficha
              </div>
              <div
                className="nav-item"
                style={{ padding: '7px 8px', borderLeft: 'none', fontSize: 12 }}
                onClick={() => { setView('settings'); setShowUserMenu(false) }}
              >
                ⚙️ Configurações
              </div>
              <div
                className="nav-item"
                style={{ padding: '7px 8px', borderLeft: 'none', fontSize: 12, color: 'var(--red-l)' }}
                onClick={handleSignOut}
              >
                🚪 Sair
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN ── */}
      <div className="main">
        {/* TOPBAR */}
        <div className="topbar">
          <div className="tb-title">{currentView?.label || 'Plus Ultra'}</div>
          <span className="tb-sep">›</span>
          <div className="tb-sub">
            <span className="live" />
            {onlineCount} online
          </div>
          <div className="tb-right">
            <button className="btn btn-g" onClick={() => setView('dice')}>🎲 Dado</button>
            <button className="btn btn-gold" onClick={() => notify('⚡ PLUS ULTRA! +50% poder por 2 turnos!')}>
              ⚡ Plus Ultra
            </button>
            <div
              style={{ cursor: 'pointer', marginLeft: 4 }}
              onClick={() => setShowUserMenu(m => !m)}
            >
              <Avatar
                name={char?.name || profile?.username || '?'}
                color={char?.avatar_color || 'purple'}
                url={char?.avatar_url || profile?.avatar_url}
                size={28}
                ring="online"
              />
            </div>
          </div>
        </div>

        {/* VIEWS */}
        {renderView()}
      </div>

      <ToastContainer />
    </div>
  )
}
