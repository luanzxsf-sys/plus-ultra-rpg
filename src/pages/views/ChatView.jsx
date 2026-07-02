import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  getLocations, sendMessage, getMessages, supabase,
  getServerConfig, getAllProfiles, getNpcs
} from '../../lib/supabase'
import Avatar, { TEXT_COLOR, avatarBg } from '../../components/Avatar'
import { notify } from '../../components/Toast'

function rollD(sides) { return Math.floor(Math.random() * sides) + 1 }

const MODES = [
  { k:'rp',     l:'✍️ RP',    placeholder:'Descreva a ação do personagem...' },
  { k:'ooc',    l:'💬 OOC',   placeholder:'[OOC] Fale fora do personagem...' },
  { k:'action', l:'⚡ Ação',  placeholder:'Declare uma ação de combate...' },
]

export default function ChatView({ onViewChange }) {
  const { user, profile, character } = useAuth()
  const [locations, setLocations]     = useState([])
  const [currentLoc, setCurrentLoc]   = useState(null)
  const [messages, setMessages]       = useState([])
  const [onlinePlayers, setOnlinePlayers] = useState([])
  const [sceneInfo, setSceneInfo]     = useState({ name:'Sem cena', desc:'Configure em Locais.', tags:[] })
  const [text, setText]               = useState('')
  const [mode, setMode]               = useState('rp')
  const [activeNpc, setActiveNpc]     = useState(null)
  const [npcs, setNpcs]               = useState([])
  const [showNpcPicker, setShowNpcPicker] = useState(false)
  const endRef   = useRef(null)
  const subRef   = useRef(null)
  const char     = character

  useEffect(() => {
    getLocations().then(({ data }) => { if (data?.length) { setLocations(data); setCurrentLoc(data[0]) } })
    getServerConfig().then(({ data }) => { if (data) setSceneInfo({ name:data.scene_name, desc:data.scene_desc, tags:data.scene_tags||[] }) })
    getAllProfiles().then(({ data }) => { if (data) setOnlinePlayers(data.filter(p=>p.is_online)) })
    getNpcs().then(({ data }) => { if (data) setNpcs(data) })
  }, [])

  useEffect(() => {
    if (!currentLoc) return
    getMessages(currentLoc.id, 60).then(({ data }) => setMessages(data || []))
    if (subRef.current) subRef.current.unsubscribe()
    subRef.current = supabase.channel(`chat-loc-${currentLoc.id}`)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'messages', filter:`location_id=eq.${currentLoc.id}` },
        ({ new: msg }) => setMessages(p => [...p, msg]))
      .subscribe()
    return () => { if (subRef.current) subRef.current.unsubscribe() }
  }, [currentLoc?.id])

  // Presença em tempo real
  useEffect(() => {
    const ch = supabase.channel('chat-presence')
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'profiles' }, () =>
        getAllProfiles().then(({ data }) => { if (data) setOnlinePlayers(data.filter(p=>p.is_online)) }))
      .subscribe()
    return () => ch.unsubscribe()
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])

  async function handleSend() {
    if (!text.trim() || !currentLoc || !user) return
    const name  = activeNpc ? activeNpc.name        : (char?.name  || profile?.username || 'Herói')
    const alias = activeNpc ? (activeNpc.alias||'')  : (char?.alias || '')
    const color = activeNpc ? (activeNpc.avatar_color||'gray') : (char?.avatar_color || 'purple')
    await sendMessage({
      location_id: currentLoc.id,
      user_id:     user.id,
      author_name: name,
      author_alias:alias,
      author_color:color,
      content:     text.trim(),
      mode,
      npc_id:      activeNpc?.id || null,
    })
    setText('')
  }

  function rollInChat() {
    const r = rollD(20)
    const color = r===20?'#4ade80':r===1?'#f87171':'#fbbf24'
    const lbl   = r===20?'CRÍTICO! 🌟':r===1?'FALHA CRÍTICA! 💀':r>=15?'Sucesso!':r>=8?'Parcial':'Falha!'
    setMessages(p => [...p, {
      id: `local-${Date.now()}`,
      author_name: 'Sistema',
      author_color:'gray',
      content: `🎲 ${char?.name||profile?.username||'?'} rolou D20 — [${r}] — ${lbl}`,
      mode:'roll',
      created_at: new Date().toISOString(),
    }])
  }

  function msgClass(m) {
    return m==='rp'?'msg-rp':m==='action'?'msg-act':m==='ooc'?'msg-ooc':m==='roll'?'msg-roll':'msg-text'
  }

  const skills = (char?.quirk_data?.skills||[]).filter(s=>!s.locked)

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 250px', height:'calc(100vh - 46px)', overflow:'hidden' }}>
      {/* ── MAIN CHAT ── */}
      <div style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Location tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid var(--border)', background:'var(--card)', flexShrink:0, overflowX:'auto' }}>
          {locations.map(loc => (
            <div key={loc.id} onClick={() => setCurrentLoc(loc)} style={{ padding:'8px 14px', cursor:'pointer', fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:10, letterSpacing:1, textTransform:'uppercase', color: currentLoc?.id===loc.id?'var(--blue-l)':'var(--muted)', borderBottom:`2px solid ${currentLoc?.id===loc.id?'var(--blue)':'transparent'}`, whiteSpace:'nowrap', transition:'all .2s', flexShrink:0 }}>
              {loc.icon} {loc.name}
            </div>
          ))}
          {locations.length === 0 && (
            <div style={{ padding:'8px 14px', fontSize:10, color:'var(--dim)' }}>
              Sem locais — <button className="btn btn-g btn-sm" onClick={()=>onViewChange('explore')}>Criar em Locais</button>
            </div>
          )}
        </div>

        {/* Vitals */}
        {char && (
          <div className="vitals-bar">
            {[
              { lbl:'HP',    v:char.hp,           m:char.hp_max,      c: (char.hp/char.hp_max)>0.5?'var(--green)':(char.hp/char.hp_max)>0.25?'var(--gold)':'var(--red)', tc:'var(--green-l)' },
              { lbl:'Quirk', v:char.quirk_charge, m:char.quirk_max,   c:'var(--purple)', tc:'var(--purple-l)' },
              { lbl:'Estam', v:char.stamina,       m:char.stamina_max, c:'var(--blue)',   tc:'var(--blue-l)' },
            ].map(b => {
              const pct = b.m>0 ? Math.min(100, Math.round(b.v/b.m*100)) : 100
              return (
                <div key={b.lbl} className="vit">
                  <span className="vit-lbl">{b.lbl}</span>
                  <div className="vit-bar"><div className="vit-fill" style={{ width:`${pct}%`, background:b.c }} /></div>
                  <span className="vit-val" style={{ color:b.tc }}>{b.v}/{b.m}</span>
                </div>
              )
            })}
            <span style={{ marginLeft:'auto', fontSize:9, color:'var(--dim)' }}>
              EXP {char.xp}/{char.xp_max}
            </span>
          </div>
        )}

        {/* Messages */}
        <div className="msgs" style={{ flex:1 }}>
          {!currentLoc && (
            <div style={{ textAlign:'center', padding:32, color:'var(--dim)', fontSize:12 }}>
              Nenhum local criado. <button className="btn btn-p btn-sm" onClick={()=>onViewChange('explore')}>Criar local</button>
            </div>
          )}
          {currentLoc && messages.length===0 && (
            <div style={{ textAlign:'center', padding:32, color:'var(--dim)', fontSize:12 }}>Sem mensagens em <strong>{currentLoc.name}</strong>. Comece o RP!</div>
          )}
          {messages.map((msg, i) => {
            const isMe  = msg.user_id===user?.id && !msg.npc_id
            const isNpc = !!msg.npc_id
            return (
              <div key={msg.id||i} className="msg">
                <div style={{ width:32, height:32, borderRadius:'50%', background:avatarBg(msg.author_color||'purple'), display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Bangers,cursive', fontSize:13, color:'#fff', flexShrink:0, overflow:'hidden', border: isNpc?'2px solid var(--gold)':'none' }}>
                  {msg.author_name?.[0]?.toUpperCase()||'?'}
                </div>
                <div className="msg-body">
                  <div className="msg-head">
                    <span className="msg-name" style={{ color: TEXT_COLOR[msg.author_color]||'var(--text)' }}>{msg.author_name}</span>
                    {msg.author_alias && <span className="tag" style={{ background:'rgba(124,58,237,.15)', color:'var(--purple-l)', border:'1px solid rgba(124,58,237,.3)', fontSize:7 }}>{msg.author_alias}</span>}
                    {isNpc  && <span className="tag" style={{ background:'rgba(255,179,0,.15)', color:'var(--gold)', border:'1px solid rgba(255,179,0,.3)', fontSize:7 }}>NPC</span>}
                    {isMe   && <span className="tag" style={{ background:'rgba(37,99,235,.15)', color:'var(--blue-l)', border:'1px solid rgba(37,99,235,.25)', fontSize:7 }}>VOCÊ</span>}
                    <span className="msg-time">{new Date(msg.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>
                  </div>
                  <div className={`msg-text ${msgClass(msg.mode)}`}>{msg.content}</div>
                  {msg.image_url && <img src={msg.image_url} alt="" className="msg-img" />}
                </div>
              </div>
            )
          })}
          <div ref={endRef} />
        </div>

        {/* ── INPUT REDESENHADO ── */}
        <div className="chat-input-area">
          {/* NPC ativo */}
          {activeNpc && (
            <div className="chat-input-npc" style={{ padding:'6px 12px', background:'rgba(255,179,0,.06)', borderBottom:'1px solid rgba(255,179,0,.2)' }}>
              <div style={{ width:20, height:20, borderRadius:'50%', background:avatarBg(activeNpc.avatar_color||'gray'), display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Bangers,cursive', fontSize:9, color:'#fff', border:'1px solid var(--gold)', flexShrink:0 }}>{activeNpc.name[0]}</div>
              <span style={{ fontSize:10, color:'var(--gold)', fontWeight:700 }}>Falando como: {activeNpc.name}</span>
              <button onClick={()=>setActiveNpc(null)} style={{ marginLeft:'auto', background:'transparent', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:14, lineHeight:1 }}>✕</button>
            </div>
          )}

          {/* Mode tabs */}
          <div className="chat-input-modes">
            {MODES.map(m => (
              <button key={m.k} className={`mode-btn ${mode===m.k?'active':''}`} onClick={()=>setMode(m.k)}>{m.l}</button>
            ))}
            <button className="mode-btn" onClick={rollInChat}>🎲 D20</button>
            <button className="mode-btn" onClick={()=>setShowNpcPicker(true)} title="Vestir NPC" style={{ color:activeNpc?'var(--gold)':'var(--dim)' }}>🎭 {activeNpc?activeNpc.name.slice(0,8):'NPC'}</button>
          </div>

          {/* Text + send */}
          <div className="chat-input-body">
            <textarea
              className="chat-textarea"
              rows={1}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder={activeNpc ? `Como ${activeNpc.name}: ${MODES.find(m=>m.k===mode)?.placeholder||''}` : MODES.find(m=>m.k===mode)?.placeholder||''}
              disabled={!currentLoc}
            />
            <button className="chat-send" onClick={handleSend} disabled={!currentLoc || !text.trim()}>↑</button>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{ display:'flex', flexDirection:'column', overflowY:'auto', background:'var(--bg)', borderLeft:'1px solid var(--border)' }} className="chat-right">

        {/* Online */}
        <div style={{ padding:'10px 11px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ fontFamily:'Bangers,cursive', fontSize:11, letterSpacing:1, color:'var(--muted)', textTransform:'uppercase', marginBottom:7 }}>
            👥 Online ({onlinePlayers.length})
          </div>
          {onlinePlayers.length===0 && <div style={{ fontSize:10, color:'var(--dim)' }}>Nenhum online.</div>}
          {onlinePlayers.map(p => (
            <div key={p.id} className="player-row">
              <Avatar name={p.characters?.[0]?.name||p.username} color={p.characters?.[0]?.avatar_color||'purple'} url={p.characters?.[0]?.avatar_url||p.avatar_url} size={26} ring="online" />
              <div className="p-info">
                <div className="p-name">{p.username}</div>
                <div className="p-char">{p.characters?.[0]?.name||'—'}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Cena atual */}
        <div style={{ padding:'10px 11px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ fontFamily:'Bangers,cursive', fontSize:11, letterSpacing:1, color:'var(--muted)', textTransform:'uppercase', marginBottom:7 }}>📍 Cena</div>
          <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:6, padding:9 }}>
            <div style={{ fontSize:7, letterSpacing:2, color:'var(--dim)', textTransform:'uppercase', marginBottom:3 }}>Local</div>
            <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:13, color:'var(--blue-l)', marginBottom:2 }}>{sceneInfo.name}</div>
            <div style={{ fontSize:10, color:'var(--muted)', lineHeight:1.35, marginBottom:5 }}>{sceneInfo.desc}</div>
            <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
              {(sceneInfo.tags||[]).map(t=>(
                <span key={t} className="tag" style={{ background:'rgba(37,99,235,.15)', color:'var(--blue-l)', border:'1px solid rgba(37,99,235,.25)' }}>{t}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Meu personagem */}
        {char && (
          <div style={{ padding:'10px 11px', borderBottom:'1px solid var(--border)' }}>
            <div style={{ fontFamily:'Bangers,cursive', fontSize:11, letterSpacing:1, color:'var(--muted)', textTransform:'uppercase', marginBottom:8 }}>🦸 Personagem</div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <Avatar name={char.name} color={char.avatar_color} url={char.avatar_url} size={36} />
              <div>
                <div style={{ fontFamily:'Bangers,cursive', fontSize:15, letterSpacing:1 }}>{char.name}</div>
                {char.alias && <div style={{ fontSize:9, color:'var(--gold)', letterSpacing:1 }}>"{char.alias}"</div>}
                {char.rank  && <div style={{ fontSize:9, color:'var(--muted)' }}>{char.rank}</div>}
              </div>
            </div>
            {char.quirk_data?.name && (
              <div style={{ fontSize:10, color:'var(--purple-l)', fontStyle:'italic', marginBottom:6 }}>✨ {char.quirk_data.name}</div>
            )}
          </div>
        )}

        {/* Técnicas rápidas */}
        {skills.length > 0 && (
          <div style={{ padding:'10px 11px' }}>
            <div style={{ fontFamily:'Bangers,cursive', fontSize:11, letterSpacing:1, color:'var(--muted)', textTransform:'uppercase', marginBottom:7 }}>⚔️ Técnicas Rápidas</div>
            {skills.slice(0,4).map((s,i)=>(
              <div key={i} onClick={() => { setText(`[${s.name}] ${s.desc||''}`.trim()); setMode('action') }}
                style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:5, padding:'6px 8px', marginBottom:5, cursor:'pointer', transition:'border-color .15s' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor='var(--glow)'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:11 }}>{s.icon||'⚡'} {s.name}</span>
                  <span style={{ fontSize:8, color:'var(--blue-l)' }}>{s.type}</span>
                </div>
                {s.cost && <div style={{ fontFamily:'Orbitron,monospace', fontSize:8, color:'var(--red-l)', marginTop:2 }}>{s.cost}</div>}
              </div>
            ))}
            <div style={{ fontSize:9, color:'var(--dim)' }}>Clique para preencher o input</div>
          </div>
        )}
      </div>

      {/* NPC Picker */}
      {showNpcPicker && (
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setShowNpcPicker(false)}>
          <div className="modal" style={{ maxWidth:400 }}>
            <div className="modal-hdr">
              <div className="modal-title">🎭 Vestir NPC</div>
              <button className="modal-close" onClick={()=>setShowNpcPicker(false)}>✕</button>
            </div>
            <div style={{ fontSize:11, color:'var(--muted)', marginBottom:12 }}>Suas mensagens serão enviadas como o NPC selecionado.</div>
            {/* Você mesmo */}
            <div className="player-row" onClick={()=>{setActiveNpc(null);setShowNpcPicker(false)}} style={{ padding:'8px 10px', borderRadius:6, border:`1px solid ${!activeNpc?'var(--blue)':'var(--border)'}`, marginBottom:6, background:!activeNpc?'rgba(37,99,235,.08)':'transparent' }}>
              <Avatar name={char?.name||profile?.username} color={char?.avatar_color||'purple'} url={char?.avatar_url} size={28} />
              <div className="p-info">
                <div className="p-name">Você mesmo — {char?.name||profile?.username}</div>
              </div>
              {!activeNpc && <span style={{ color:'var(--blue-l)', fontSize:12 }}>✓</span>}
            </div>
            {npcs.map(npc=>(
              <div key={npc.id} className="player-row" onClick={()=>{setActiveNpc(npc);setShowNpcPicker(false)}} style={{ padding:'8px 10px', borderRadius:6, border:`1px solid ${activeNpc?.id===npc.id?'var(--gold)':'var(--border)'}`, marginBottom:6, background:activeNpc?.id===npc.id?'rgba(255,179,0,.06)':'transparent', cursor:'pointer' }}>
                <Avatar name={npc.name} color={npc.avatar_color||'gray'} url={npc.avatar_url} size={28} />
                <div className="p-info">
                  <div className="p-name">{npc.name}</div>
                  <div className="p-char">{npc.role} · {npc.quirk_name||'—'}</div>
                </div>
                {activeNpc?.id===npc.id && <span style={{ color:'var(--gold)', fontSize:12 }}>✓</span>}
              </div>
            ))}
            {npcs.length===0 && <div style={{ fontSize:11, color:'var(--dim)', padding:8 }}>Nenhum NPC criado. Vá em <strong>NPCs</strong> para criar.</div>}
          </div>
        </div>
      )}
    </div>
  )
}
