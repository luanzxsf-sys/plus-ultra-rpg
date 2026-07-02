import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  getLocations, upsertLocation, deleteLocation,
  getMessages, sendMessage, supabase, uploadToBucket,
  getActiveCombatSession, createCombatSession, endCombatSession,
  getCombatants, addCombatant, updateCombatant, deleteCombatant, applyCombatEffect,
  getCombatActions, addCombatAction, updateServerConfig, getServerConfig,
  getNpcs, getAllProfiles, getQuests
} from '../../lib/supabase'
import { notify } from '../../components/Toast'
import Modal from '../../components/Modal'
import Avatar, { TEXT_COLOR, avatarBg } from '../../components/Avatar'

const QUIRK_BONUSES = {
  'Emitter':        { attr:'forca',       bonus:10 },
  'Transformation': { attr:'resistencia', bonus:10 },
  'Accumulation':   { attr:'resistencia', bonus:15 },
  'Mutant':         { attr:'agilidade',   bonus:10 },
  'Tool':           { attr:'inteligencia',bonus:10 },
  'Composite':      { attr:'controle',    bonus:10 },
}

function calcAtk(attrs, quirkType) {
  const base = (attrs?.forca || 0)
  const bonus = QUIRK_BONUSES[quirkType]?.attr === 'forca' ? QUIRK_BONUSES[quirkType].bonus : 0
  return Math.max(1, base + bonus)
}

function rollD(sides) { return Math.floor(Math.random() * sides) + 1 }
function rollDmg(attrs, quirkType) {
  const atk = calcAtk(attrs, quirkType)
  return rollD(6) + Math.floor(atk * 1.2)
}

