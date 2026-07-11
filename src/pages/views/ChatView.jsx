import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getMessages, sendMessage, supabase, getAllProfiles, getNpcs } from '../../lib/supabase'
import Avatar, { TEXT_COLOR, avatarBg } from '../../components/Avatar'
import { notify } from '../../components/Toast'

// Chat geral — sem sala única de local, sem RPG
// Mensagens ficam em location_id = null (chat global)
const GLOBAL_LOCATION_ID = null

export default function ChatView({ onViewChange }) {
  const { user, profile, character } = useAuth()
  const [messages, setMessages]       = useState([])
  const [onlinePlayers, setOnlinePlayers] = useState([])
  const [npcs, setNpcs]               = useState([])
  const [text, setText]               = useState('')
  const [activeNpc, setActiveNpc]     = useState(null)
  const [showNpcPicker, setShowNpcPicker] = useState(false)
  const endRef = useRef(null)
  const subRef = useRef(null)
  const char   = character

  useEffect(() => {
    // Load global messages (sem location_id)
    supabase.from('messages').select('*').is('location_id', null).order('created_at', { ascending: false }).limit(80)
      .then(({ data }) => setMessages((data || []).reverse()))

    getAllProfiles().then(({ data }) => { if (data) setOnlinePlayers(data.filter(p => p.is_online)) })
    getNpcs().then(({ data }) => { if (data) setNpcs(data) })

    // Realtime subscription for global chat
    subRef.current = supabase.channel('global-chat')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: 'location_id=is.null'
      }, ({ new: msg }) => setMessages(p => [...p, msg]))
      .subscribe()

    // Presence
    const pCh = supabase.channel('chat-presence-global')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () =>
        getAllProfiles().then(({ data }) => { if (data) setOnlinePlayers(data.filter(p => p.is_online)) }))
      .subscribe()

    return () => { subRef.current?.unsubscribe(); pCh.unsubscribe() }
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function handleSend() {
    if (!text.trim() || !user) return
    const name  = activeNpc ? activeNpc.name        : (char?.name  || profile?.username || 'Herói')
    const alias = activeNpc ? (activeNpc.alias || '') : (char?.alias || '')
    const color = activeNpc ? (activeNpc.avatar_color || 'gray') : (char?.avatar_color || 'purple')
    const avatar = activeNpc ? (activeNpc.avatar_url || null) : (char?.avatar_url || null)
    await sendMessage({
      location_id:  null,
      user_id:      user.id,
      author_name:  name,
      author_alias: alias,
      author_color: color,
      content:      text.trim(),
      mode:         'chat',
      npc_id:       activeNpc?.id || null,
      author_avatar_url: avatar,
    })
    setText('')
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 240px', height:'calc(100vh - 48px)', overflow:'hidden' }} className="chat-wrap-grid">
      {/* MAIN */}
      <div style={{ display:'flex', flexDirection:'column', overflow:'hidden' }} className="chat-main-col">
        {/* Header */}
        <div style={{ padding:'8px 14px', borderBottom:'1px solid var(--border)', background:'var(--card)', flexShrink:0, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:16 }}>💬</span>
          <div>
            <div style={{ fontFamily:'Bangers,cursive', fontSize:14, letterSpacing:1, color:'var(--text-h)' }}>CHAT GERAL</div>
            <div style={{ fontSize:9, color:'var(--dim)' }}>Para RP nos locais, acesse <button onClick={()=>onViewChange('explore')} className="btn btn-g btn-sm" style={{ marginLeft:4 }}>🗺️ Locais</button></div>
          </div>
          <div style={{ marginLeft:'auto', fontSize:10, color:'var(--muted)', display:'flex', alignItems:'center', gap:4 }}>
            <span className="live" />{onlinePlayers.length} online
          </div>
        </div>

        {/* Messages */}
        <div className="msgs" style={{ flex:1 }}>
          {messages.length === 0 && (
            <div style={{ textAlign:'center', padding:40, color:'var(--dim)', fontSize:12 }}>
              Nenhuma mensagem ainda. Comece uma conversa!
            </div>
          )}
          {messages.map((msg, i) => {
            const isMe  = msg.user_id === user?.id && !msg.npc_id
            const isNpc = !!msg.npc_id
            return (
              <div key={msg.id || i} className="msg">
                <div style={{ width:36, height:36, borderRadius:'50%', background:avatarBg(msg.author_color||'purple'), display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Bangers,cursive', fontSize:14, color:'#fff', flexShrink:0, overflow:'hidden', border: isNpc?'2px solid var(--gold)':'none', marginTop:1 }}>
                  {msg.author_avatar_url
                    ? <img src={msg.author_avatar_url} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }}/>
                    : msg.author_name?.[0]?.toUpperCase()||'?'}
                </div>
                <div className="msg-body">
                  <div className="msg-head">
                    <span className="msg-name" style={{ color: TEXT_COLOR[msg.author_color]||'var(--text-h)' }}>{msg.author_name}</span>
                    {msg.author_alias && <span className="tag" style={{ background:'rgba(155,89,182,.15)', color:'var(--purple-l)', border:'1px solid rgba(155,89,182,.3)', fontSize:7 }}>{msg.author_alias}</span>}
                    {isNpc && <span className="tag" style={{ background:'rgba(255,179,0,.15)', color:'var(--gold)', border:'1px solid rgba(255,179,0,.3)', fontSize:7 }}>NPC</span>}
                    {isMe  && <span className="tag" style={{ background:'rgba(88,101,242,.15)', color:'var(--blue-l)', border:'1px solid rgba(88,101,242,.3)', fontSize:7 }}>VOCÊ</span>}
                    <span className="msg-time">{new Date(msg.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>
                  </div>
                  <div className="msg-text">{msg.content}</div>
                  {msg.image_url && <img src={msg.image_url} alt="" className="msg-img"/>}
                </div>
              </div>
            )
          })}
          <div ref={endRef}/>
        </div>

        {/* Input */}
        <div className="chat-input-area">
          {activeNpc && (
            <div className="chat-input-npc">
              <div style={{ width:20, height:20, borderRadius:'50%', background:avatarBg(activeNpc.avatar_color||'gray'), display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Bangers,cursive', fontSize:9, color:'#fff', border:'1px solid var(--gold)', flexShrink:0 }}>{activeNpc.name[0]}</div>
              <span style={{ fontSize:10, color:'var(--gold)', fontWeight:700 }}>Falando como: {activeNpc.name}</span>
              <button onClick={()=>setActiveNpc(null)} style={{ marginLeft:'auto', background:'transparent', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:14, lineHeight:1 }}>✕</button>
            </div>
          )}
          <div className="chat-input-body">
            <button className="btn btn-g btn-sm" style={{ flexShrink:0, color:activeNpc?'var(--gold)':'var(--dim)', borderColor:activeNpc?'rgba(255,179,0,.4)':'var(--border)' }} onClick={()=>setShowNpcPicker(true)} title="Falar como NPC">🎭</button>
            <textarea
              className="chat-textarea"
              rows={1}
              value={text}
              onChange={e=>setText(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend()} }}
              placeholder={activeNpc ? `Como ${activeNpc.name}...` : 'Escreva uma mensagem...'}
            />
            <button className="chat-send" onClick={handleSend} disabled={!text.trim()}>↑</button>
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div style={{ display:'flex', flexDirection:'column', overflowY:'auto', background:'var(--card)', borderLeft:'1px solid var(--border)' }} className="chat-right">
        <div style={{ padding:'10px 11px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ fontFamily:'Bangers,cursive', fontSize:11, letterSpacing:1, color:'var(--muted)', textTransform:'uppercase', marginBottom:7 }}>👥 Online ({onlinePlayers.length})</div>
          {onlinePlayers.length===0 && <div style={{ fontSize:10, color:'var(--dim)' }}>Nenhum online.</div>}
          {onlinePlayers.map(p=>(
            <div key={p.id} className="player-row">
              <Avatar name={p.characters?.[0]?.name||p.username} color={p.characters?.[0]?.avatar_color||'purple'} url={p.characters?.[0]?.avatar_url||p.avatar_url} size={26} ring="online"/>
              <div className="p-info">
                <div className="p-name">{p.username}</div>
                <div className="p-char">{p.characters?.[0]?.name||'—'}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding:'10px 11px' }}>
          <div style={{ fontFamily:'Bangers,cursive', fontSize:11, letterSpacing:1, color:'var(--muted)', textTransform:'uppercase', marginBottom:7 }}>🗺️ Locais de RP</div>
          <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.6, marginBottom:8 }}>O roleplay acontece dentro de cada local, com chat dedicado e sistema de combate.</div>
          <button className="btn btn-p btn-full btn-sm" onClick={()=>onViewChange('explore')}>→ Acessar Locais</button>
        </div>
      </div>

      {/* NPC PICKER */}
      {showNpcPicker && (
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setShowNpcPicker(false)}>
          <div className="modal" style={{ maxWidth:380 }}>
            <div className="modal-hdr"><div className="modal-title">🎭 Vestir NPC</div><button className="modal-close" onClick={()=>setShowNpcPicker(false)}>✕</button></div>
            <div style={{ marginBottom:12, fontSize:11, color:'var(--muted)' }}>Suas mensagens serão enviadas como o NPC selecionado.</div>
            <div className="player-row" onClick={()=>{setActiveNpc(null);setShowNpcPicker(false)}} style={{ padding:'8px 10px', borderRadius:6, border:`1px solid ${!activeNpc?'var(--blue)':'var(--border)'}`, marginBottom:6, background:!activeNpc?'rgba(88,101,242,.08)':'transparent' }}>
              <Avatar name={char?.name||profile?.username} color={char?.avatar_color||'purple'} url={char?.avatar_url} size={28}/>
              <div className="p-info"><div className="p-name">Você mesmo — {char?.name||profile?.username}</div></div>
              {!activeNpc && <span style={{ color:'var(--blue-l)', fontSize:14 }}>✓</span>}
            </div>
            {npcs.map(npc=>(
              <div key={npc.id} className="player-row" onClick={()=>{setActiveNpc(npc);setShowNpcPicker(false)}} style={{ padding:'8px 10px', borderRadius:6, border:`1px solid ${activeNpc?.id===npc.id?'var(--gold)':'var(--border)'}`, marginBottom:6, background:activeNpc?.id===npc.id?'rgba(255,179,0,.06)':'transparent', cursor:'pointer' }}>
              <Avatar name={npc.name} color={npc.avatar_color||'gray'} url={npc.avatar_url} size={28}/>
              <div className="p-info"><div className="p-name">{npc.name}</div><div className="p-char">{npc.role} · {npc.quirk_name||'—'}</div></div>
              {activeNpc?.id===npc.id && <span style={{ color:'var(--gold)', fontSize:14 }}>✓</span>}
            </div>
          ))}
          {npcs.length===0 && <div style={{ fontSize:11, color:'var(--dim)', padding:8, textAlign:'center' }}>Nenhum NPC. Crie em <strong>🎭 NPCs</strong>.</div>}
        </div>
      </div>
    )}
  </div>
  )
}
