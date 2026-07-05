import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  getLocations, upsertLocation, deleteLocation,
  getMessages, sendMessage, supabase, uploadToBucket,
  getActiveCombatSession, createCombatSession, endCombatSession,
  getCombatants, addCombatant, updateCombatant, deleteCombatant, applyCombatEffect,
  getCombatActions, addCombatAction,
  getNpcs, getAllProfiles, getQuests
} from '../../lib/supabase'
import { notify } from '../../components/Toast'
import Modal from '../../components/Modal'
import Avatar, { TEXT_COLOR, avatarBg } from '../../components/Avatar'
import {
  calcDerived, calcLevel, calcCombatXp,
  ACTION_TYPES, getActionType, QUIRK_TYPE_BONUSES,
  calcTechDmg, calcTechQuirkCost, techIsAvailable
} from '../../lib/gameSystem'

function rollD(sides){ return Math.floor(Math.random()*sides)+1 }

const ACTION_MSG_STYLE = {
  attack:   'msg-attack',
  skill:    'msg-skill',
  defend:   'msg-defend',
  dodge:    'msg-dodge',
  heal:     'msg-heal',
  intel:    'msg-intel',
  charisma: 'msg-charisma',
  system:   'msg-system',
}

/* ── LOCATIONS GRID ── */
function LocationsGrid({ locations, onSelect, onAdd, onEdit, onDelete }) {
  const pinned  = locations.filter(l=>l.pinned)
  const rest    = locations.filter(l=>!l.pinned)
  const sorted  = [...pinned,...rest]
  return (
    <div style={{ flex:1,overflowY:'auto',padding:14 }}>
      <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:16,flexWrap:'wrap' }}>
        <div style={{ fontFamily:'Bangers,cursive',fontSize:20,letterSpacing:3,color:'var(--text-h)' }}>🗺️ LOCAIS</div>
        <div style={{ fontSize:11,color:'var(--muted)' }}>{locations.length} locais</div>
        <button className="btn btn-p btn-sm" style={{ marginLeft:'auto' }} onClick={onAdd}>+ Novo Local</button>
      </div>
      {locations.length===0&&(
        <div style={{ textAlign:'center',padding:40,color:'var(--muted)',fontSize:13 }}>
          <div style={{ fontSize:48,marginBottom:12 }}>🗺️</div>
          <div style={{ fontFamily:'Bangers,cursive',fontSize:18,letterSpacing:2,color:'var(--blue-l)',marginBottom:8 }}>NENHUM LOCAL</div>
          <button className="btn btn-p btn-lg" style={{ marginTop:8 }} onClick={onAdd}>+ Criar Primeiro Local</button>
        </div>
      )}
      <div className="loc-news-grid" style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14 }}>
        {sorted.map(loc=>(
          <div key={loc.id} className="loc-news-card" onClick={()=>onSelect(loc)}>
            {loc.cover_url
              ?<img src={loc.cover_url} alt="" className="loc-news-cover"/>
              :<div className="loc-news-cover-placeholder" style={{ background:'linear-gradient(135deg,var(--panel),var(--bg))' }}>{loc.icon||'🗺️'}</div>
            }
            <div className="loc-news-body">
              <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:6 }}>
                <div>
                  <div className="loc-news-name">{loc.icon||'🗺️'} {loc.name}</div>
                  {loc.description&&<div className="loc-news-desc">{loc.description}</div>}
                </div>
                <div style={{ display:'flex',gap:4,flexShrink:0 }} onClick={e=>e.stopPropagation()}>
                  <button className="btn btn-g btn-sm" onClick={()=>onEdit(loc)}>✏️</button>
                  <button className="btn btn-danger btn-sm" onClick={()=>onDelete(loc)}>🗑️</button>
                </div>
              </div>
              <div className="loc-news-meta">
                {loc.pinned&&<span className="loc-pin-badge">📌 Fixado</span>}
                {loc.is_combat&&<span className="loc-combat-badge">⚔️ Em combate</span>}
                {loc.status&&<span className="tag" style={{ background:'var(--panel)',color:'var(--muted)',border:'1px solid var(--border)' }}>{loc.status}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── LOCATION CHAT ── */
function LocationChat({ loc, onBack, onRefreshLocs }) {
  const { user, profile, character } = useAuth()
  const [messages,     setMessages]     = useState([])
  const [text,         setText]         = useState('')
  const [actionMode,   setActionMode]   = useState(null)  // null=chat, or ACTION_TYPES key
  const [session,      setSession]      = useState(null)
  const [combatants,   setCombatants]   = useState([])
  const [combatLog,    setCombatLog]    = useState([])
  const [targetId,     setTargetId]     = useState(null)
  const [activeNpc,    setActiveNpc]    = useState(null)
  const [npcs,         setNpcs]         = useState([])
  const [allProfiles,  setAllProfiles]  = useState([])
  const [quests,       setQuests]       = useState([])
  const [showCombatSetup, setShowCombatSetup] = useState(false)
  const [showNpcPicker,   setShowNpcPicker]   = useState(false)
  const [showSkillMenu,   setShowSkillMenu]   = useState(false)
  const [mobilePanel,     setMobilePanel]     = useState('chat') // chat|combat
  const endRef    = useRef(null)
  const subMsgRef = useRef(null)
  const subCbtRef = useRef(null)
  const subActRef = useRef(null)
  const char = character

  async function load() {
    const [{data:msgs},{data:sess},{data:ns},{data:ps},{data:qs}] = await Promise.all([
      getMessages(loc.id,80),
      getActiveCombatSession(loc.id),
      getNpcs(),
      getAllProfiles(),
      getQuests(user.id),
    ])
    setMessages(msgs||[])
    setNpcs(ns||[])
    setAllProfiles(ps||[])
    setQuests(qs||[])
    setSession(sess||null)
    if (sess) {
      const [{data:cbs},{data:acts}] = await Promise.all([
        getCombatants(sess.id), getCombatActions(sess.id)
      ])
      setCombatants(cbs||[])
      setCombatLog(acts||[])
    } else {
      setCombatants([]); setCombatLog([])
    }
  }

  useEffect(()=>{
    load()
    subMsgRef.current = supabase.channel(`loc-msg-${loc.id}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`location_id=eq.${loc.id}`},({new:m})=>setMessages(p=>[...p,m]))
      .subscribe()
    subCbtRef.current = supabase.channel(`loc-cbt-${loc.id}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'combatants'},async()=>{
        const{data:sess}=await getActiveCombatSession(loc.id)
        if(sess){const{data}=await getCombatants(sess.id);setCombatants(data||[])}
      }).subscribe()
    subActRef.current = supabase.channel(`loc-act-${loc.id}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'combat_actions'},({new:a})=>setCombatLog(p=>[...p,a]))
      .subscribe()
    return()=>{subMsgRef.current?.unsubscribe();subCbtRef.current?.unsubscribe();subActRef.current?.unsubscribe()}
  },[loc.id])

  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'})},[messages,combatLog])

  // ── Quem sou eu no combate (incluindo NPC vestido)
  function getMyCombatant() {
    if (activeNpc) return combatants.find(cb=>cb.npc_id===activeNpc.id)
    return combatants.find(cb=>cb.user_id===user?.id)
  }

  // ── Send message ──
  async function handleSend() {
    if(!text.trim()||!user) return
    const name  = activeNpc?activeNpc.name:(char?.name||profile?.username||'Herói')
    const alias = activeNpc?(activeNpc.alias||''):(char?.alias||'')
    const color = activeNpc?(activeNpc.avatar_color||'gray'):(char?.avatar_color||'purple')
    await sendMessage({
      location_id:loc.id, user_id:user.id,
      author_name:name, author_alias:alias, author_color:color,
      content:text.trim(),
      mode: actionMode||'rp',
      npc_id: activeNpc?.id||null,
    })
    setText(''); setActionMode(null)
  }

  // ── Start combat ──
  async function startCombat(questId) {
    const{data:sess,error}=await createCombatSession(loc.id,questId||null,user.id)
    if(error){notify('❌ '+error.message,'error');return}
    // Add player as combatant
    if(char?.name) {
      await addCombatant({
        session_id:sess.id, user_id:user.id,
        character_name:char.name, avatar_color:char.avatar_color, avatar_url:char.avatar_url,
        hp:char.hp||char.hp_max||100, hp_max:char.hp_max||100,
        quirk_charge:char.quirk_charge||char.quirk_max||100, quirk_max:char.quirk_max||100,
        stamina:char.stamina||char.stamina_max||100, stamina_max:char.stamina_max||100,
        attrs:char.attrs||{}, quirk_data:char.quirk_data||{},
        initiative:rollD(20)+(char.attrs?.agilidade||0), type:'player',
      })
    }
    await upsertLocation({...loc,is_combat:true})
    await addCombatAction({session_id:sess.id,actor_name:'Sistema',action_type:'system',description:`⚔️ COMBATE INICIADO em ${loc.name}!`,value:0})
    setSession(sess); load(); setShowCombatSetup(false)
    notify('⚔️ Combate iniciado!','success')
  }

  // ── Start mission combat (auto-build from quest) ──
  async function startMissionCombat(quest) {
    const{data:sess,error}=await createCombatSession(loc.id,quest.id,user.id)
    if(error){notify('❌ '+error.message,'error');return}
    const adds=[]
    // Add all assigned players
    if(quest.assigned_users?.length) {
      for(const uid of quest.assigned_users) {
        const p=allProfiles.find(pr=>pr.id===uid)
        const c=p?.characters?.[0]
        if(c) adds.push(addCombatant({
          session_id:sess.id, user_id:uid,
          character_name:c.name, avatar_color:c.avatar_color, avatar_url:c.avatar_url,
          hp:c.hp||c.hp_max||100, hp_max:c.hp_max||100,
          quirk_charge:c.quirk_charge||c.quirk_max||100, quirk_max:c.quirk_max||100,
          stamina:c.stamina||c.stamina_max||100, stamina_max:c.stamina_max||100,
          attrs:c.attrs||{}, quirk_data:c.quirk_data||{},
          initiative:rollD(20)+(c.attrs?.agilidade||0), type:'player',
        }))
      }
    }
    // Add all assigned NPCs
    if(quest.assigned_npcs?.length) {
      for(const npcId of quest.assigned_npcs) {
        const npc=npcs.find(n=>n.id===npcId)
        if(npc) adds.push(addCombatant({
          session_id:sess.id, npc_id:npc.id,
          character_name:npc.name, avatar_color:npc.avatar_color||'gray', avatar_url:npc.avatar_url,
          hp:npc.hp_max||100, hp_max:npc.hp_max||100,
          quirk_charge:npc.quirk_max||100, quirk_max:npc.quirk_max||100,
          stamina:npc.stamina_max||100, stamina_max:npc.stamina_max||100,
          attrs:npc.attrs||{}, quirk_data:{name:npc.quirk_name||''},
          initiative:rollD(20), type:npc.role==='villain'?'villain':'npc',
        }))
      }
    }
    await Promise.all(adds)
    await upsertLocation({...loc,is_combat:true})
    await addCombatAction({session_id:sess.id,actor_name:'Sistema',action_type:'system',description:`⚔️ MISSÃO INICIADA: ${quest.title}`,value:0})
    setSession(sess); load(); setShowCombatSetup(false)
    notify('⚔️ Missão iniciada! Combate montado automaticamente.','success')
  }

  // ── End combat ──
  async function endCombat() {
    if(!session||!confirm('Encerrar o combate?')) return
    await endCombatSession(session.id)
    await upsertLocation({...loc,is_combat:false})
    await addCombatAction({session_id:session.id,actor_name:'Sistema',action_type:'system',description:'🏁 COMBATE ENCERRADO.',value:0})
    setSession(null); setCombatants([]); load(); onRefreshLocs()
    notify('🏁 Combate encerrado!')
  }

  // ── Add NPC to combat with correct HP ──
  async function addNpcToCombat(npc) {
    if(!session) return
    const derived=calcDerived(npc.attrs||{},npc.quirk_type||'')
    const hpMax = npc.hp_max || derived.hpMax
    const qMax  = npc.quirk_max || derived.quirkMax
    const stMax = npc.stamina_max || derived.staminaMax
    await addCombatant({
      session_id:session.id, npc_id:npc.id,
      character_name:npc.name, avatar_color:npc.avatar_color||'gray', avatar_url:npc.avatar_url,
      hp:hpMax, hp_max:hpMax,
      quirk_charge:qMax, quirk_max:qMax,
      stamina:stMax, stamina_max:stMax,
      attrs:npc.attrs||{}, quirk_data:{name:npc.quirk_name||''},
      initiative:rollD(20)+(npc.attrs?.agilidade||0),
      type:npc.role==='villain'?'villain':'npc',
    })
    await addCombatAction({session_id:session.id,actor_name:'Sistema',action_type:'system',description:`👤 ${npc.name} entrou no combate! (HP: ${hpMax})`,value:0})
    load()
  }

  async function addPlayerToCombat(p) {
    if(!session) return
    const c=p.characters?.[0]
    if(!c){notify('Jogador sem personagem','error');return}
    if(combatants.find(cb=>cb.user_id===p.id)){notify('Já está no combate');return}
    await addCombatant({
      session_id:session.id, user_id:p.id,
      character_name:c.name, avatar_color:c.avatar_color||'blue', avatar_url:c.avatar_url,
      hp:c.hp||c.hp_max||100, hp_max:c.hp_max||100,
      quirk_charge:c.quirk_charge||c.quirk_max||100, quirk_max:c.quirk_max||100,
      stamina:c.stamina||c.stamina_max||100, stamina_max:c.stamina_max||100,
      attrs:c.attrs||{}, quirk_data:c.quirk_data||{},
      initiative:rollD(20)+(c.attrs?.agilidade||0), type:'player',
    })
    await addCombatAction({session_id:session.id,actor_name:'Sistema',action_type:'system',description:`⚡ ${c.name} entrou no combate!`,value:0})
    load()
  }

  // ── Declare action (attack/skill/heal/dodge/defend/intel/charisma) ──
  async function declareAction(actionKey, skill=null) {
    if(!session) return
    const attacker = getMyCombatant()
    if(!attacker){notify('Você não está no combate','error');return}
    if(!targetId&&['attack','skill','heal'].includes(actionKey)){notify('Selecione um alvo','error');return}
    const target = targetId ? combatants.find(cb=>cb.id===targetId) : attacker
    const at     = getActionType(actionKey)
    const roll   = rollD(20)
    const isCrit = roll===20
    const isMiss = roll===1
    let value=0, desc=''

    if(actionKey==='attack'||actionKey==='skill') {
      if(!isMiss) {
        const baseAttr = attacker.attrs?.[at.attr]||0
        const techDmg  = skill ? calcTechDmg(skill,attacker.attrs,attacker.quirk_data?.type||'',1) : 0
        value = isCrit
          ? (Math.floor(Math.random()*6)+1+baseAttr+techDmg)*2
          : Math.floor(Math.random()*6)+1+baseAttr+techDmg
        if(isCrit) value=Math.floor(value)
        await applyCombatEffect(target.id,-value)
        if(skill) await updateCombatant(attacker.id,{quirk_charge:Math.max(0,attacker.quirk_charge-calcTechQuirkCost(skill,attacker.quirk_max))})
      }
      const emoji = isMiss?'💨':isCrit?'💥':'⚔️'
      desc = isMiss
        ? `${emoji} FALHA! D20=${roll} — ${attacker.character_name} erra o ataque!`
        : isCrit
        ? `${emoji} CRÍTICO! D20=${roll} — ${value} de dano em ${target.character_name}!${skill?` [${skill.name}]`:''}`
        : `${emoji} D20=${roll}+${attacker.attrs?.[at.attr]||0} — ${value} de dano em ${target.character_name}${skill?` com ${skill.name}`:''}.`
    } else if(actionKey==='heal') {
      value = rollD(6)+(attacker.attrs?.carisma||0)
      await applyCombatEffect(target.id,value)
      desc = `💚 D6=${rollD(6)} — ${attacker.character_name} cura ${target.character_name} por ${value} HP!`
    } else if(actionKey==='dodge') {
      const dc = 10
      const total = roll+(attacker.attrs?.agilidade||0)
      const ok = total>=dc
      desc = ok
        ? `💨 D20=${roll}+AGI=${attacker.attrs?.agilidade||0} — ${attacker.character_name} DESVIA! (${total} vs DC${dc})`
        : `💨 D20=${roll}+AGI=${attacker.attrs?.agilidade||0} — ${attacker.character_name} não consegue desviar. (${total} vs DC${dc})`
      value = ok?1:0
    } else if(actionKey==='defend') {
      desc = `🛡️ D20=${roll} — ${attacker.character_name} assume postura defensiva! (-${Math.floor(attacker.attrs?.resistencia||0)*0.5} dano recebido próximo turno)`
      value=0
    } else if(actionKey==='intel') {
      const total = roll+(attacker.attrs?.inteligencia||0)
      const ok    = total>=12
      desc = ok
        ? `🧠 D20=${roll}+INT=${attacker.attrs?.inteligencia||0} — ${attacker.character_name} descobre informações valiosas! (${total})`
        : `🧠 D20=${roll}+INT=${attacker.attrs?.inteligencia||0} — Investigação sem resultado. (${total})`
      value=ok?1:0
    } else if(actionKey==='charisma') {
      const total = roll+(attacker.attrs?.carisma||0)
      const ok    = total>=12
      desc = ok
        ? `💬 D20=${roll}+CAR=${attacker.attrs?.carisma||0} — ${attacker.character_name} convence com sucesso! (${total})`
        : `💬 D20=${roll}+CAR=${attacker.attrs?.carisma||0} — Falha na persuasão. (${total})`
      value=ok?1:0
    }

    await addCombatAction({
      session_id:session.id,
      actor_id:attacker.id, actor_name:attacker.character_name,
      target_id:target?.id, target_name:target?.character_name,
      action_type:actionKey, skill_name:skill?.name||null,
      roll_result:roll, value, description:desc,
    })

    // Envia no chat com a cor certa e creditado ao NPC se vestido
    const msgColor = at?.color||'var(--text)'
    await sendMessage({
      location_id:loc.id, user_id:user.id,
      author_name:attacker.character_name,
      author_alias:'',
      author_color:activeNpc?(activeNpc.avatar_color||'gray'):(char?.avatar_color||'purple'),
      content:desc, mode:actionKey,
      npc_id:activeNpc?.id||null,
    })

    setTargetId(null); setActionMode(null); setShowSkillMenu(false); load()
  }

  const myChar    = getMyCombatant()
  const charSkills= (char?.quirk_data?.skills||[]).filter(s=>techIsAvailable(s,char?.quirk_level||1))
  const activeQuests = quests.filter(q=>!q.completed&&q.is_active&&(q.location_id===loc.id||!q.location_id))

  const hpColor = pct => pct>50?'var(--green)':pct>25?'var(--gold)':'var(--red)'

  return (
    <div style={{ display:'flex',height:'calc(100dvh - 48px)',overflow:'hidden',flexDirection:'column' }}>
      {/* Banner */}
      <div style={{ position:'relative',height:90,flexShrink:0,overflow:'hidden',borderBottom:'1px solid var(--border)' }}>
        {loc.background_url&&<img src={loc.background_url} alt="" style={{ position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',filter:'blur(4px) brightness(.4)',transform:'scale(1.05)' }}/>}
        {!loc.background_url&&<div style={{ position:'absolute',inset:0,background:'linear-gradient(135deg,var(--card),var(--bg))' }}/>}
        <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',padding:'0 12px',gap:10 }}>
          <button className="btn btn-g btn-sm" onClick={onBack}>← Locais</button>
          <span style={{ fontSize:24 }}>{loc.icon||'🗺️'}</span>
          <div>
            <div style={{ fontFamily:'Bangers,cursive',fontSize:18,letterSpacing:2,textShadow:'0 2px 8px rgba(0,0,0,.8)' }}>{loc.name}</div>
            {loc.description&&<div style={{ fontSize:9,color:'rgba(255,255,255,.6)' }}>{loc.description}</div>}
          </div>
          <div style={{ marginLeft:'auto',display:'flex',gap:5,flexWrap:'wrap' }}>
            {/* Mobile tab switch */}
            {session&&(
              <div style={{ display:'flex',gap:2 }}>
                <button className={`btn btn-sm ${mobilePanel==='chat'?'btn-p':'btn-g'}`} onClick={()=>setMobilePanel('chat')} style={{ fontSize:10 }}>💬</button>
                <button className={`btn btn-sm ${mobilePanel==='combat'?'btn-red':'btn-g'}`} onClick={()=>setMobilePanel('combat')} style={{ fontSize:10 }}>⚔️</button>
              </div>
            )}
            {!session&&<button className="btn btn-red btn-sm" onClick={()=>setShowCombatSetup(true)}>⚔️ Iniciar</button>}
            {session&&<button className="btn btn-danger btn-sm" onClick={endCombat}>🏁 Encerrar</button>}
            <button className="btn btn-g btn-sm" onClick={()=>setShowNpcPicker(true)} style={{ color:activeNpc?'var(--gold)':'var(--muted)',borderColor:activeNpc?'rgba(255,179,0,.4)':'var(--border)' }}>
              🎭 {activeNpc?activeNpc.name.slice(0,8):'NPC'}
            </button>
          </div>
        </div>
      </div>

      {/* Body: chat + combat panel */}
      <div style={{ flex:1,display:'flex',overflow:'hidden' }}>

        {/* CHAT */}
        <div style={{ flex:1,display:'flex',flexDirection:'column',overflow:'hidden',display: mobilePanel==='combat'?'none':'flex' }} className="chat-main-col">
          <div className="msgs" style={{ flex:1 }}>
            {messages.map((msg,i)=>{
              const isNpc=!!msg.npc_id
              const cls = ACTION_MSG_STYLE[msg.mode]||''
              return(
                <div key={msg.id||i} className="msg">
                  <div style={{ width:34,height:34,borderRadius:'50%',background:avatarBg(msg.author_color||'purple'),display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Bangers,cursive',fontSize:13,color:'#fff',flexShrink:0,overflow:'hidden',border:isNpc?'2px solid var(--gold)':'none',marginTop:1 }}>
                    {msg.author_name?.[0]?.toUpperCase()||'?'}
                  </div>
                  <div className="msg-body">
                    <div className="msg-head">
                      <span className="msg-name" style={{ color:TEXT_COLOR[msg.author_color]||'var(--text-h)' }}>{msg.author_name}</span>
                      {msg.author_alias&&<span className="tag" style={{ background:'rgba(155,89,182,.15)',color:'var(--purple-l)',border:'1px solid rgba(155,89,182,.3)',fontSize:7 }}>{msg.author_alias}</span>}
                      {isNpc&&<span className="tag" style={{ background:'rgba(255,179,0,.15)',color:'var(--gold)',border:'1px solid rgba(255,179,0,.3)',fontSize:7 }}>NPC</span>}
                      <span className="msg-time">{new Date(msg.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>
                    </div>
                    <div className={`msg-text ${cls}`}>{msg.content}</div>
                    {msg.image_url&&<img src={msg.image_url} alt="" className="msg-img"/>}
                  </div>
                </div>
              )
            })}
            <div ref={endRef}/>
          </div>

          {/* INPUT */}
          <div className="chat-input-area">
            {activeNpc&&(
              <div className="chat-input-npc">
                <div style={{ width:20,height:20,borderRadius:'50%',background:avatarBg(activeNpc.avatar_color||'gray'),display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Bangers,cursive',fontSize:9,color:'#fff',border:'1px solid var(--gold)',flexShrink:0 }}>{activeNpc.name[0]}</div>
                <span style={{ fontSize:10,color:'var(--gold)',fontWeight:700 }}>Como: {activeNpc.name}</span>
                <button onClick={()=>setActiveNpc(null)} style={{ marginLeft:'auto',background:'transparent',border:'none',color:'var(--dim)',cursor:'pointer',fontSize:14 }}>✕</button>
              </div>
            )}

            {/* Action mode tabs */}
            {session&&(
              <div className="chat-input-modes" style={{ overflowX:'auto' }}>
                <button className={`mode-btn ${!actionMode?'active':''}`} onClick={()=>setActionMode(null)}>💬 Chat</button>
                {ACTION_TYPES.map(at=>(
                  <button key={at.key} className={`mode-btn ${actionMode===at.key?'active':''}`}
                    style={{ color:actionMode===at.key?at.color:'var(--dim)', borderBottomColor:actionMode===at.key?at.color:'transparent' }}
                    onClick={()=>{ setActionMode(at.key); setShowSkillMenu(false) }}>
                    {at.label}
                  </button>
                ))}
                {charSkills.length>0&&(
                  <button className={`mode-btn ${showSkillMenu?'active':''}`}
                    style={{ color:showSkillMenu?'var(--purple-l)':'var(--dim)', borderBottomColor:showSkillMenu?'var(--purple)':'transparent' }}
                    onClick={()=>setShowSkillMenu(s=>!s)}>
                    ✨ Técnica ▾
                  </button>
                )}
              </div>
            )}

            {/* Skill submenu */}
            {showSkillMenu&&charSkills.length>0&&(
              <div style={{ display:'flex',gap:5,padding:'6px 10px',borderBottom:'1px solid var(--border)',overflowX:'auto',flexShrink:0 }}>
                {charSkills.map((sk,i)=>(
                  <button key={i} onClick={()=>{ declareAction('skill',sk); setShowSkillMenu(false) }}
                    style={{ background:'var(--panel)',border:'1px solid rgba(155,89,182,.4)',borderRadius:5,padding:'5px 9px',cursor:'pointer',whiteSpace:'nowrap',fontSize:10,color:'var(--purple-l)',fontFamily:'Rajdhani,sans-serif',fontWeight:700 }}>
                    {sk.icon||'⚡'} {sk.name} <span style={{ fontSize:8,color:'var(--dim)' }}>Nv.{sk.level}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="chat-input-body">
              <textarea className="chat-textarea" rows={1} value={text}
                onChange={e=>setText(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();actionMode?declareAction(actionMode):handleSend()} }}
                placeholder={actionMode
                  ? `${getActionType(actionMode)?.label} — descreva a ação${targetId?' em '+combatants.find(c=>c.id===targetId)?.character_name:''}...`
                  : `Chat em ${loc.name}...`}
              />
              <button className="chat-send" onClick={()=>actionMode?declareAction(actionMode):handleSend()} disabled={!text.trim()&&!actionMode}>↑</button>
            </div>
          </div>
        </div>

        {/* COMBAT PANEL */}
        {session&&(
          <div style={{ width:240,flexShrink:0,borderLeft:'1px solid var(--border)',display:'flex',flexDirection:'column',overflowY:'auto',background:'var(--card)', display: mobilePanel==='chat'?'none':'flex' }}
            className="chat-right explore-combat">
            <div style={{ padding:10,borderBottom:'1px solid var(--border)' }}>
              <div style={{ fontFamily:'Bangers,cursive',fontSize:12,letterSpacing:2,color:'var(--red-l)',marginBottom:6,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                <span><span className="live"/>⚔️ COMBATE R{session.round||1}</span>
                <button className="btn btn-g btn-sm" onClick={()=>setShowCombatSetup(true)}>+ Comb.</button>
              </div>

              {targetId&&(
                <div style={{ marginBottom:6,padding:'4px 7px',background:'rgba(237,66,69,.1)',borderRadius:4,fontSize:10,color:'var(--red-l)',border:'1px solid rgba(237,66,69,.3)' }}>
                  🎯 <strong>{combatants.find(c=>c.id===targetId)?.character_name}</strong>
                  <button onClick={()=>setTargetId(null)} style={{ float:'right',background:'transparent',border:'none',color:'var(--dim)',cursor:'pointer' }}>✕</button>
                </div>
              )}

              {combatants.length===0&&<div style={{ fontSize:10,color:'var(--dim)',textAlign:'center',padding:8 }}>Use "+ Comb." para adicionar lutadores.</div>}

              {combatants.map(cb=>{
                const hpPct=cb.hp_max>0?Math.min(100,Math.round(cb.hp/cb.hp_max*100)):100
                const isTarget=cb.id===targetId
                const isMe=activeNpc?(cb.npc_id===activeNpc?.id):(cb.user_id===user?.id)
                const typeColor=cb.type==='villain'?'var(--red)':cb.type==='npc'?'var(--gold)':'var(--green)'
                return(
                  <div key={cb.id} className={`combatant-row ${isTarget?'selected':''} ${!cb.is_alive?'dead':''}`} onClick={()=>setTargetId(isTarget?null:cb.id)}>
                    <div style={{ width:26,height:26,borderRadius:'50%',background:avatarBg(cb.avatar_color||'blue'),display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Bangers,cursive',fontSize:10,color:'#fff',flexShrink:0,border:`2px solid ${typeColor}`,overflow:'hidden' }}>
                      {cb.avatar_url?<img src={cb.avatar_url} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }}/>:cb.character_name?.[0]||'?'}
                    </div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:10,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:!cb.is_alive?'var(--dim)':'var(--text-h)' }}>
                        {cb.type==='villain'?'💀 ':cb.type==='npc'?'🎭 ':'⚡ '}{cb.character_name}
                        {isMe&&<span style={{ color:'var(--blue-l)',fontSize:8,marginLeft:3 }}>(você)</span>}
                      </div>
                      <div style={{ display:'flex',alignItems:'center',gap:4,marginTop:2 }}>
                        <div className="hp-mini"><div className="hp-mini-fill" style={{ width:`${hpPct}%`,background:hpColor(hpPct) }}/></div>
                        <span style={{ fontFamily:'Orbitron,monospace',fontSize:8,color:hpColor(hpPct),flexShrink:0 }}>{cb.hp}/{cb.hp_max}</span>
                      </div>
                    </div>
                    {!cb.is_alive&&<span style={{ fontSize:10 }}>💀</span>}
                  </div>
                )
              })}

              {/* Mobile action buttons */}
              {myChar&&(
                <div style={{ marginTop:8,display:'flex',flexWrap:'wrap',gap:4 }}>
                  {ACTION_TYPES.slice(0,4).map(at=>(
                    <button key={at.key} className="btn btn-sm"
                      style={{ flex:'1 1 calc(50% - 4px)',fontSize:9,background:actionMode===at.key?`${at.color}22`:'transparent',color:at.color,border:`1px solid ${at.color}44`,padding:'5px 4px' }}
                      onClick={()=>{ setActionMode(at.key); setMobilePanel('chat') }}>
                      {at.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Combat log */}
            {combatLog.length>0&&(
              <div style={{ padding:8,flex:1,overflowY:'auto' }}>
                <div style={{ fontSize:8,color:'var(--dim)',letterSpacing:2,textTransform:'uppercase',marginBottom:5 }}>LOG</div>
                {combatLog.slice(-12).map((a,i)=>{
                  const at=getActionType(a.action_type)
                  return(
                    <div key={a.id||i} style={{ fontSize:9.5,lineHeight:1.45,marginBottom:5,color:at?.color||'var(--dim)',borderLeft:`2px solid ${at?.color||'var(--border)'}`,paddingLeft:5 }}>
                      {a.description}
                    </div>
                  )
                })}
              </div>
            )}

            {/* My vitals */}
            {myChar&&(
              <div style={{ padding:10,borderTop:'1px solid var(--border)' }}>
                <div style={{ fontSize:9,color:'var(--muted)',letterSpacing:1,textTransform:'uppercase',marginBottom:5 }}>Seus Vitais</div>
                {[
                  {l:'HP',v:myChar.hp,m:myChar.hp_max,c:'var(--red-l)'},
                  {l:'Quirk',v:myChar.quirk_charge,m:myChar.quirk_max,c:'var(--purple-l)'},
                ].map(b=>{
                  const p=b.m>0?Math.min(100,Math.round(b.v/b.m*100)):100
                  return(
                    <div key={b.l} style={{ marginBottom:5 }}>
                      <div style={{ display:'flex',justifyContent:'space-between',fontSize:8,color:'var(--dim)',marginBottom:2 }}><span>{b.l}</span><span>{b.v}/{b.m}</span></div>
                      <div className="pbar"><div className="pbar-fill" style={{ width:`${p}%`,background:b.c }}/></div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* COMBAT SETUP MODAL */}
      {showCombatSetup&&(
        <Modal title="⚔️ Iniciar / Gerenciar Combate" onClose={()=>setShowCombatSetup(false)} maxWidth={500}>
          {!session?(
            <>
              <div style={{ fontSize:12,color:'var(--muted)',marginBottom:14,lineHeight:1.6 }}>
                Inicie um combate livre ou monte automaticamente a partir de uma missão (carrega todos os jogadores e NPCs vinculados).
              </div>

              {/* Missões com Iniciar Missão button */}
              {activeQuests.length>0&&(
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontFamily:'Bangers,cursive',fontSize:12,letterSpacing:1,color:'var(--gold)',marginBottom:8 }}>📜 INICIAR A PARTIR DE MISSÃO</div>
                  {activeQuests.map(q=>(
                    <div key={q.id} style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 10px',background:'var(--panel)',border:'1px solid var(--border)',borderRadius:6,marginBottom:6 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:12,color:'var(--text-h)' }}>{q.title}</div>
                        <div style={{ fontSize:9,color:'var(--dim)',marginTop:2 }}>
                          {q.assigned_users?.length||0} jogador(es) · {q.assigned_npcs?.length||0} NPC(s)
                        </div>
                      </div>
                      <button className="btn btn-gold btn-sm" onClick={()=>startMissionCombat(q)}>
                        ⚔️ Iniciar Missão
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ fontFamily:'Bangers,cursive',fontSize:12,letterSpacing:1,color:'var(--muted)',marginBottom:8 }}>OU COMBATE LIVRE</div>
              <div className="field">
                <label>Vincular à Missão (opcional)</label>
                <select className="input" id="quest-sel">
                  <option value="">— Sem missão —</option>
                  {activeQuests.map(q=><option key={q.id} value={q.id}>{q.title}</option>)}
                </select>
              </div>
              <button className="btn btn-red btn-full btn-lg" onClick={()=>startCombat(document.getElementById('quest-sel')?.value||null)}>
                ⚔️ Iniciar Combate Livre
              </button>
            </>
          ):(
            <>
              <div style={{ fontSize:12,color:'var(--muted)',marginBottom:14 }}>Combate ativo. Adicione mais combatentes:</div>
              <div style={{ fontFamily:'Bangers,cursive',fontSize:11,letterSpacing:1,color:'var(--muted)',marginBottom:8 }}>👥 JOGADORES</div>
              {allProfiles.filter(p=>p.characters?.length>0&&p.characters[0]?.name).map(p=>(
                <div key={p.id} style={{ display:'flex',alignItems:'center',gap:8,marginBottom:6 }}>
                  <Avatar name={p.characters[0]?.name||p.username} color={p.characters[0]?.avatar_color} size={26}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:11 }}>{p.characters[0]?.name}</div>
                    <div style={{ fontSize:9,color:'var(--dim)' }}>@{p.username}</div>
                  </div>
                  <button className="btn btn-p btn-sm" onClick={()=>addPlayerToCombat(p)} disabled={!!combatants.find(c=>c.user_id===p.id)}>
                    {combatants.find(c=>c.user_id===p.id)?'✓ Adicionado':'+ Add'}
                  </button>
                </div>
              ))}
              <div style={{ fontFamily:'Bangers,cursive',fontSize:11,letterSpacing:1,color:'var(--muted)',margin:'12px 0 8px' }}>🎭 NPCs</div>
              {npcs.map(npc=>(
                <div key={npc.id} style={{ display:'flex',alignItems:'center',gap:8,marginBottom:6 }}>
                  <Avatar name={npc.name} color={npc.avatar_color||'gray'} url={npc.avatar_url} size={26}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:11 }}>{npc.name}</div>
                    <div style={{ fontSize:9,color:'var(--dim)' }}>Nv.{npc.level||1} · {npc.role} · HP: {npc.hp_max||100}</div>
                  </div>
                  <button className="btn btn-g btn-sm" onClick={()=>addNpcToCombat(npc)}>+ Add</button>
                </div>
              ))}
            </>
          )}
        </Modal>
      )}

      {/* NPC PICKER */}
      {showNpcPicker&&(
        <Modal title="🎭 Vestir NPC" onClose={()=>setShowNpcPicker(false)} maxWidth={400}>
          <div style={{ fontSize:11,color:'var(--muted)',marginBottom:12 }}>Suas mensagens e ações de combate serão executadas como o NPC.</div>
          <div className="player-row" onClick={()=>{setActiveNpc(null);setShowNpcPicker(false)}} style={{ padding:'8px 10px',borderRadius:6,border:`1px solid ${!activeNpc?'var(--blue)':'var(--border)'}`,marginBottom:6,background:!activeNpc?'rgba(88,101,242,.08)':'transparent',cursor:'pointer' }}>
            <Avatar name={char?.name||profile?.username} color={char?.avatar_color||'purple'} url={char?.avatar_url} size={28}/>
            <div className="p-info"><div className="p-name">Você mesmo — {char?.name||profile?.username}</div></div>
            {!activeNpc&&<span style={{ color:'var(--blue-l)',fontSize:14 }}>✓</span>}
          </div>
          {npcs.map(npc=>(
            <div key={npc.id} className="player-row" onClick={()=>{setActiveNpc(npc);setShowNpcPicker(false)}} style={{ padding:'8px 10px',borderRadius:6,border:`1px solid ${activeNpc?.id===npc.id?'var(--gold)':'var(--border)'}`,marginBottom:6,background:activeNpc?.id===npc.id?'rgba(255,179,0,.06)':'transparent',cursor:'pointer' }}>
              <Avatar name={npc.name} color={npc.avatar_color||'gray'} url={npc.avatar_url} size={28}/>
              <div className="p-info">
                <div className="p-name">{npc.name}</div>
                <div className="p-char">Nv.{npc.level||1} · HP:{npc.hp_max||100} · Quirk:{npc.quirk_max||100}</div>
              </div>
              {activeNpc?.id===npc.id&&<span style={{ color:'var(--gold)',fontSize:14 }}>✓</span>}
            </div>
          ))}
          {npcs.length===0&&<div style={{ fontSize:11,color:'var(--dim)',padding:8,textAlign:'center' }}>Nenhum NPC criado. Vá em 🎭 NPCs.</div>}
        </Modal>
      )}
    </div>
  )
}

/* ── LOCATION MODAL ── */
function LocationModal({ loc, onClose, onSaved }) {
  const {user}=useAuth()
  const [form,setForm]=useState({ name:loc?.name||'',icon:loc?.icon||'🗺️',category:loc?.category||'',status:loc?.status||'Livre',description:loc?.description||'',pinned:loc?.pinned||false })
  const [coverFile,setCoverFile]=useState(null)
  const [bgFile,setBgFile]=useState(null)
  const [coverPreview,setCoverPreview]=useState(loc?.cover_url||null)
  const [bgPreview,setBgPreview]=useState(loc?.background_url||null)
  const [saving,setSaving]=useState(false)
  function handleImg(e,type){
    const file=e.target.files[0];if(!file)return
    if(file.size>4*1024*1024){notify('❌ Máx 4MB','error');return}
    const url=URL.createObjectURL(file)
    if(type==='cover'){setCoverFile(file);setCoverPreview(url)}else{setBgFile(file);setBgPreview(url)}
  }
  async function handleSave(){
    if(!form.name.trim()){notify('❌ Nome obrigatório','error');return}
    setSaving(true)
    let cover_url=loc?.cover_url||null,background_url=loc?.background_url||null
    if(coverFile){const{url}=await uploadToBucket('locations',user.id,coverFile);if(url)cover_url=url}
    if(bgFile){const{url}=await uploadToBucket('locations',user.id,bgFile);if(url)background_url=url}
    const payload={...form,cover_url,background_url,created_by:user.id}
    if(loc?.id)payload.id=loc.id
    const{error}=await upsertLocation(payload)
    setSaving(false)
    if(error){notify('❌ '+error.message,'error');return}
    notify('✅ Local salvo!','success');onSaved()
  }
  return (
    <Modal title={loc?'✏️ Editar Local':'+ Novo Local'} onClose={onClose}>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
        <div className="field"><label>Nome *</label><input className="input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
        <div className="field"><label>Ícone</label><input className="input" value={form.icon} onChange={e=>setForm(f=>({...f,icon:e.target.value}))}/></div>
        <div className="field"><label>Categoria</label><input className="input" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}/></div>
        <div className="field"><label>Status</label><input className="input" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}/></div>
      </div>
      <div className="field"><label>Descrição</label><textarea className="input" rows={2} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/></div>
      <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:12 }}>
        <input type="checkbox" id="pinned" checked={form.pinned} onChange={e=>setForm(f=>({...f,pinned:e.target.checked}))}/>
        <label htmlFor="pinned" style={{ fontSize:12,color:'var(--muted)',cursor:'pointer' }}>📌 Fixar no topo</label>
      </div>
      <div className="field">
        <label>🖼️ Capa (banner)</label>
        <div style={{ display:'flex',gap:8,alignItems:'center' }}>
          {coverPreview&&<img src={coverPreview} alt="" style={{ width:80,height:45,objectFit:'cover',borderRadius:4,border:'1px solid var(--border)' }}/>}
          <label className="btn btn-g btn-sm" style={{ cursor:'pointer' }}>{coverPreview?'Trocar':'Escolher'}<input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>handleImg(e,'cover')}/></label>
        </div>
      </div>
      <div className="field">
        <label>🌫️ Fundo (blur no chat)</label>
        <div style={{ display:'flex',gap:8,alignItems:'center' }}>
          {bgPreview&&<img src={bgPreview} alt="" style={{ width:80,height:45,objectFit:'cover',borderRadius:4,border:'1px solid var(--border)',filter:'blur(2px)' }}/>}
          <label className="btn btn-g btn-sm" style={{ cursor:'pointer' }}>{bgPreview?'Trocar':'Escolher'}<input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>handleImg(e,'bg')}/></label>
        </div>
      </div>
      <div style={{ display:'flex',gap:6 }}>
        <button className="btn btn-p btn-lg" onClick={handleSave} disabled={saving} style={{ flex:1 }}>{saving?'⏳...':'💾 Salvar'}</button>
        <button className="btn btn-g" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  )
}

/* ── MAIN EXPORT ── */
export default function ExploreView() {
  const [locations,setLocations]=useState([])
  const [currentLoc,setCurrentLoc]=useState(null)
  const [showModal,setShowModal]=useState(false)
  const [editLoc,setEditLoc]=useState(null)
  async function load(){const{data}=await getLocations();if(data)setLocations(data)}
  useEffect(()=>{load()},[])
  async function handleDelete(loc){
    if(!confirm(`Remover "${loc.name}"?`))return
    await deleteLocation(loc.id);notify('🗑️ Removido');load()
  }
  if(currentLoc) return <LocationChat loc={currentLoc} onBack={()=>{setCurrentLoc(null);load()}} onRefreshLocs={load}/>
  return(
    <>
      <LocationsGrid locations={locations} onSelect={setCurrentLoc} onAdd={()=>{setEditLoc(null);setShowModal(true)}} onEdit={loc=>{setEditLoc(loc);setShowModal(true)}} onDelete={handleDelete}/>
      {showModal&&<LocationModal loc={editLoc} onClose={()=>{setShowModal(false);setEditLoc(null)}} onSaved={()=>{load();setShowModal(false);setEditLoc(null)}}/>}
    </>
  )
}
