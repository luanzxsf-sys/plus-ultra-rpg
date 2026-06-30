import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  getLocations, sendMessage, getMessages, supabase,
  getServerConfig, getAllProfiles
} from '../../lib/supabase'
import Avatar, { TEXT_COLOR } from '../../components/Avatar'
import { notify } from '../../components/Toast'

function ts() {
  const n = new Date()
  return `${n.getHours()}:${String(n.getMinutes()).padStart(2, '0')}`
}

function dRoll(sides) { return Math.floor(Math.random() * sides) + 1 }

export default function ChatView() {
  const { user, profile, character } = useAuth()
  const [locations, setLocations] = useState([])
  const [currentLoc, setCurrentLoc] = useState(null)
  const [messages, setMessages] = useState([])
  const [onlinePlayers, setOnlinePlayers] = useState([])
  const [sceneInfo, setSceneInfo] = useState({ name: 'Sem cena', desc: 'Configure nos Locais.', tags: [] })
  const [text, setText] = useState('')
  const [mode, setMode] = useState('rp')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const subRef = useRef(null)

  const char = character

  // Load locations & scene
  useEffect(() => {
    getLocations().then(({ data }) => {
      if (data?.length) {
        setLocations(data)
        setCurrentLoc(data[0])
      }
    })
    getServerConfig().then(({ data }) => {
      if (data) setSceneInfo({ name: data.scene_name, desc: data.scene_desc, tags: data.scene_tags || [] })
    })
    getAllProfiles().then(({ data }) => {
      if (data) setOnlinePlayers(data.filter(p => p.is_online))
    })
  }, [])

  // Load messages when location changes
  useEffect(() => {
    if (!currentLoc) return
    setLoading(true)
    getMessages(currentLoc.id, 60).then(({ data }) => {
      setMessages(data || [])
      setLoading(false)
    })

    // Subscribe to realtime
    if (subRef.current) subRef.current.unsubscribe()
    subRef.current = supabase
      .channel(`messages:${currentLoc.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `location_id=eq.${currentLoc.id}`
      }, ({ new: msg }) => {
        setMessages(prev => [...prev, msg])
      })
      .subscribe()

    return () => { if (subRef.current) subRef.current.unsubscribe() }
  }, [currentLoc?.id])

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Subscribe to profile presence
  useEffect(() => {
    const ch = supabase
      .channel('profiles-presence')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => {
        getAllProfiles().then(({ data }) => {
          if (data) setOnlinePlayers(data.filter(p => p.is_online))
        })
      })
      .subscribe()
    return () => ch.unsubscribe()
  }, [])

  async function handleSend() {
    if (!text.trim() || !currentLoc || !user) return

    const msg = {
      location_id: currentLoc.id,
      user_id: user.id,
      author_name: char?.name || profile?.username || 'Herói',
      author_alias: char?.alias || '',
      author_color: char?.avatar_color || 'purple',
      content: text.trim(),
      mode
    }

    const { error } = await sendMessage(msg)
    if (error) { notify('❌ Erro ao enviar mensagem', 'error'); return }
    setText('')
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function rollInChat() {
    const r = dRoll(20)
    const color = r >= 15 ? '#4ade80' : r >= 8 ? '#fbbf24' : '#f87171'
    const lbl = r === 20 ? 'CRÍTICO! 🌟' : r === 1 ? 'FALHA CRÍTICA! 💀' : r >= 15 ? 'Sucesso!' : r >= 8 ? 'Parcial' : 'Falha!'

    // Show locally (could also send as system message)
    setMessages(prev => [...prev, {
      id: `local-${Date.now()}`,
      author_name: 'Sistema',
      author_color: 'gray',
      content: `🎲 ${char?.name || profile?.username || '?'} rolou D20 — [${r}] — ${lbl}`,
      mode: 'roll',
      created_at: new Date().toISOString()
    }])
  }

  function msgClass(mode) {
    return mode === 'rp' ? 'msg-rp'
      : mode === 'action' ? 'msg-act'
      : mode === 'sys' ? 'msg-sys'
      : mode === 'roll' ? 'msg-roll'
      : 'msg-ooc'
  }

  const myName = char?.name || profile?.username

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', height: 'calc(100vh - 46px)', overflow: 'hidden' }}>

      {/* ── LEFT: CHAT ── */}
      <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', overflow: 'hidden' }}>

        {/* Location tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--card)', flexShrink: 0, overflowX: 'auto' }}>
          {locations.map(loc => (
            <div
              key={loc.id}
              onClick={() => setCurrentLoc(loc)}
              style={{
                padding: '8px 14px',
                cursor: 'pointer',
                fontFamily: 'Rajdhani, sans-serif',
                fontWeight: 700,
                fontSize: 10,
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: currentLoc?.id === loc.id ? 'var(--blue-l)' : 'var(--muted)',
                borderBottom: `2px solid ${currentLoc?.id === loc.id ? 'var(--blue)' : 'transparent'}`,
                whiteSpace: 'nowrap',
                transition: 'all .2s'
              }}
            >
              {loc.icon} {loc.name}
            </div>
          ))}
          {!locations.length && (
            <div style={{ padding: '8px 14px', fontSize: 10, color: 'var(--dim)' }}>
              Sem locais — crie em Locais
            </div>
          )}
        </div>

        {/* Vitals */}
        {char && (
          <div className="vitals-bar">
            {[
              { lbl: 'HP',    val: char.hp,           max: char.hp_max,       color: char.hp / char.hp_max > .5 ? 'var(--green)' : char.hp / char.hp_max > .25 ? 'var(--gold)' : 'var(--red)', txt: 'var(--green-l)' },
              { lbl: 'Quirk', val: char.quirk_charge, max: char.quirk_max,    color: 'var(--purple)',  txt: 'var(--purple-l)' },
              { lbl: 'Estam', val: char.stamina,      max: char.stamina_max,  color: 'var(--blue)',    txt: 'var(--blue-l)' },
            ].map(v => {
              const pct = v.max > 0 ? Math.min(100, Math.round(v.val / v.max * 100)) : 100
              return (
                <div key={v.lbl} className="vit">
                  <span className="vit-lbl">{v.lbl}</span>
                  <div className="vit-bar">
                    <div className="vit-fill" style={{ width: `${pct}%`, background: v.color }} />
                  </div>
                  <span className="vit-val" style={{ color: v.txt }}>{v.val}/{v.max}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Messages */}
        <div className="msgs">
          {loading && (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--dim)', fontSize: 12 }}>
              Carregando mensagens...
            </div>
          )}
          {!loading && !messages.length && (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--dim)', fontSize: 12 }}>
              {currentLoc
                ? `Sem mensagens em ${currentLoc.name}. Comece o RP!`
                : 'Selecione um local para começar.'}
            </div>
          )}
          {messages.map((msg, i) => {
            const isMe = msg.author_name === myName || msg.user_id === user?.id
            const pre = msg.mode === 'ooc' ? '[OOC] ' : msg.mode === 'action' ? '⚡ ' : ''
            return (
              <div key={msg.id || i} className="msg">
                <Avatar
                  name={msg.author_name}
                  color={msg.author_color || 'purple'}
                  url={null}
                  size={28}
                />
                <div className="msg-body">
                  <div className="msg-head">
                    <span className="msg-name" style={{ color: TEXT_COLOR[msg.author_color] || 'var(--text)' }}>
                      {msg.author_name}
                    </span>
                    {msg.author_alias && (
                      <span className="tag" style={{ background: 'rgba(124,58,237,.15)', color: 'var(--purple-l)', border: '1px solid rgba(124,58,237,.3)', fontSize: 7 }}>
                        {msg.author_alias}
                      </span>
                    )}
                    {isMe && (
                      <span className="tag" style={{ background: 'rgba(37,99,235,.15)', color: 'var(--blue-l)', border: '1px solid rgba(37,99,235,.25)', fontSize: 7 }}>
                        VOCÊ
                      </span>
                    )}
                    <span className="msg-time">
                      {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className={`msg-text ${msgClass(msg.mode)}`}>
                    {pre}{msg.content}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="inp-wrap">
          <div className="mode-row">
            {['rp', 'ooc', 'action'].map(m => (
              <button
                key={m}
                className={`mdbtn ${mode === m ? 'on' : ''}`}
                onClick={() => setMode(m)}
              >
                {m === 'rp' ? '✍️ RP' : m === 'ooc' ? '💬 OOC' : '⚡ Ação'}
              </button>
            ))}
            <button className="mdbtn" onClick={rollInChat}>🎲 Dado</button>
          </div>
          <div className="inp-row">
            <textarea
              className="tinp"
              rows={2}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder={
                mode === 'rp' ? 'Descreva a ação do seu personagem...'
                : mode === 'ooc' ? '[OOC] Fale fora do personagem...'
                : '⚡ Declare ação de combate...'
              }
              disabled={!currentLoc}
            />
            <button className="send-btn" onClick={handleSend} disabled={!currentLoc}>↑</button>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'var(--bg)' }}>

        {/* Online players */}
        <div style={{ padding: '10px 11px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'Bangers, cursive', fontSize: 11, letterSpacing: 1, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 7, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            👥 Online ({onlinePlayers.length})
          </div>
          {onlinePlayers.length === 0 && (
            <div style={{ fontSize: 10, color: 'var(--dim)' }}>Nenhum jogador online.</div>
          )}
          {onlinePlayers.map(p => (
            <div key={p.id} className="player-row">
              <Avatar
                name={p.characters?.[0]?.name || p.username}
                color={p.characters?.[0]?.avatar_color || 'purple'}
                url={p.characters?.[0]?.avatar_url || p.avatar_url}
                size={26}
                ring="online"
              />
              <div className="p-info">
                <div className="p-name">{p.username}</div>
                <div className="p-char">{p.characters?.[0]?.name || '—'}</div>
              </div>
              <div className="p-dot" style={{ background: 'var(--green)' }} />
            </div>
          ))}
        </div>

        {/* Scene info */}
        <div style={{ padding: '10px 11px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'Bangers, cursive', fontSize: 11, letterSpacing: 1, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 7 }}>
            📍 Cena
          </div>
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, padding: 9 }}>
            <div style={{ fontSize: 7, letterSpacing: 2, color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 3 }}>Local</div>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--blue-l)', marginBottom: 2 }}>
              {sceneInfo.name}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.35, marginBottom: 6 }}>
              {sceneInfo.desc}
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(sceneInfo.tags || []).map(t => (
                <span key={t} className="tag" style={{ background: 'rgba(37,99,235,.15)', color: 'var(--blue-l)', border: '1px solid rgba(37,99,235,.25)' }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* My character quick card */}
        {char && (
          <div style={{ padding: '10px 11px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'Bangers, cursive', fontSize: 11, letterSpacing: 1, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 7 }}>
              🦸 Personagem
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Avatar
                name={char.name}
                color={char.avatar_color}
                url={char.avatar_url}
                size={38}
              />
              <div>
                <div style={{ fontFamily: 'Bangers, cursive', fontSize: 15, letterSpacing: 1 }}>{char.name}</div>
                {char.alias && <div style={{ fontSize: 9, color: 'var(--gold)', letterSpacing: 1 }}>"{char.alias}"</div>}
                {char.rank && <div style={{ fontSize: 9, color: 'var(--muted)' }}>{char.rank}</div>}
              </div>
            </div>
            {/* Quick vitals bars */}
            {[
              { lbl: 'HP',    v: char.hp,           m: char.hp_max,       c: 'var(--green)' },
              { lbl: 'Quirk', v: char.quirk_charge, m: char.quirk_max,    c: 'var(--purple)' },
            ].map(b => {
              const pct = b.m > 0 ? Math.min(100, Math.round(b.v / b.m * 100)) : 100
              return (
                <div key={b.lbl} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                  <span style={{ fontSize: 7, letterSpacing: 1, color: 'var(--dim)', textTransform: 'uppercase', width: 28, flexShrink: 0 }}>{b.lbl}</span>
                  <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: b.c, borderRadius: 2, transition: 'width .4s' }} />
                  </div>
                  <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 8, minWidth: 36, textAlign: 'right' }}>
                    {b.v}/{b.m}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Quick techniques */}
        {char?.quirk_data?.skills?.filter(s => !s.locked).length > 0 && (
          <div style={{ padding: '10px 11px' }}>
            <div style={{ fontFamily: 'Bangers, cursive', fontSize: 11, letterSpacing: 1, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 7 }}>
              ⚔️ Técnicas
            </div>
            {char.quirk_data.skills.filter(s => !s.locked).slice(0, 4).map((s, i) => (
              <div
                key={i}
                onClick={() => {
                  setText(`[Usa ${s.name}] ${s.desc || ''}`)
                  setMode('action')
                }}
                style={{
                  background: 'var(--panel)',
                  border: '1px solid var(--border)',
                  borderRadius: 5,
                  padding: '7px 8px',
                  marginBottom: 5,
                  cursor: 'pointer',
                  transition: 'border-color .2s'
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--glow)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 11 }}>
                    {s.icon || '⚡'} {s.name}
                  </span>
                  <span style={{ fontSize: 7, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'rgba(37,99,235,.2)', color: 'var(--blue-l)' }}>
                    {s.type}
                  </span>
                </div>
                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 8, color: 'var(--red-l)', marginBottom: 2 }}>
                  {s.cost}
                </div>
                <div style={{ fontSize: 9.5, color: 'var(--dim)', lineHeight: 1.35 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