/* ── NEWSLETTER GRID ── */
function LocationsGrid({ locations, onSelect, onAdd, onEdit, onDelete }) {
  return (
    <div style={{ flex:1, overflowY:'auto', padding:14 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ fontFamily:'Bangers,cursive', fontSize:20, letterSpacing:3, color:'var(--text)' }}>🗺️ LOCAIS</div>
        <div style={{ fontSize:11, color:'var(--muted)' }}>{locations.length} locais criados</div>
        <button className="btn btn-p btn-sm" style={{ marginLeft:'auto' }} onClick={onAdd}>+ Novo Local</button>
      </div>

      {locations.length === 0 && (
        <div style={{ textAlign:'center', padding:40, color:'var(--muted)', fontSize:13 }}>
          <div style={{ fontSize:48, marginBottom:12 }}>🗺️</div>
          <div style={{ fontFamily:'Bangers,cursive', fontSize:18, letterSpacing:2, color:'var(--blue-l)', marginBottom:8 }}>NENHUM LOCAL CRIADO</div>
          Crie locais para o seu servidor de RP. Cada local tem seu próprio chat e pode ter missões e combates vinculados.
          <br/><button className="btn btn-p btn-lg" style={{ marginTop:16 }} onClick={onAdd}>+ Criar Primeiro Local</button>
        </div>
      )}

      <div className="loc-news-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
        {locations.map(loc => (
          <div key={loc.id} className="loc-news-card" onClick={() => onSelect(loc)}>
            {loc.cover_url
              ? <img src={loc.cover_url} alt="" className="loc-news-cover" />
              : <div className="loc-news-cover-placeholder" style={{ background:`linear-gradient(135deg,var(--panel),var(--bg))` }}>{loc.icon||'🗺️'}</div>
            }
            <div className="loc-news-body">
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:6 }}>
                <div>
                  <div className="loc-news-name">{loc.icon||'🗺️'} {loc.name}</div>
                  {loc.description && <div className="loc-news-desc">{loc.description}</div>}
                </div>
                <div style={{ display:'flex', gap:4, flexShrink:0 }} onClick={e => e.stopPropagation()}>
                  <button className="btn btn-g btn-sm" onClick={() => onEdit(loc)}>✏️</button>
                  <button className="btn btn-danger btn-sm" onClick={() => onDelete(loc)}>🗑️</button>
                </div>
              </div>
              <div className="loc-news-meta">
                {loc.pinned && <span className="loc-pin-badge">📌 Fixado</span>}
                {loc.is_combat && <span className="loc-combat-badge">⚔️ Em combate</span>}
                <span className="tag" style={{ background:'var(--panel)', color:'var(--muted)', border:'1px solid var(--border)' }}>{loc.status||'Livre'}</span>
                {loc.category && <span style={{ fontSize:9, color:'var(--dim)' }}>{loc.category}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── CHAT INSIDE LOCATION ── */
function LocationChat({ loc, onBack, onRefreshLocs }) {
  const { user, profile, character } = useAuth()
  const [messages, setMessages]       = useState([])
  const [text, setText]               = useState('')
  const [mode, setMode]               = useState('rp')
  const [session, setSession]         = useState(null)
  const [combatants, setCombatants]   = useState([])
  const [combatLog, setCombatLog]     = useState([])
  const [targetId, setTargetId]       = useState(null)
  const [activeNpc, setActiveNpc]     = useState(null)  // NPC vestido pelo narrador
  const [npcs, setNpcs]               = useState([])
  const [allProfiles, setAllProfiles] = useState([])
  const [quests, setQuests]           = useState([])
  const [showCombatSetup, setShowCombatSetup] = useState(false)
  const [showNpcPicker, setShowNpcPicker]     = useState(false)
  const endRef    = useRef(null)
  const subMsgRef = useRef(null)
  const subCbtRef = useRef(null)
  const subActRef = useRef(null)

  const char = character

  async function load() {
    const { data: msgs }  = await getMessages(loc.id, 80)
    setMessages(msgs || [])
    const { data: sess }  = await getActiveCombatSession(loc.id)
    setSession(sess || null)
    if (sess) {
      const { data: cbs } = await getCombatants(sess.id)
      setCombatants(cbs || [])
      const { data: acts} = await getCombatActions(sess.id)
      setCombatLog(acts  || [])
    } else {
      setCombatants([]); setCombatLog([])
    }
    const { data: ns } = await getNpcs()
    setNpcs(ns || [])
    const { data: ps } = await getAllProfiles()
    setAllProfiles(ps || [])
    const { data: qs } = await getQuests(user.id)
    setQuests(qs || [])
  }

  useEffect(() => {
    load()
    // Realtime messages
    subMsgRef.current = supabase.channel(`loc-msg-${loc.id}`)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'messages', filter:`location_id=eq.${loc.id}` }, ({ new: m }) => setMessages(p => [...p, m]))
      .subscribe()
    // Realtime combatants
    subCbtRef.current = supabase.channel(`loc-cbt-${loc.id}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'combatants' }, async () => {
        const { data: sess } = await getActiveCombatSession(loc.id)
        if (sess) { const { data } = await getCombatants(sess.id); setCombatants(data || []) }
      })
      .subscribe()
    // Realtime combat actions
    subActRef.current = supabase.channel(`loc-act-${loc.id}`)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'combat_actions' }, ({ new: a }) => setCombatLog(p => [...p, a]))
      .subscribe()
    return () => {
      subMsgRef.current?.unsubscribe()
      subCbtRef.current?.unsubscribe()
      subActRef.current?.unsubscribe()
    }
  }, [loc.id])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages, combatLog])

  /* ── SEND MESSAGE ── */
  async function handleSend() {
    if (!text.trim() || !user) return
    const authorName  = activeNpc ? activeNpc.name  : (char?.name  || profile?.username || 'Herói')
    const authorAlias = activeNpc ? activeNpc.alias  : (char?.alias || '')
    const authorColor = activeNpc ? activeNpc.avatar_color : (char?.avatar_color || 'purple')
    await sendMessage({
      location_id:  loc.id,
      user_id:      user.id,
      author_name:  authorName,
      author_alias: authorAlias,
      author_color: authorColor,
      content:      text.trim(),
      mode,
      npc_id:       activeNpc?.id || null,
    })
    setText('')
  }

  /* ── COMBAT ACTIONS ── */
  async function startCombat(questId) {
    const { data: sess, error } = await createCombatSession(loc.id, questId || null, user.id)
    if (error) { notify('❌ '+error.message,'error'); return }
    // Adiciona o próprio jogador como combatente
    if (char) {
      await addCombatant({
        session_id:     sess.id,
        user_id:        user.id,
        character_name: char.name,
        avatar_color:   char.avatar_color,
        avatar_url:     char.avatar_url,
        hp:             char.hp || char.hp_max || 100,
        hp_max:         char.hp_max || 100,
        quirk_charge:   char.quirk_charge || char.quirk_max || 100,
        quirk_max:      char.quirk_max || 100,
        stamina:        char.stamina || char.stamina_max || 100,
        stamina_max:    char.stamina_max || 100,
        attrs:          char.attrs || {},
        quirk_data:     char.quirk_data || {},
        initiative:     rollD(20) + (char.attrs?.agilidade || 0),
        type:           'player',
      })
    }
    // Marca local como em combate
    await upsertLocation({ ...loc, is_combat: true })
    await addCombatAction({ session_id:sess.id, actor_name:'Sistema', action_type:'system', description:`⚔️ COMBATE INICIADO em ${loc.name}! Narradores podem adicionar NPCs/vilões.`, value:0 })
    setSession(sess); load(); setShowCombatSetup(false)
    notify('⚔️ Combate iniciado!', 'success')
  }

  async function endCombat() {
    if (!session || !confirm('Encerrar o combate? Todo o log será preservado.')) return
    await endCombatSession(session.id)
    await upsertLocation({ ...loc, is_combat: false })
    await addCombatAction({ session_id:session.id, actor_name:'Sistema', action_type:'system', description:'🏁 COMBATE ENCERRADO. Missão concluída.', value:0 })
    setSession(null); setCombatants([]); load()
    onRefreshLocs()
    notify('🏁 Combate encerrado!')
  }

  async function addNpcToCombat(npc) {
    if (!session) return
    await addCombatant({
      session_id:     session.id,
      npc_id:         npc.id,
      character_name: npc.name,
      avatar_color:   npc.avatar_color || 'gray',
      avatar_url:     npc.avatar_url,
      hp:             100, hp_max:100,
      quirk_charge:   100, quirk_max:100,
      stamina:        100, stamina_max:100,
      attrs:          {},
      quirk_data:     { name: npc.quirk_name || '' },
      initiative:     rollD(20),
      type:           npc.role === 'villain' ? 'villain' : 'npc',
    })
    await addCombatAction({ session_id:session.id, actor_name:'Sistema', action_type:'system', description:`👤 ${npc.name} entrou no combate!`, value:0 })
    load()
  }

  async function addPlayerToCombat(profile) {
    if (!session) return
    const c = profile.characters?.[0]
    if (!c) { notify('Jogador sem personagem','error'); return }
    const exists = combatants.find(cb => cb.user_id === profile.id)
    if (exists) { notify('Jogador já está no combate'); return }
    await addCombatant({
      session_id:     session.id,
      user_id:        profile.id,
      character_name: c.name,
      avatar_color:   c.avatar_color || 'blue',
      avatar_url:     c.avatar_url,
      hp:             c.hp || c.hp_max || 100,
      hp_max:         c.hp_max || 100,
      quirk_charge:   c.quirk_charge || c.quirk_max || 100,
      quirk_max:      c.quirk_max || 100,
      stamina:        c.stamina || c.stamina_max || 100,
      stamina_max:    c.stamina_max || 100,
      attrs:          c.attrs || {},
      quirk_data:     c.quirk_data || {},
      initiative:     rollD(20) + (c.attrs?.agilidade || 0),
      type:           'player',
    })
    await addCombatAction({ session_id:session.id, actor_name:'Sistema', action_type:'system', description:`⚡ ${c.name} entrou no combate!`, value:0 })
    load()
  }

  /* ── ATTACK ── */
  async function declareAttack(skill) {
    if (!session) return
    const attacker = combatants.find(cb => cb.user_id === user.id)
    if (!attacker) { notify('Você não está no combate. Peça ao narrador para te adicionar.','error'); return }
    if (!targetId) { notify('Selecione um alvo primeiro (clique em um combatente)','error'); return }
    const target = combatants.find(cb => cb.id === targetId)
    if (!target) return
    if (!target.is_alive) { notify('Alvo já está fora de combate','error'); return }

    const roll    = rollD(20)
    const isCrit  = roll === 20
    const isMiss  = roll === 1
    const quirkType = attacker.quirk_data?.type || ''
    let dmg = 0

    if (!isMiss) {
      dmg = rollDmg(attacker.attrs, quirkType)
      if (isCrit) dmg = Math.floor(dmg * 2)
      if (skill) {
        // Técnica usada tem custo de Quirk
        const quirkCost = Math.max(5, Math.floor(attacker.quirk_max * 0.12))
        await updateCombatant(attacker.id, { quirk_charge: Math.max(0, attacker.quirk_charge - quirkCost) })
      }
      await applyCombatEffect(target.id, -dmg)
    }

    const desc = isMiss
      ? `🎲 D20=${roll} — FALHA CRÍTICA! O ataque erra completamente.`
      : isCrit
      ? `🎲 D20=${roll} — GOLPE CRÍTICO! ${dmg} de dano em ${target.character_name}!`
      : `🎲 D20=${roll} — ${dmg} de dano em ${target.character_name}${skill ? ` com ${skill.name}` : ''}.`

    await addCombatAction({
      session_id:  session.id,
      actor_id:    attacker.id,
      actor_name:  attacker.character_name,
      target_id:   target.id,
      target_name: target.character_name,
      action_type: skill ? 'skill' : 'attack',
      skill_name:  skill?.name || null,
      roll_result: roll,
      value:       isMiss ? 0 : -dmg,
      description: desc,
    })

    // Envia também no chat para imersão
    await sendMessage({
      location_id:  loc.id,
      user_id:      user.id,
      author_name:  attacker.character_name,
      author_alias: char?.alias || '',
      author_color: attacker.avatar_color,
      content:      desc,
      mode:         'action',
    })

    setTargetId(null)
    load()
  }

  /* ── HEAL ── */
  async function declareHeal() {
    if (!session) return
    const healer = combatants.find(cb => cb.user_id === user.id)
    if (!healer || !targetId) { notify('Selecione o alvo da cura','error'); return }
    const target = combatants.find(cb => cb.id === targetId)
    if (!target) return
    const roll  = rollD(6)
    const heal  = roll + (healer.attrs?.carisma || 0)
    await applyCombatEffect(target.id, heal)
    await addCombatAction({
      session_id:  session.id,
      actor_id:    healer.id,
      actor_name:  healer.character_name,
      target_id:   target.id,
      target_name: target.character_name,
      action_type: 'heal',
      roll_result: roll,
      value:       heal,
      description: `💚 ${healer.character_name} cura ${target.character_name} por ${heal} HP! (D6=${roll}+${healer.attrs?.carisma||0})`,
    })
    await sendMessage({
      location_id: loc.id, user_id: user.id,
      author_name: healer.character_name, author_color: healer.avatar_color,
      content: `💚 Usa técnica de cura em ${target.character_name}! +${heal} HP`,
      mode: 'action',
    })
    setTargetId(null); load()
  }

  const myChar = combatants.find(cb => cb.user_id === user?.id)
  const skills = (char?.quirk_data?.skills || []).filter(s => !s.locked)

  const MODES = [
    { k:'rp',     l:'✍️ RP' },
    { k:'ooc',    l:'💬 OOC' },
    { k:'action', l:'⚡ Ação' },
  ]

  function msgStyle(m) {
    if (m.mode === 'rp')     return 'msg-rp'
    if (m.mode === 'action') return 'msg-act'
    if (m.mode === 'ooc')    return 'msg-ooc'
    return 'msg-text'
  }

  const hpColors = hp => hp > 50 ? 'var(--green)' : hp > 25 ? 'var(--gold)' : 'var(--red)'

  return (
    <div style={{ display:'flex', height:'calc(100vh - 46px)', overflow:'hidden' }}>
      {/* ── CHAT MAIN ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
        {/* Banner com bg blur */}
        <div style={{ position:'relative', height:110, flexShrink:0, overflow:'hidden', borderBottom:'1px solid var(--border)' }}>
          {loc.background_url && (
            <img src={loc.background_url} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', filter:'blur(4px) brightness(.4)', transform:'scale(1.05)' }} />
          )}
          {!loc.background_url && (
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,var(--card),var(--bg))' }} />
          )}
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', padding:'0 16px', gap:12 }}>
            <button className="btn btn-g btn-sm" onClick={onBack} style={{ flexShrink:0 }}>← Locais</button>
            <div style={{ fontSize:28 }}>{loc.icon||'🗺️'}</div>
            <div>
              <div style={{ fontFamily:'Bangers,cursive', fontSize:20, letterSpacing:2, textShadow:'0 2px 8px rgba(0,0,0,.8)' }}>{loc.name}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,.6)', marginTop:1 }}>{loc.description}</div>
            </div>
            <div style={{ marginLeft:'auto', display:'flex', gap:6, flexWrap:'wrap' }}>
              {loc.is_combat && !session && (
                <span className="tag" style={{ background:'rgba(220,38,38,.3)', color:'var(--red-l)', border:'1px solid rgba(220,38,38,.5)', fontSize:9 }}>⚔️ EM COMBATE</span>
              )}
              {!session && <button className="btn btn-red btn-sm" onClick={()=>setShowCombatSetup(true)}>⚔️ Iniciar Combate</button>}
              {session  && <button className="btn btn-danger btn-sm" onClick={endCombat}>🏁 Encerrar</button>}
              <button className="btn btn-g btn-sm" onClick={()=>setShowNpcPicker(true)} title="Vestir NPC">🎭 {activeNpc ? activeNpc.name : 'NPC'}</button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="msgs" style={{ flex:1 }}>
          {messages.length === 0 && (
            <div style={{ textAlign:'center', padding:24, color:'var(--dim)', fontSize:12 }}>
              Sem mensagens em <strong>{loc.name}</strong>. Comece o RP!
            </div>
          )}
          {messages.map((msg, i) => {
            const isMe = msg.user_id === user?.id && !msg.npc_id
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
                    {isNpc && <span className="tag" style={{ background:'rgba(255,179,0,.15)', color:'var(--gold)', border:'1px solid rgba(255,179,0,.3)', fontSize:7 }}>NPC</span>}
                    {isMe  && <span className="tag" style={{ background:'rgba(37,99,235,.15)', color:'var(--blue-l)', border:'1px solid rgba(37,99,235,.25)', fontSize:7 }}>VOCÊ</span>}
                    <span className="msg-time">{new Date(msg.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>
                  </div>
                  <div className={`msg-text ${msgStyle(msg)}`}>{msg.content}</div>
                  {msg.image_url && <img src={msg.image_url} alt="" className="msg-img" />}
                </div>
              </div>
            )
          })}
          <div ref={endRef} />
        </div>

        {/* ── NOVO INPUT DE CHAT ── */}
        <div className="chat-input-area">
          {activeNpc && (
            <div className="chat-input-npc">
              <div style={{ width:20, height:20, borderRadius:'50%', background:avatarBg(activeNpc.avatar_color||'gray'), display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Bangers,cursive', fontSize:9, color:'#fff', border:'1px solid var(--gold)', flexShrink:0 }}>{activeNpc.name[0]}</div>
              <span style={{ fontSize:10, color:'var(--gold)', fontWeight:700 }}>Falando como: {activeNpc.name}</span>
              <button onClick={()=>setActiveNpc(null)} style={{ marginLeft:'auto', background:'transparent', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:13 }}>✕</button>
            </div>
          )}
          <div className="chat-input-modes">
            {MODES.map(m => (
              <button key={m.k} className={`mode-btn ${mode===m.k?'active':''}`} onClick={()=>setMode(m.k)}>{m.l}</button>
            ))}
            {session && myChar && (
              <>
                <button className="mode-btn" style={{ color:'var(--red-l)' }} onClick={()=>declareAttack(null)} title="Ataque básico">⚔️ Atacar</button>
                <button className="mode-btn" style={{ color:'var(--green-l)' }} onClick={declareHeal} title="Curar alvo">💚 Curar</button>
                {skills.slice(0,3).map((sk,i) => (
                  <button key={i} className="mode-btn" style={{ color:'var(--purple-l)' }} onClick={()=>declareAttack(sk)} title={sk.desc}>{sk.icon||'⚡'} {sk.name}</button>
                ))}
              </>
            )}
          </div>
          <div className="chat-input-body">
            <textarea
              className="chat-textarea"
              rows={1}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder={
                mode==='rp'     ? `Escreva como ${activeNpc?.name || char?.name || 'seu personagem'}...` :
                mode==='ooc'    ? '[OOC] Fale fora do personagem...' :
                                  '⚡ Declare uma ação...'
              }
            />
            <button className="chat-send" onClick={handleSend}>↑</button>
          </div>
        </div>
      </div>

      {/* ── PAINEL LATERAL: COMBATE / ONLINE ── */}
      <div style={{ width:240, flexShrink:0, borderLeft:'1px solid var(--border)', display:'flex', flexDirection:'column', overflowY:'auto', background:'var(--card)' }} className="chat-right">

        {/* COMBATE ATIVO */}
        {session && (
          <div style={{ padding:10, borderBottom:'1px solid var(--border)' }}>
            <div style={{ fontFamily:'Bangers,cursive', fontSize:12, letterSpacing:2, color:'var(--red-l)', marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span><span className="live" />COMBATE · R{session.round}</span>
              <div style={{ display:'flex', gap:4 }}>
                <button className="btn btn-g btn-sm" onClick={()=>setShowCombatSetup(true)} title="Adicionar combatente">+</button>
              </div>
            </div>

            {targetId && (
              <div style={{ marginBottom:6, padding:'4px 7px', background:'rgba(220,38,38,.1)', borderRadius:4, fontSize:10, color:'var(--red-l)', border:'1px solid rgba(220,38,38,.3)' }}>
                🎯 Alvo: <strong>{combatants.find(c=>c.id===targetId)?.character_name}</strong>
                <button onClick={()=>setTargetId(null)} style={{ float:'right', background:'transparent', border:'none', color:'var(--dim)', cursor:'pointer' }}>✕</button>
              </div>
            )}

            {combatants.length===0 && <div style={{ fontSize:10, color:'var(--dim)', textAlign:'center', padding:8 }}>Sem combatentes. Use + para adicionar.</div>}

            {combatants.map(cb => {
              const hpPct = cb.hp_max>0 ? Math.min(100, Math.round(cb.hp/cb.hp_max*100)) : 100
              const isTarget = cb.id === targetId
              const isMe = cb.user_id === user?.id
              return (
                <div key={cb.id} className={`combatant-row ${isTarget?'selected':''} ${!cb.is_alive?'dead':''}`} onClick={()=>setTargetId(isTarget?null:cb.id)}>
                  <div style={{ width:24, height:24, borderRadius:'50%', background:avatarBg(cb.avatar_color||'blue'), display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Bangers,cursive', fontSize:10, color:'#fff', flexShrink:0, border: cb.type==='villain'?'1.5px solid var(--red)': cb.type==='npc'?'1.5px solid var(--gold)':'1.5px solid var(--green)' }}>
                    {cb.character_name?.[0]||'?'}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:10, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color: !cb.is_alive?'var(--dim)':'var(--text)' }}>
                      {cb.type==='villain'?'💀 ':cb.type==='npc'?'🎭 ':'⚡ '}{cb.character_name}
                      {isMe && <span style={{ color:'var(--blue-l)', fontSize:8, marginLeft:3 }}>(você)</span>}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:3, marginTop:2 }}>
                      <div className="hp-mini"><div className="hp-mini-fill" style={{ width:`${hpPct}%`, background:hpColors(hpPct) }} /></div>
                      <span style={{ fontFamily:'Orbitron,monospace', fontSize:8, color:hpColors(hpPct), flexShrink:0 }}>{cb.hp}/{cb.hp_max}</span>
                    </div>
                    {cb.status_effects?.length > 0 && (
                      <div style={{ fontSize:8, color:'var(--gold)', marginTop:1 }}>
                        {cb.status_effects.map(se=>se.icon||se.name).join(' ')}
                      </div>
                    )}
                  </div>
                  {!cb.is_alive && <span style={{ fontSize:10 }}>💀</span>}
                </div>
              )
            })}

            {/* Log de combate */}
            {combatLog.length > 0 && (
              <div style={{ marginTop:10, maxHeight:160, overflowY:'auto', background:'var(--panel)', borderRadius:6, padding:6 }}>
                <div style={{ fontSize:8, color:'var(--dim)', letterSpacing:2, textTransform:'uppercase', marginBottom:5 }}>LOG</div>
                {combatLog.slice(-10).map((a,i) => (
                  <div key={a.id||i} style={{ fontSize:9.5, lineHeight:1.45, marginBottom:4, color: a.action_type==='heal'?'var(--green-l)': a.action_type==='system'?'var(--dim)':'var(--muted)', borderLeft:`2px solid ${a.action_type==='heal'?'var(--green)':a.action_type==='system'?'var(--border)':'var(--red)'}`, paddingLeft:5 }}>
                    {a.description}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MISSÕES VINCULADAS */}
        {quests.filter(q=>q.location_id===loc.id&&q.is_active&&!q.completed).length > 0 && (
          <div style={{ padding:10, borderBottom:'1px solid var(--border)' }}>
            <div style={{ fontFamily:'Bangers,cursive', fontSize:11, letterSpacing:1, color:'var(--muted)', textTransform:'uppercase', marginBottom:7 }}>📜 Missões Ativas</div>
            {quests.filter(q=>q.location_id===loc.id&&q.is_active&&!q.completed).map(q=>(
              <div key={q.id} style={{ background:'var(--panel)', borderRadius:5, padding:'6px 8px', marginBottom:5, border:'1px solid var(--border)' }}>
                <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:11 }}>{q.title}</div>
                <div style={{ fontSize:9, color:'var(--muted)', marginTop:2 }}>{q.description?.slice(0,60)}{q.description?.length>60?'...':''}</div>
              </div>
            ))}
          </div>
        )}

        {/* TÉCNICAS RÁPIDAS (se em combate) */}
        {session && skills.length > 0 && (
          <div style={{ padding:10, borderBottom:'1px solid var(--border)' }}>
            <div style={{ fontFamily:'Bangers,cursive', fontSize:11, letterSpacing:1, color:'var(--muted)', textTransform:'uppercase', marginBottom:7 }}>⚡ Técnicas</div>
            {skills.slice(0,4).map((s,i)=>(
              <div key={i} onClick={()=>declareAttack(s)} style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:5, padding:'6px 8px', marginBottom:5, cursor:'pointer', transition:'border-color .15s' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor='var(--glow)'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:11 }}>{s.icon||'⚡'} {s.name}</span>
                  <span style={{ fontSize:8, color:'var(--blue-l)' }}>{s.type}</span>
                </div>
                <div style={{ fontFamily:'Orbitron,monospace', fontSize:8, color:'var(--red-l)', marginTop:2 }}>{s.cost}</div>
              </div>
            ))}
            <div style={{ fontSize:9, color:'var(--dim)', marginTop:4 }}>Selecione um alvo antes de usar</div>
          </div>
        )}

        {/* VITAIS DO PERSONAGEM */}
        {char && (
          <div style={{ padding:10 }}>
            <div style={{ fontFamily:'Bangers,cursive', fontSize:11, letterSpacing:1, color:'var(--muted)', textTransform:'uppercase', marginBottom:8 }}>🦸 Seus Vitais</div>
            {[
              {l:'HP',   v:myChar?.hp ?? char.hp,           m:myChar?.hp_max ?? char.hp_max,      c:'var(--green)'},
              {l:'Quirk',v:myChar?.quirk_charge ?? char.quirk_charge, m:myChar?.quirk_max ?? char.quirk_max, c:'var(--purple)'},
            ].map(b=>{
              const p = b.m>0?Math.min(100,Math.round(b.v/b.m*100)):100
              return (
                <div key={b.l} style={{ marginBottom:6 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:8, color:'var(--dim)', marginBottom:2 }}><span>{b.l}</span><span>{b.v}/{b.m}</span></div>
                  <div className="pbar"><div className="pbar-fill" style={{ width:`${p}%`, background:b.c }} /></div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── MODAL INICIAR COMBATE ── */}
      {showCombatSetup && (
        <Modal title="⚔️ Iniciar / Gerenciar Combate" onClose={()=>setShowCombatSetup(false)}>
          {!session ? (
            <>
              <div style={{ fontSize:12, color:'var(--muted)', marginBottom:14, lineHeight:1.6 }}>
                Isso ativará o modo combate neste local. Os jogadores da missão vinculada receberão XP ao final.
              </div>
              <div className="field"><label>Vincular à Missão (opcional)</label>
                <select className="input" id="quest-sel">
                  <option value="">— Sem missão —</option>
                  {quests.filter(q=>!q.completed&&q.is_active).map(q=>(
                    <option key={q.id} value={q.id}>{q.title}</option>
                  ))}
                </select>
              </div>
              <button className="btn btn-red btn-full btn-lg" onClick={()=>startCombat(document.getElementById('quest-sel').value||null)}>
                ⚔️ Iniciar Combate
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize:12, color:'var(--muted)', marginBottom:14 }}>Combate ativo. Adicione combatentes:</div>
              <div style={{ fontFamily:'Bangers,cursive', fontSize:12, letterSpacing:1, color:'var(--muted)', marginBottom:8 }}>👥 JOGADORES</div>
              {allProfiles.filter(p=>p.characters?.length>0).map(p=>(
                <div key={p.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                  <Avatar name={p.characters[0]?.name||p.username} color={p.characters[0]?.avatar_color} size={28} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:12 }}>{p.username}</div>
                    <div style={{ fontSize:9, color:'var(--muted)' }}>{p.characters[0]?.name}</div>
                  </div>
                  <button className="btn btn-p btn-sm" onClick={()=>addPlayerToCombat(p)} disabled={combatants.some(c=>c.user_id===p.id)}>
                    {combatants.some(c=>c.user_id===p.id)?'✓':'+ Add'}
                  </button>
                </div>
              ))}
              <div style={{ fontFamily:'Bangers,cursive', fontSize:12, letterSpacing:1, color:'var(--muted)', margin:'12px 0 8px' }}>🎭 NPCs / VILÕES</div>
              {npcs.map(npc=>(
                <div key={npc.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                  <Avatar name={npc.name} color={npc.avatar_color||'gray'} url={npc.avatar_url} size={28} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:12 }}>{npc.name}</div>
                    <div style={{ fontSize:9, color:'var(--muted)' }}>{npc.role} · {npc.quirk_name}</div>
                  </div>
                  <button className="btn btn-g btn-sm" onClick={()=>addNpcToCombat(npc)}>+ Add</button>
                </div>
              ))}
              {npcs.length===0 && <div style={{ fontSize:11, color:'var(--dim)' }}>Crie NPCs na aba NPCs para adicioná-los ao combate.</div>}
            </>
          )}
        </Modal>
      )}

      {/* ── MODAL VESTIR NPC ── */}
      {showNpcPicker && (
        <Modal title="🎭 Vestir NPC" onClose={()=>setShowNpcPicker(false)} maxWidth={420}>
          <div style={{ fontSize:12, color:'var(--muted)', marginBottom:12 }}>Suas mensagens serão enviadas como o NPC selecionado.</div>
          <div style={{ marginBottom:10 }}>
            <div className="player-row" onClick={()=>{setActiveNpc(null);setShowNpcPicker(false)}} style={{ padding:'8px 10px', borderRadius:6, border:'1px solid var(--border)', marginBottom:6, background: !activeNpc?'rgba(37,99,235,.1)':'' }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:avatarBg(char?.avatar_color||'purple'), display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Bangers,cursive', fontSize:12, color:'#fff' }}>{char?.name?.[0]||'?'}</div>
              <div className="p-info"><div className="p-name">Você mesmo ({char?.name||profile?.username})</div></div>
              {!activeNpc && <span style={{ fontSize:12 }}>✓</span>}
            </div>
            {npcs.map(npc=>(
              <div key={npc.id} className="player-row" onClick={()=>{setActiveNpc(npc);setShowNpcPicker(false)}} style={{ padding:'8px 10px', borderRadius:6, border:'1px solid var(--border)', marginBottom:6, background: activeNpc?.id===npc.id?'rgba(255,179,0,.08)':'', cursor:'pointer' }}>
                <Avatar name={npc.name} color={npc.avatar_color||'gray'} url={npc.avatar_url} size={28} />
                <div className="p-info">
                  <div className="p-name">{npc.name}</div>
                  <div className="p-char">{npc.role} · {npc.quirk_name}</div>
                </div>
                {activeNpc?.id===npc.id && <span style={{ fontSize:12, color:'var(--gold)' }}>✓</span>}
              </div>
            ))}
            {npcs.length===0 && <div style={{ fontSize:11, color:'var(--dim)', padding:8 }}>Nenhum NPC criado ainda. Vá em NPCs para criar.</div>}
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ── LOCATION MODAL (add/edit) ── */
function LocationModal({ loc, onClose, onSaved }) {
  const { user } = useAuth()
  const [form, setForm] = useState({
    name: loc?.name||'', icon: loc?.icon||'🗺️', category: loc?.category||'',
    status: loc?.status||'Livre', description: loc?.description||'',
    pinned: loc?.pinned||false,
  })
  const [coverFile, setCoverFile]   = useState(null)
  const [bgFile, setBgFile]         = useState(null)
  const [coverPreview, setCoverPreview]   = useState(loc?.cover_url||null)
  const [bgPreview, setBgPreview]         = useState(loc?.background_url||null)
  const [saving, setSaving] = useState(false)

  function handleImg(e, type) {
    const file = e.target.files[0]; if (!file) return
    if (file.size > 4*1024*1024) { notify('❌ Máx 4MB','error'); return }
    const url = URL.createObjectURL(file)
    if (type==='cover') { setCoverFile(file); setCoverPreview(url) }
    else                { setBgFile(file);    setBgPreview(url) }
  }

  async function handleSave() {
    if (!form.name.trim()) { notify('❌ Nome obrigatório','error'); return }
    setSaving(true)
    let cover_url      = loc?.cover_url || null
    let background_url = loc?.background_url || null
    if (coverFile) { const {url} = await uploadToBucket('locations', user.id, coverFile); if (url) cover_url = url }
    if (bgFile)    { const {url} = await uploadToBucket('locations', user.id, bgFile);    if (url) background_url = url }
    const payload = { ...form, cover_url, background_url, created_by: user.id }
    if (loc?.id) payload.id = loc.id
    const { error } = await upsertLocation(payload)
    setSaving(false)
    if (error) { notify('❌ '+error.message,'error'); return }
    notify('✅ Local salvo!','success'); onSaved()
  }

  return (
    <Modal title={loc?'✏️ Editar Local':'+ Novo Local'} onClose={onClose}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div className="field"><label>Nome *</label><input className="input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} /></div>
        <div className="field"><label>Ícone (emoji)</label><input className="input" value={form.icon} onChange={e=>setForm(f=>({...f,icon:e.target.value}))} /></div>
        <div className="field"><label>Categoria</label><input className="input" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} placeholder="Ex: U.A. High" /></div>
        <div className="field"><label>Status</label><input className="input" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} placeholder="Livre, Restrito..." /></div>
      </div>
      <div className="field"><label>Descrição</label><textarea className="input" rows={2} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} /></div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
        <input type="checkbox" id="pinned" checked={form.pinned} onChange={e=>setForm(f=>({...f,pinned:e.target.checked}))} />
        <label htmlFor="pinned" style={{ fontSize:12, color:'var(--muted)', cursor:'pointer' }}>📌 Fixar no topo da newsletter</label>
      </div>

      {/* Capa */}
      <div className="field">
        <label>🖼️ Imagem de Capa (banner)</label>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {coverPreview && <img src={coverPreview} alt="" style={{ width:80, height:45, objectFit:'cover', borderRadius:4, border:'1px solid var(--border)' }} />}
          <label className="btn btn-g btn-sm" style={{ cursor:'pointer' }}>
            {coverPreview?'Trocar':'Escolher'}
            <input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>handleImg(e,'cover')} />
          </label>
        </div>
      </div>

      {/* Background blur */}
      <div className="field">
        <label>🌫️ Imagem de Fundo (blur no chat)</label>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {bgPreview && <img src={bgPreview} alt="" style={{ width:80, height:45, objectFit:'cover', borderRadius:4, border:'1px solid var(--border)', filter:'blur(2px)' }} />}
          <label className="btn btn-g btn-sm" style={{ cursor:'pointer' }}>
            {bgPreview?'Trocar':'Escolher'}
            <input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>handleImg(e,'bg')} />
          </label>
        </div>
      </div>

      <div style={{ display:'flex', gap:6 }}>
        <button className="btn btn-p btn-lg" onClick={handleSave} disabled={saving} style={{ flex:1 }}>{saving?'⏳ Salvando...':'💾 Salvar'}</button>
        <button className="btn btn-g" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  )
}

/* ── MAIN EXPORT ── */
export default function ExploreView() {
  const [locations, setLocations]   = useState([])
  const [currentLoc, setCurrentLoc] = useState(null)
  const [showModal, setShowModal]   = useState(false)
  const [editLoc, setEditLoc]       = useState(null)

  async function load() {
    const { data } = await getLocations()
    if (data) setLocations(data)
  }
  useEffect(() => { load() }, [])

  async function handleDelete(loc) {
    if (!confirm(`Remover "${loc.name}"? O histórico de mensagens também será apagado.`)) return
    await deleteLocation(loc.id)
    notify('🗑️ Local removido')
    load()
  }

  if (currentLoc) return (
    <LocationChat
      loc={currentLoc}
      onBack={() => { setCurrentLoc(null); load() }}
      onRefreshLocs={load}
    />
  )

  return (
    <>
      <LocationsGrid
        locations={locations}
        onSelect={setCurrentLoc}
        onAdd={() => { setEditLoc(null); setShowModal(true) }}
        onEdit={loc => { setEditLoc(loc); setShowModal(true) }}
        onDelete={handleDelete}
      />
      {showModal && (
        <LocationModal
          loc={editLoc}
          onClose={() => { setShowModal(false); setEditLoc(null) }}
          onSaved={() => { load(); setShowModal(false); setEditLoc(null) }}
        />
      )}
    </>
  )
}
