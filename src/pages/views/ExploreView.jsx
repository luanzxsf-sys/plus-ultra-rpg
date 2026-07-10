import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  getLocations, upsertLocation, deleteLocation,
  getMessages, sendMessage, supabase, uploadToBucket,
  getActiveCombatSession, createCombatSession, endCombatSession,
  getCombatants, addCombatant, updateCombatant, applyCombatEffect,
  getCombatActions, addCombatAction,
  getNpcs, getAllProfiles, getQuests, addQuirkXp
} from '../../lib/supabase'
import { notify } from '../../components/Toast'
import Modal from '../../components/Modal'
import Avatar, { TEXT_COLOR, avatarBg } from '../../components/Avatar'
import {
  calcDerived, ACTION_TYPES, getActionType,
  calcTechDmg, calcTechQuirkCost, techIsAvailable,
  ROLL_DIFFICULTIES, adaptRollDC, resolveAttributeRoll,
  ATTR_META, ATTR_KEYS, getMissionType, calcTechQuirkXp
} from '../../lib/gameSystem'

function rollD(sides){ return Math.floor(Math.random()*sides)+1 }

const ACTION_MSG_CLASS = {
  attack:'msg-attack', skill:'msg-skill', defend:'msg-defend',
  dodge:'msg-dodge', heal:'msg-heal', intel:'msg-intel',
  charisma:'msg-charisma', system:'msg-system', roll:'msg-roll',
}


// ─────────────────────────────────────────────
// COMBAT PANEL (shared between desktop side + mobile overlay)
// ─────────────────────────────────────────────
function CombatPanel({ combatants, combatLog, targetId, setTargetId, myChar,
  actionMode, setActionMode, charSkills, showSkillMenu, setShowSkillMenu,
  declareAction, setShowCombatSetup, user, activeNpc, hpColor, getActionType, session, isMobile,
  pendingActions, onRespondPending, discoveredInfo }) {

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Pending Actions — shown at top of panel */}
      {(pendingActions||[]).filter(a => a.is_pending === true && a.resolved !== true).map(pa=>(
        <PendingActionBanner key={pa.id} action={pa} combatants={combatants}
          myUserId={user?.id} activeNpcId={activeNpc?.id}
          onRespond={onRespondPending||(() => {})}/>
      ))}

      {/* Combatants list */}
      <div style={{ padding:10, borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <div style={{ fontFamily:'Bangers,cursive', fontSize:12, letterSpacing:2, color:'var(--red-l)', marginBottom:6, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span>COMBATENTES</span>
          <button className="btn btn-g btn-sm" onClick={()=>setShowCombatSetup(true)} style={{ fontSize:9 }}>+ Add</button>
        </div>
        {targetId && (
          <div style={{ marginBottom:6, padding:'4px 7px', background:'rgba(237,66,69,.1)', borderRadius:4, fontSize:10, color:'var(--red-l)', border:'1px solid rgba(237,66,69,.3)' }}>
            🎯 <strong>{combatants.find(c=>c.id===targetId)?.character_name}</strong>
            <button onClick={()=>setTargetId(null)} style={{ float:'right', background:'transparent', border:'none', color:'var(--dim)', cursor:'pointer' }}>✕</button>
          </div>
        )}
        {combatants.length === 0 && (
          <div style={{ fontSize:10, color:'var(--dim)', textAlign:'center', padding:'8px 0' }}>
            Nenhum combatente ainda.<br/>Use "+ Add" para adicionar.
          </div>
        )}
        {combatants.map(cb => {
          const hpPct = cb.hp_max > 0 ? Math.min(100, Math.round(cb.hp/cb.hp_max*100)) : 100
          const isTarget = cb.id === targetId
          const isMe = activeNpc ? (cb.npc_id===activeNpc?.id) : (cb.user_id===user?.id)
          const typeColor = cb.type==='villain'?'var(--red)':cb.type==='npc'?'var(--gold)':'var(--green)'
          return (
            <div key={cb.id} className={`combatant-row ${isTarget?'selected':''} ${!cb.is_alive?'dead':''}`}
              onClick={()=>setTargetId(isTarget?null:cb.id)}>
              <div style={{ width:26, height:26, borderRadius:'50%', background:avatarBg(cb.avatar_color||'blue'), display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Bangers,cursive', fontSize:10, color:'#fff', flexShrink:0, border:`2px solid ${typeColor}`, overflow:'hidden' }}>
                {cb.avatar_url ? <img src={cb.avatar_url} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }}/> : cb.character_name?.[0]||'?'}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:10, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:!cb.is_alive?'var(--dim)':'var(--text-h)' }}>
                  {cb.type==='villain'?'💀 ':cb.type==='npc'?'🎭 ':'⚡ '}{cb.character_name}
                  {isMe && <span style={{ color:'var(--blue-l)', fontSize:8, marginLeft:3 }}>(você)</span>}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
                  <div className="hp-mini"><div className="hp-mini-fill" style={{ width:`${hpPct}%`, background:hpColor(hpPct) }}/></div>
                  <span style={{ fontFamily:'Orbitron,monospace', fontSize:8, color:hpColor(hpPct), flexShrink:0 }}>{cb.hp}/{cb.hp_max}</span>
                </div>
              </div>
              {!cb.is_alive && <span style={{ fontSize:10 }}>💀</span>}
            </div>
          )
        })}
      </div>

      {/* Action buttons */}
      {myChar && (
        <div style={{ padding:10, borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <div style={{ fontSize:9, color:'var(--dim)', letterSpacing:1, textTransform:'uppercase', marginBottom:7, fontWeight:700 }}>
            ⚡ AÇÕES {targetId && <span style={{ color:'var(--red-l)' }}>→ {combatants.find(c=>c.id===targetId)?.character_name}</span>}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
            {ACTION_TYPES.map(at => (
              <button key={at.key}
                onClick={()=>{ setActionMode(actionMode===at.key?null:at.key) }}
                style={{
                  padding:'8px 6px', borderRadius:6, border:`1px solid ${actionMode===at.key?at.color:at.color+'44'}`,
                  background: actionMode===at.key ? at.color+'22' : 'transparent',
                  color: actionMode===at.key ? at.color : at.color+'99',
                  cursor:'pointer', fontFamily:'Rajdhani,sans-serif', fontWeight:700,
                  fontSize:11, textAlign:'center', transition:'all .15s',
                }}>
                {at.label}
              </button>
            ))}
          </div>

          {/* Skill toggle button */}
          {charSkills.length > 0 && (
            <button
              onClick={()=>setShowSkillMenu(!showSkillMenu)}
              style={{
                marginTop:5, width:'100%', padding:'7px 6px', borderRadius:6,
                border:`1px solid ${showSkillMenu?'#9B59B6':'#9B59B644'}`,
                background: showSkillMenu ? '#9B59B622' : 'transparent',
                color: showSkillMenu ? '#9B59B6' : '#9B59B699',
                cursor:'pointer', fontFamily:'Rajdhani,sans-serif', fontWeight:700,
                fontSize:11, textAlign:'center', transition:'all .15s',
                display:'flex', alignItems:'center', justifyContent:'center', gap:5,
              }}>
              ✨ Técnicas <span style={{ fontSize:8 }}>{showSkillMenu ? '▲' : '▼'}</span>
            </button>
          )}

          {/* Skill submenu */}
          {showSkillMenu && charSkills.length > 0 && (
            <div style={{ marginTop:8 }}>
              <div style={{ fontSize:9, color:'var(--purple-l)', letterSpacing:1, textTransform:'uppercase', marginBottom:5, fontWeight:700 }}>✨ TÉCNICAS</div>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {charSkills.map((sk, i) => (
                  <button key={i}
                    onClick={()=>{ declareAction('skill', sk); setShowSkillMenu(false) }}
                    style={{ padding:'6px 8px', borderRadius:5, border:'1px solid rgba(155,89,182,.4)', background:'rgba(155,89,182,.08)', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', transition:'all .15s' }}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(155,89,182,.2)'}
                    onMouseLeave={e=>e.currentTarget.style.background='rgba(155,89,182,.08)'}>
                    <span style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:11, color:'var(--purple-l)' }}>
                      {sk.icon||'⚡'} {sk.name}
                    </span>
                    <span style={{ fontFamily:'Orbitron,monospace', fontSize:8, color:'var(--dim)' }}>Nv.{sk.level}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {actionMode && (
            <div style={{ marginTop:8, padding:'6px 8px', background:`${getActionType(actionMode)?.color||'var(--blue)'}15`, border:`1px solid ${getActionType(actionMode)?.color||'var(--blue)'}44`, borderRadius:5, fontSize:10, color:getActionType(actionMode)?.color||'var(--text)' }}>
              ✍️ Modo: <strong>{getActionType(actionMode)?.label}</strong> — escreva no chat e envie
              <button onClick={()=>setActionMode(null)} style={{ float:'right', background:'transparent', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:12 }}>✕</button>
            </div>
          )}
        </div>
      )}

      {/* Vitals */}
      {myChar && (
        <div style={{ padding:10, borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <div style={{ fontSize:9, color:'var(--muted)', letterSpacing:1, textTransform:'uppercase', marginBottom:6 }}>Vitais</div>
          {[
            { l:'HP',    v:myChar.hp,          m:myChar.hp_max,    c:'var(--red-l)' },
            { l:'Quirk', v:myChar.quirk_charge, m:myChar.quirk_max, c:'var(--purple-l)' },
          ].map(b => {
            const p = b.m > 0 ? Math.min(100, Math.round(b.v/b.m*100)) : 100
            return (
              <div key={b.l} style={{ marginBottom:5 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:8, color:'var(--dim)', marginBottom:2 }}>
                  <span>{b.l}</span><span>{b.v}/{b.m}</span>
                </div>
                <div className="pbar"><div className="pbar-fill" style={{ width:`${p}%`, background:b.c }}/></div>
              </div>
            )
          })}
        </div>
      )}

      {/* Discovered Info */}
      {discoveredInfo&&discoveredInfo.length>0&&(
        <div style={{ padding:10, borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <div style={{ fontSize:9, color:'var(--gold)', letterSpacing:1, textTransform:'uppercase', fontWeight:700, marginBottom:6 }}>🔍 INFORMAÇÕES REVELADAS</div>
          {discoveredInfo.map((d,i)=>(
            <div key={i} style={{ marginBottom:6, padding:'6px 8px', background:'rgba(255,179,0,.06)', border:'1px solid rgba(255,179,0,.2)', borderRadius:5 }}>
              <div style={{ fontSize:9, color:'var(--gold)', fontWeight:700, marginBottom:2 }}>{d.actor} · {d.time}</div>
              <div style={{ fontSize:10, color:'var(--text-h)', lineHeight:1.4 }}>{d.info}</div>
            </div>
          ))}
        </div>
      )}

      {/* Combat log */}
      <div style={{ flex:1, overflowY:'auto', padding:8 }}>
        <div style={{ fontSize:8, color:'var(--dim)', letterSpacing:2, textTransform:'uppercase', marginBottom:5 }}>LOG</div>
        {combatLog.length === 0 && <div style={{ fontSize:10, color:'var(--dim)' }}>Sem ações ainda.</div>}
        {combatLog.slice(-15).map((a, i) => {
          const at = getActionType(a.action_type)
          const isPending = a.is_pending && !a.resolved
          return (
            <div key={a.id||i} style={{ fontSize:9.5, lineHeight:1.45, marginBottom:5, color:isPending?'var(--gold)':at?.color||'var(--dim)', borderLeft:`2px solid ${isPending?'var(--gold)':at?.color||'var(--border)'}`, paddingLeft:5, opacity:a.resolved?0.5:1 }}>
              {isPending && '⚠️ '}{a.description}
              {a.resolved && <span style={{ fontSize:8, color:'var(--green-l)', marginLeft:4 }}>✓</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────
// FREE ROLL MODAL — roll de atributo fora de combate
// Narrador pode solicitar, qualquer um pode rolar
// ─────────────────────────────────────────────
function FreeRollModal({ char, attrs, npcs, combatants, missionDifficulty, onClose, onRolled }) {
  const [form, setForm] = useState({
    attrKey:    'inteligencia',
    difficulty: 'medium',
    label:      '',          // descrição da situação
    targetNpc:  '',          // NPC alvo (opcional, para revelar fraqueza)
  })

  const rollDiffs = ROLL_DIFFICULTIES
  const dc = missionDifficulty
    ? adaptRollDC(rollDiffs.find(r=>r.key===form.difficulty)?.dc||12, missionDifficulty)
    : (rollDiffs.find(r=>r.key===form.difficulty)?.dc||12)

  function handle() {
    if (!form.label.trim()) { notify('❌ Descreva a situação do roll', 'error'); return }
    const roll    = Math.floor(Math.random()*20)+1
    const attrV   = attrs?.[form.attrKey] || 0
    const result  = resolveAttributeRoll(attrV, roll, dc)
    const atLabel = ATTR_META[form.attrKey]?.label || form.attrKey

    // Reveal weakness if intel + npc target + success
    let extra = ''
    if (form.attrKey==='inteligencia' && form.targetNpc && result.success) {
      const npc = npcs.find(n=>n.id===form.targetNpc)
      if (npc?.attrs) {
        const weak = Object.entries(npc.attrs).sort((a,b)=>a[1]-b[1])[0]
        if (weak) extra = ` ★ Fraqueza de ${npc.name}: ${ATTR_META[weak[0]]?.label} (${weak[1]})`
      }
    }

    const desc = `🎲 Roll de ${atLabel} — ${form.label}
`
      + `D20=${roll} + ${atLabel}=${attrV} = ${roll+Math.floor(attrV/3)} vs DC${dc}`
      + ` — ${result.label}${extra}`

    onRolled({ desc, result, attrKey: form.attrKey, roll, attrV, dc, extra })
    onClose()
  }

  return (
    <Modal title="🎲 Roll de Atributo" onClose={onClose} maxWidth={480}>
      <div style={{ fontSize:11, color:'var(--muted)', marginBottom:14, lineHeight:1.6 }}>
        Declare um roll de atributo para qualquer situação — dentro ou fora de combate.
        O resultado aparece no chat do local.
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div className="field">
          <label>Atributo</label>
          <select className="input" value={form.attrKey} onChange={e=>setForm(f=>({...f,attrKey:e.target.value}))}>
            {Object.entries(ATTR_META).map(([k,v])=>(
              <option key={k} value={k}>{v.label} {attrs?.[k]!=null?`(${attrs[k]})`:''}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Dificuldade</label>
          <select className="input" value={form.difficulty} onChange={e=>setForm(f=>({...f,difficulty:e.target.value}))}>
            {ROLL_DIFFICULTIES.map(r=>(
              <option key={r.key} value={r.key}>{r.label} — DC {missionDifficulty ? adaptRollDC(r.dc,missionDifficulty) : r.dc}</option>
            ))}
          </select>
        </div>
      </div>

      {/* DC preview */}
      <div style={{ padding:'7px 12px', background:'var(--panel)', borderRadius:6, border:'1px solid var(--border)', marginBottom:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:9, color:'var(--dim)', textTransform:'uppercase', letterSpacing:1, marginBottom:2 }}>DC do Roll</div>
          <div style={{ fontFamily:'Orbitron,monospace', fontSize:22, fontWeight:700, color:'var(--gold)' }}>{dc}</div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:9, color:'var(--dim)' }}>Seu bônus</div>
          <div style={{ fontFamily:'Orbitron,monospace', fontSize:16, color:'var(--blue-l)' }}>
            +{Math.floor((attrs?.[form.attrKey]||0)/3)}
          </div>
          {missionDifficulty && (
            <div style={{ fontSize:9, color:'var(--gold)', marginTop:2 }}>Ajustado pela missão</div>
          )}
        </div>
      </div>

      <div className="field">
        <label>Situação / Contexto *</label>
        <input className="input" value={form.label}
          onChange={e=>setForm(f=>({...f,label:e.target.value}))}
          placeholder="Ex: Examina o arquivo secreto, Tenta persuadir o guarda..."/>
      </div>

      {/* NPC target for intel reveal */}
      {form.attrKey === 'inteligencia' && (
        <div className="field">
          <label>🎯 Analisar NPC (para revelar fraqueza no sucesso)</label>
          <select className="input" value={form.targetNpc} onChange={e=>setForm(f=>({...f,targetNpc:e.target.value}))}>
            <option value="">— Sem alvo específico —</option>
            {npcs.map(n=><option key={n.id} value={n.id}>{n.name} ({n.role})</option>)}
          </select>
        </div>
      )}

      {/* Chance preview */}
      <div style={{ marginBottom:14, padding:'8px 12px', background:'var(--panel)', borderRadius:6, border:'1px solid var(--border)' }}>
        <div style={{ fontSize:10, color:'var(--muted)', marginBottom:6 }}>Resultado mínimo no D20 para...</div>
        {[
          { label:'Sucesso Excepcional', need: dc + 5 - Math.floor((attrs?.[form.attrKey]||0)/3), c:'var(--green-l)' },
          { label:'Sucesso',             need: dc     - Math.floor((attrs?.[form.attrKey]||0)/3), c:'var(--blue-l)' },
          { label:'Sucesso Parcial',     need: dc - 3 - Math.floor((attrs?.[form.attrKey]||0)/3), c:'var(--gold)' },
        ].map(r=>(
          <div key={r.label} style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:3 }}>
            <span style={{ color:'var(--muted)' }}>{r.label}</span>
            <span style={{ fontFamily:'Orbitron,monospace', color: r.need<=1?'var(--green-l)':r.need>20?'var(--red-l)':r.c, fontWeight:700 }}>
              {r.need<=1?'Sempre':r.need>20?'Impossível':`${r.need}+`}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:6 }}>
        <button className="btn btn-p btn-lg" onClick={handle} style={{ flex:1 }}>🎲 Rolar Agora</button>
        <button className="btn btn-g" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────
// LOCATIONS GRID
// ─────────────────────────────────────────────
function LocationsGrid({ locations, onSelect, onAdd, onEdit, onDelete }) {
  const sorted = [...locations.filter(l=>l.pinned), ...locations.filter(l=>!l.pinned)]
  return (
    <div style={{ flex:1, overflowY:'auto', padding:14 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ fontFamily:'Bangers,cursive', fontSize:20, letterSpacing:3, color:'var(--text-h)' }}>🗺️ LOCAIS</div>
        <div style={{ fontSize:11, color:'var(--muted)' }}>{locations.length} locais</div>
        <button className="btn btn-p btn-sm" style={{ marginLeft:'auto' }} onClick={onAdd}>+ Novo Local</button>
      </div>
      {locations.length===0 && (
        <div style={{ textAlign:'center', padding:40, color:'var(--muted)' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>🗺️</div>
          <div style={{ fontFamily:'Bangers,cursive', fontSize:18, letterSpacing:2, color:'var(--blue-l)', marginBottom:8 }}>NENHUM LOCAL</div>
          <button className="btn btn-p btn-lg" onClick={onAdd}>+ Criar Primeiro Local</button>
        </div>
      )}
      <div className="loc-news-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
        {sorted.map(loc=>(
          <div key={loc.id} className="loc-news-card" onClick={()=>onSelect(loc)}>
            {loc.cover_url
              ? <img src={loc.cover_url} alt="" className="loc-news-cover"/>
              : <div className="loc-news-cover-placeholder" style={{ background:'linear-gradient(135deg,var(--panel),var(--bg))' }}>{loc.icon||'🗺️'}</div>
            }
            <div className="loc-news-body">
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:6 }}>
                <div>
                  <div className="loc-news-name">{loc.icon||'🗺️'} {loc.name}</div>
                  {loc.description && <div className="loc-news-desc">{loc.description}</div>}
                </div>
                <div style={{ display:'flex', gap:4, flexShrink:0 }} onClick={e=>e.stopPropagation()}>
                  <button className="btn btn-g btn-sm" onClick={()=>onEdit(loc)}>✏️</button>
                  <button className="btn btn-danger btn-sm" onClick={()=>onDelete(loc)}>🗑️</button>
                </div>
              </div>
              <div className="loc-news-meta">
                {loc.pinned && <span className="loc-pin-badge">📌 Fixado</span>}
                {loc.is_combat && <span className="loc-combat-badge">⚔️ Em combate</span>}
                {loc.status && <span className="tag" style={{ background:'var(--panel)', color:'var(--muted)', border:'1px solid var(--border)' }}>{loc.status}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// PENDING ACTION BANNER
// ─────────────────────────────────────────────
function PendingActionBanner({ action, combatants, myUserId, activeNpcId, onRespond }) {
  const actor      = combatants.find(c => c.id === action.actor_id)
  const targets    = action.pending_for || []
  const resolvedBy = action.resolved_by || []
  const myIds      = combatants
    .filter(c => c.user_id === myUserId || (activeNpcId && c.npc_id === activeNpcId))
    .map(c => c.id)
  const iAmTarget   = targets.some(id => myIds.includes(id))
  const iResponded  = resolvedBy.some(id => myIds.includes(id))
  const atMeta      = ATTR_META[action.attr_check]
  const remaining   = targets.filter(id => !resolvedBy.includes(id))
  const allResolved = remaining.length === 0 && targets.length > 0

  // Show to everyone while the action has unresolved targets
  // Note: is_pending may be stored as true/null (not false) in DB
  if (!action.is_pending) return null
  if (action.resolved === true && allResolved) return null

  return (
    <div style={{
      margin:'6px 10px', padding:'12px 14px',
      background:'rgba(237,66,69,.06)',
      border:'2px solid rgba(237,66,69,.5)',
      borderRadius:10, flexShrink:0,
      boxShadow:'0 2px 12px rgba(237,66,69,.2)',
      animation:'pendingPulse 2s ease infinite',
    }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap' }}>
        <span style={{ fontSize:9, fontWeight:700, padding:'3px 8px', background:'rgba(237,66,69,.25)', color:'var(--red-l)', borderRadius:4, textTransform:'uppercase', letterSpacing:1.5, flexShrink:0 }}>
          ⚠️ AÇÃO PENDENTE
        </span>
        <span style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:13, color:'var(--text-h)' }}>
          {actor?.character_name || action.actor_name}
        </span>
        {action.action_type === 'attack' && <span style={{ fontSize:10, color:'var(--red-l)' }}>⚔️ Ataca</span>}
        {action.action_type === 'skill'  && <span style={{ fontSize:10, color:'var(--purple-l)' }}>✨ {action.skill_name}</span>}
        {action.action_type === 'intel'  && <span style={{ fontSize:10, color:'var(--gold)' }}>🧠 Investiga</span>}
        {action.action_type === 'charisma' && <span style={{ fontSize:10, color:'var(--pink-l)' }}>💬 Convence</span>}
      </div>

      {/* Description */}
      <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.5, marginBottom:8, fontStyle:'italic' }}>
        "{action.description}"
      </div>

      {/* Roll requirement */}
      {action.attr_check && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 9px', background:'rgba(255,179,0,.08)', borderRadius:5, border:'1px solid rgba(255,179,0,.2)', marginBottom:8 }}>
          <span style={{ fontSize:18 }}>🎲</span>
          <div>
            <div style={{ fontSize:10, color:'var(--gold)', fontWeight:700 }}>
              Roll de {atMeta?.label || action.attr_check} exigido
            </div>
            <div style={{ fontSize:9, color:'var(--dim)' }}>
              DC {action.dc || 12} · {ROLL_DIFFICULTIES.find(r=>r.key===action.difficulty)?.label || action.difficulty}
            </div>
          </div>
        </div>
      )}

      {/* Targets status */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8, alignItems:'center' }}>
        <span style={{ fontSize:9, color:'var(--dim)' }}>Alvos:</span>
        {targets.map(tid => {
          const cb = combatants.find(c => c.id === tid)
          const responded = resolvedBy.includes(tid)
          return (
            <span key={tid} style={{ fontSize:9, padding:'2px 7px', borderRadius:3, fontWeight:700,
              background: responded ? 'rgba(59,165,93,.2)' : 'rgba(237,66,69,.2)',
              color: responded ? 'var(--green-l)' : 'var(--red-l)',
              border: `1px solid ${responded ? 'rgba(59,165,93,.3)' : 'rgba(237,66,69,.3)'}`,
            }}>
              {responded ? '✓ ' : '⏳ '}{cb?.character_name || '?'}
            </span>
          )
        })}
      </div>

      {/* My response buttons */}
      {iAmTarget && !iResponded && (
        <div>
          <div style={{ fontSize:10, color:'var(--text-h)', fontWeight:700, marginBottom:6 }}>
            🎯 Você foi alvo! Escolha sua resposta:
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <button className="btn" style={{ padding:'8px 12px', background:'rgba(34,211,238,.15)', color:'var(--teal-l)', border:'1px solid rgba(34,211,238,.4)', fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:11 }}
              onClick={()=>onRespond('dodge', action)}>
              💨 Desviar<br/><span style={{fontSize:9,fontWeight:400}}>Roll Agilidade</span>
            </button>
            <button className="btn" style={{ padding:'8px 12px', background:'rgba(88,101,242,.15)', color:'var(--blue-l)', border:'1px solid rgba(88,101,242,.4)', fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:11 }}
              onClick={()=>onRespond('defend', action)}>
              🛡️ Defender<br/><span style={{fontSize:9,fontWeight:400}}>Roll Resistência</span>
            </button>
            {action.attr_check && !['agilidade','resistencia'].includes(action.attr_check) && (
              <button className="btn" style={{ padding:'8px 12px', background:'rgba(155,89,182,.15)', color:'var(--purple-l)', border:'1px solid rgba(155,89,182,.4)', fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:11 }}
                onClick={()=>onRespond(action.attr_check, action)}>
                🎲 Rolar {atMeta?.label}<br/><span style={{fontSize:9,fontWeight:400}}>DC {action.dc||12}</span>
              </button>
            )}
            <button className="btn" style={{ padding:'8px 12px', background:'rgba(237,66,69,.12)', color:'var(--red-l)', border:'1px solid rgba(237,66,69,.35)', fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:11 }}
              onClick={()=>onRespond('take', action)}>
              💥 Absorver<br/><span style={{fontSize:9,fontWeight:400}}>Dano completo</span>
            </button>
          </div>
        </div>
      )}

      {/* Already responded */}
      {iAmTarget && iResponded && (
        <div style={{ fontSize:11, color:'var(--green-l)', fontWeight:700 }}>
          ✓ Você já respondeu — aguardando os outros alvos...
        </div>
      )}

      {/* Not a target — observer view */}
      {!iAmTarget && (
        <div style={{ fontSize:10, color:'var(--dim)', fontStyle:'italic' }}>
          {remaining.length > 0
            ? `Aguardando ${remaining.length} alvo(s) responder...`
            : '✓ Todos responderam'}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// DECLARE PENDING ACTION MODAL (Narrador/NPC)
// ─────────────────────────────────────────────
function DeclarePendingModal({ session, combatants, skills, missionDifficulty, activeNpc, userId, loc, actorInfo, onClose, onDeclared }) {
  const [form, setForm] = useState({
    actionType:  'attack',
    skillIdx:    '',
    targets:     [],       // combatant ids
    attrCheck:   '',       // empty = só dano, ou atributo
    difficulty:  'medium',
    description: '',
    areaAttack:  false,
  })
  const [saving, setSaving] = useState(false)

  const actor = activeNpc
    ? combatants.find(c=>c.npc_id===activeNpc.id)
    : combatants.find(c=>c.user_id===userId)

  function toggleTarget(id) {
    setForm(f=>({ ...f, targets: f.targets.includes(id) ? f.targets.filter(t=>t!==id) : [...f.targets, id] }))
  }

  async function handle() {
    if (!form.description.trim()) { notify('❌ Descreva a ação','error'); return }
    const targets = form.areaAttack ? combatants.filter(c=>c.is_alive&&c.id!==actor?.id).map(c=>c.id) : form.targets
    if (!targets.length) { notify('❌ Selecione ao menos um alvo','error'); return }

    const rollDiff = ROLL_DIFFICULTIES.find(r=>r.key===form.difficulty) || ROLL_DIFFICULTIES[2]
    const dc = missionDifficulty ? adaptRollDC(rollDiff.dc, missionDifficulty) : rollDiff.dc

    setSaving(true)
    const skillObj = form.skillIdx!=='' ? skills[Number(form.skillIdx)] : null
    const desc = `${actor?.character_name||'NPC'} — ${skillObj?`[${skillObj.name}] `:''} ${form.description}`

    await addCombatAction({
      session_id:  session.id,
      actor_id:    actor?.id,
      actor_name:  actor?.character_name || 'NPC',
      target_name: targets.map(id=>combatants.find(c=>c.id===id)?.character_name||'?').join(', '),
      action_type: form.actionType,
      skill_name:  skillObj?.name||null,
      description: desc,
      value:       0,
      roll_result: 0,
      is_pending:   true,
      pending_for:  targets,
      resolved_by:  [],       // who has already responded
      difficulty:   form.difficulty,
      attr_check:   form.attrCheck||null,
      dc,
      resolved:     false,
    })

    // Also post the declaration in chat, not just the battle log
    if (loc?.id && actorInfo) {
      await sendMessage({
        location_id:  loc.id,
        user_id:      userId,
        author_name:  actorInfo.name,
        author_alias: actorInfo.alias,
        author_color: actorInfo.color,
        content:      `⚠️ ${desc}`,
        mode:         'system',
        npc_id:       actorInfo.npcId,
      })
    }

    setSaving(false)
    notify('⚠️ Ação declarada — aguardando resposta dos targets!')
    onDeclared()
    onClose()
  }

  const players = combatants.filter(c=>c.type==='player'&&c.is_alive)
  const villains = combatants.filter(c=>(c.type==='villain'||c.type==='npc')&&c.is_alive)

  return (
    <Modal title="⚠️ Declarar Ação (NPC/Narrador)" onClose={onClose} maxWidth={540}>
      <div style={{ fontSize:11, color:'var(--muted)', marginBottom:14, lineHeight:1.6 }}>
        Declare uma ação que <strong style={{ color:'var(--text-h)' }}>requer resposta dos jogadores</strong> antes do efeito ser aplicado.
        Eles poderão desviar, defender ou rolar um atributo.
      </div>

      {/* Tipo */}
      <div className="field">
        <label>Tipo de Ação</label>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:5 }}>
          {ACTION_TYPES.filter(a=>['attack','skill','intel','charisma'].includes(a.key)).map(at=>(
            <div key={at.key} onClick={()=>setForm(f=>({...f,actionType:at.key}))}
              style={{ border:`1px solid ${form.actionType===at.key?at.color:'var(--border)'}`, borderRadius:5, padding:'6px 4px', cursor:'pointer', textAlign:'center', background:form.actionType===at.key?`${at.color}15`:'transparent' }}>
              <div style={{ fontSize:15, marginBottom:2 }}>{at.label.split(' ')[0]}</div>
              <div style={{ fontSize:9, color:form.actionType===at.key?at.color:'var(--muted)', fontWeight:700 }}>{at.label.split(' ').slice(1).join(' ')}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Técnica (se attack/skill) */}
      {skills.length>0 && ['attack','skill'].includes(form.actionType) && (
        <div className="field">
          <label>Técnica (opcional)</label>
          <select className="input" value={form.skillIdx} onChange={e=>setForm(f=>({...f,skillIdx:e.target.value}))}>
            <option value="">— Ataque básico —</option>
            {skills.map((sk,i)=><option key={i} value={i}>{sk.icon||'⚡'} {sk.name} (Nv.{sk.level})</option>)}
          </select>
        </div>
      )}

      {/* Área */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
        <input type="checkbox" id="area" checked={form.areaAttack} onChange={e=>setForm(f=>({...f,areaAttack:e.target.checked}))}/>
        <label htmlFor="area" style={{ fontSize:12, color:'var(--muted)', cursor:'pointer' }}>
          ⚡ Ataque em Área (afeta TODOS os alvos vivos)
        </label>
      </div>

      {/* Targets */}
      {!form.areaAttack && (
        <div className="field">
          <label>Alvos <span style={{ color:'var(--dim)', fontWeight:400 }}>(selecione quem precisa responder)</span></label>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            {[...players,...villains].map(cb=>(
              <div key={cb.id} onClick={()=>toggleTarget(cb.id)}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 9px', borderRadius:5, border:`1px solid ${form.targets.includes(cb.id)?'var(--red)':'var(--border)'}`, background:form.targets.includes(cb.id)?'rgba(237,66,69,.1)':'transparent', cursor:'pointer' }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:cb.type==='villain'?'var(--red)':cb.type==='npc'?'var(--gold)':'var(--green)', flexShrink:0 }}/>
                <span style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:12, flex:1 }}>{cb.character_name}</span>
                <span style={{ fontSize:9, color:'var(--dim)' }}>HP:{cb.hp}/{cb.hp_max}</span>
                {form.targets.includes(cb.id) && <span style={{ color:'var(--red-l)', fontSize:12 }}>✓</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Roll check (optional) */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div className="field">
          <label>Atributo Exigido <span style={{ color:'var(--dim)', fontWeight:400 }}>(para roll de resposta)</span></label>
          <select className="input" value={form.attrCheck} onChange={e=>setForm(f=>({...f,attrCheck:e.target.value}))}>
            <option value="">— Só dano (sem roll) —</option>
            {ATTR_KEYS.map(k=><option key={k} value={k}>{ATTR_META[k].label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Dificuldade do Roll</label>
          <select className="input" value={form.difficulty} onChange={e=>setForm(f=>({...f,difficulty:e.target.value}))}>
            {ROLL_DIFFICULTIES.map(r=>(
              <option key={r.key} value={r.key}>{r.label} (DC{r.dc}{missionDifficulty?'+adj':''})</option>
            ))}
          </select>
          {missionDifficulty && (
            <div style={{ fontSize:9, color:'var(--gold)', marginTop:2 }}>
              DC ajustado pela missão ({missionDifficulty})
            </div>
          )}
        </div>
      </div>

      <div className="field">
        <label>Descrição da Ação *</label>
        <textarea className="input" rows={2} value={form.description}
          onChange={e=>setForm(f=>({...f,description:e.target.value}))}
          placeholder="Ex: lança uma explosão em área, atingindo todos na região..."/>
      </div>

      <div style={{ display:'flex', gap:6 }}>
        <button className="btn btn-red btn-lg" onClick={handle} disabled={saving} style={{ flex:1 }}>
          {saving?'⏳...':'⚠️ Declarar Ação'}
        </button>
        <button className="btn btn-g" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────
// LOCATION CHAT
// ─────────────────────────────────────────────
function LocationChat({ loc, onBack, onRefreshLocs }) {
  const { user, profile, character } = useAuth()
  const [messages,     setMessages]     = useState([])
  const [text,         setText]         = useState('')
  const [actionMode,   setActionMode]   = useState(null)
  const [session,      setSession]      = useState(null)
  const [combatants,   setCombatants]   = useState([])
  const [combatLog,    setCombatLog]    = useState([])
  const [pendingActions, setPendingActions] = useState([])
  const [targetId,     setTargetId]     = useState(null)
  const [activeNpc,    setActiveNpc]    = useState(null)
  const [npcs,         setNpcs]         = useState([])
  const [allProfiles,  setAllProfiles]  = useState([])
  const [quests,       setQuests]       = useState([])
  const [currentQuest, setCurrentQuest] = useState(null)
  const [showCombatSetup,   setShowCombatSetup]   = useState(false)
  const [showNpcPicker,     setShowNpcPicker]     = useState(false)
  const [showSkillMenu,     setShowSkillMenu]     = useState(false)
  const [showDeclareModal,  setShowDeclareModal]  = useState(false)
  const [showRollModal,     setShowRollModal]     = useState(false)
  const [discoveredInfo,    setDiscoveredInfo]    = useState([])  // intel results in this session
  const endRef    = useRef(null)
  const subRefs   = useRef([])
  const char = character

  async function load() {
    const [
      {data:msgs}, {data:sess}, {data:ns}, {data:ps}, {data:qs}
    ] = await Promise.all([
      getMessages(loc.id,80), getActiveCombatSession(loc.id),
      getNpcs(), getAllProfiles(), getQuests(user.id),
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
      const allActs = acts||[]
      setCombatLog(allActs)
      // is_pending may be null in DB before patch — treat null as false
      // resolved may be null — treat null as false
      setPendingActions(allActs.filter(a => a.is_pending === true && a.resolved !== true))
      // Find current quest
      if (sess.quest_id) {
        const q = qs?.find(q=>q.id===sess.quest_id)
        setCurrentQuest(q||null)
      }
    } else {
      setCombatants([]); setCombatLog([]); setPendingActions([])
    }
  }

  useEffect(()=>{
    load()
    subRefs.current.forEach(s=>s?.unsubscribe())
    subRefs.current = [
      supabase.channel(`loc-msg-${loc.id}`)
        .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`location_id=eq.${loc.id}`},({new:m})=>setMessages(p=>[...p,m]))
        .subscribe(),
      supabase.channel(`loc-cbt-${loc.id}`)
        .on('postgres_changes',{event:'*',schema:'public',table:'combatants'},()=>load())
        .subscribe(),
      supabase.channel(`loc-act-${loc.id}`)
        .on('postgres_changes',{event:'*',schema:'public',table:'combat_actions'},()=>load())
        .subscribe(),
    ]
    return ()=>{ subRefs.current.forEach(s=>s?.unsubscribe()) }
  },[loc.id])

  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:'smooth'}) },[messages])

  function getMyCombatant() {
    if (activeNpc) {
      // First try to find the NPC as a combatant (added to combat)
      const npcCombatant = combatants.find(cb => cb.npc_id === activeNpc.id)
      if (npcCombatant) return npcCombatant
      // Fall back to the narrator's own combatant so they can act
      return combatants.find(cb => cb.user_id === user?.id)
    }
    return combatants.find(cb => cb.user_id === user?.id)
  }

  function getActorInfo() {
    // Always use NPC identity for messages when NPC is active
    if (activeNpc) return {
      name:  activeNpc.name,
      color: activeNpc.avatar_color || 'gray',
      npcId: activeNpc.id,
      alias: activeNpc.alias || '',
    }
    return {
      name:  char?.name || profile?.username || 'Herói',
      color: char?.avatar_color || 'purple',
      npcId: null,
      alias: char?.alias || '',
    }
  }

  // ── Send plain chat message
  async function handleSend() {
    if (!text.trim()||!user) return
    const {name,color,npcId,alias} = getActorInfo()
    await sendMessage({
      location_id:loc.id, user_id:user.id,
      author_name:name, author_alias:alias,
      author_color:color, content:text.trim(), mode:'rp', npc_id:npcId,
    })
    setText('')
  }

  // ── Resolve a pending action (individual per target)
  async function respondToPending(responseType, pendingAction) {
    const me = getMyCombatant()
    if (!me) { notify('Você não está no combate','error'); return }

    const roll     = rollD(20)
    const attrKey  = responseType==='dodge' ? 'agilidade' : responseType==='defend' ? 'resistencia' : responseType
    const attrV    = me.attrs?.[attrKey] || 0
    const dc       = pendingAction.dc || 12
    const result   = resolveAttributeRoll(attrV, roll, dc)
    const actor    = combatants.find(c => c.id === pendingAction.actor_id)
    const rollDisp = roll + Math.floor(attrV / 3)

    let desc = '', dmgTaken = 0

    if (responseType === 'take') {
      // Absorb full damage — no roll
      const atk   = actor?.attrs?.forca || 0
      const skill = pendingAction.skill_name ? charSkills.find(s=>s.name===pendingAction.skill_name) : null
      dmgTaken = rollD(8) + atk + (skill ? (skill.level||1)*3 : 0)
      await applyCombatEffect(me.id, -dmgTaken)
      desc = `💥 ${me.character_name} absorve o golpe diretamente — ${dmgTaken} de dano!`

    } else if (responseType === 'dodge') {
      if (result.success) {
        desc = `💨 D20=${roll}+AGI=${attrV}=${rollDisp} vs DC${dc} — ${me.character_name} DESVIA! (${result.label})`
        // No damage on success
      } else {
        const atk = actor?.attrs?.forca || 0
        dmgTaken  = result.degree === 'partial'
          ? Math.max(1, Math.floor((rollD(8) + atk) * 0.5))  // partial = half damage
          : rollD(8) + atk                                    // fail = full damage
        await applyCombatEffect(me.id, -dmgTaken)
        desc = `💨 D20=${roll}+AGI=${attrV}=${rollDisp} vs DC${dc} — ${result.label}. ${dmgTaken} de dano recebido!`
      }

    } else if (responseType === 'defend') {
      const atk       = actor?.attrs?.forca || 0
      const reduction = result.success
        ? Math.floor((me.attrs?.resistencia || 0) * (result.degree==='great' ? 0.75 : 0.5))
        : 0
      dmgTaken = Math.max(0, rollD(8) + atk - reduction)
      await applyCombatEffect(me.id, -dmgTaken)
      desc = result.success
        ? `🛡️ D20=${roll}+RES=${attrV}=${rollDisp} vs DC${dc} — Defesa! −${reduction} reduzido. ${dmgTaken} de dano. (${result.label})`
        : `🛡️ D20=${roll}+RES=${attrV}=${rollDisp} vs DC${dc} — Defesa falhou! ${dmgTaken} de dano. (${result.label})`

    } else {
      // Generic attribute roll (intel, carisma, controle, etc.)
      const atLabel = ATTR_META[attrKey]?.label || attrKey
      desc = `🎲 D20=${roll}+${atLabel}=${attrV}=${rollDisp} vs DC${dc} — ${me.character_name}: ${result.label}`
      if (!result.success && result.degree !== 'partial') {
        // Failure on attribute check = applies base damage if it was an attack
        if (['attack','skill'].includes(pendingAction.action_type)) {
          dmgTaken = rollD(6) + (actor?.attrs?.forca || 0)
          await applyCombatEffect(me.id, -dmgTaken)
          desc += ` — ${dmgTaken} de dano!`
        }
      }
    }

    // Track who responded using resolved_by array
    const currentResolvedBy = pendingAction.resolved_by || []
    const newResolvedBy      = [...new Set([...currentResolvedBy, me.id])]
    const allTargets         = pendingAction.pending_for || []
    const allResponded       = allTargets.every(id => newResolvedBy.includes(id))

    // Update the pending action: add me to resolved_by, mark resolved if everyone answered
    await supabase.from('combat_actions')
      .update({
        resolved_by: newResolvedBy,
        resolved:    allResponded,
      })
      .eq('id', pendingAction.id)

    // Log this response
    await addCombatAction({
      session_id:  session.id,
      actor_id:    me.id,
      actor_name:  me.character_name,
      target_id:   pendingAction.actor_id,
      target_name: actor?.character_name,
      action_type: responseType,
      roll_result: roll,
      value:       -dmgTaken,
      description: desc,
    })

    // Post in chat with action color
    const { name, color, npcId, alias } = getActorInfo()
    await sendMessage({
      location_id:  loc.id,
      user_id:      user.id,
      author_name:  name,
      author_alias: alias,
      author_color: color,
      content:      desc,
      mode:         responseType,
      npc_id:       npcId,
    })

    if (allResponded) {
      // Notify that all targets have responded
      await addCombatAction({
        session_id:  session.id,
        actor_name:  'Sistema',
        action_type: 'system',
        description: `✅ Todos os alvos responderam à ação de ${actor?.character_name || 'NPC'}.`,
        value:       0,
      })
    }

    load()
  }

  // ── Declare free action
  async function declareAction(actionKey, skill=null) {
    if (!session) return
    const me = getMyCombatant()
    if (!me) { notify('Você não está no combate','error'); return }
    if (!targetId&&['attack','skill','heal'].includes(actionKey)) { notify('Selecione um alvo','error'); return }
    const target  = targetId ? combatants.find(c=>c.id===targetId) : me
    const at      = getActionType(actionKey)
    const roll    = rollD(20)
    const isCrit  = roll===20
    const isMiss  = roll===1
    let value=0, desc=''

    if (actionKey==='attack'||actionKey==='skill') {
      if (!isMiss) {
        const attrV = me.attrs?.[at.attr]||0
        const techDmg = skill ? calcTechDmg(skill,me.attrs,me.quirk_data?.type||'',1) : 0
        value = isCrit
          ? (rollD(6)+attrV+techDmg)*2
          : rollD(6)+attrV+techDmg
        await applyCombatEffect(target.id,-value)
        if (skill) {
          await updateCombatant(me.id,{quirk_charge:Math.max(0,me.quirk_charge-calcTechQuirkCost(skill,me.quirk_max))})
          // Award quirk XP for technique usage (only for player combatants, not NPC-controlled)
          if (!activeNpc && user?.id) {
            const qxp = calcTechQuirkXp(skill.level || 1)
            const result = await addQuirkXp(user.id, qxp)
            if (result.leveledUp) {
              notify(`✨ Quirk evoluiu para ${['','Iniciante','Intermediário','Avançado','Mestre','Despertado'][result.newLevel]}!`, 'success')
            }
          }
        }
      }
      desc = isMiss ? `💨 FALHA! D20=${roll} — ${me.character_name} erra.`
        : isCrit ? `💥 CRÍTICO! D20=${roll} — ${value} dano em ${target.character_name}!${skill?` [${skill.name}]`:''}`
        : `${at.label.split(' ')[0]} D20=${roll} — ${value} dano em ${target.character_name}${skill?` [${skill.name}]`:''}.`
    } else if (actionKey==='heal') {
      value = rollD(6)+(me.attrs?.carisma||0)
      await applyCombatEffect(target.id,value)
      desc = `💚 D6+CAR — ${me.character_name} cura ${target.character_name} por ${value} HP!`
    } else if (actionKey==='dodge') {
      const total=roll+(me.attrs?.agilidade||0)
      desc = total>=10 ? `💨 D20=${roll}+AGI — ${me.character_name} está em esquiva! (${total})` : `💨 D20=${roll} — esquiva falhou. (${total})`
    } else if (actionKey==='defend') {
      desc = `🛡️ D20=${roll} — ${me.character_name} assume postura defensiva.`
    } else if (actionKey==='intel') {
      const total = roll + Math.floor((me.attrs?.inteligencia||0)/3)
      const dc    = 12
      const res   = resolveAttributeRoll(me.attrs?.inteligencia||0, roll, dc)
      // Reveal target's weakness if success
      let reveal = ''
      if (res.success && target && target.npc_id) {
        const npc = npcs.find(n=>n.id===target.npc_id)
        if (npc?.attrs) {
          // Find weakest attribute
          const weakAttr = Object.entries(npc.attrs).sort((a,b)=>a[1]-b[1])[0]
          reveal = weakAttr ? ` FRAQUEZA REVELADA: ${ATTR_META[weakAttr[0]]?.label} (${weakAttr[1]})` : ''
        }
        if (reveal) {
          setDiscoveredInfo(prev => [...prev, { target: target.character_name, info: reveal, turn: Date.now() }])
        }
      }
      desc = res.success
        ? `🧠 D20=${roll}+INT=${me.attrs?.inteligencia||0} (${total}) — ${res.label}!${reveal}`
        : `🧠 D20=${roll}+INT=${me.attrs?.inteligencia||0} (${total}) — ${res.label}. Nenhuma informação obtida.`
    } else if (actionKey==='charisma') {
      const total = roll + Math.floor((me.attrs?.carisma||0)/3)
      const dc    = target?.type==='villain' ? 16 : 10
      const res   = resolveAttributeRoll(me.attrs?.carisma||0, roll, dc)
      let effect  = ''
      if (res.success && target) {
        effect = res.degree==='great'
          ? ` ${target.character_name} é completamente convencido!`
          : ` ${target.character_name} hesita — abre para negociação.`
        if (res.degree==='partial') effect = ` ${target.character_name} reage com indiferença.`
      }
      desc = res.success || res.degree==='partial'
        ? `💬 D20=${roll}+CAR=${me.attrs?.carisma||0} (${total}) vs DC${dc} — ${res.label}.${effect}`
        : `💬 D20=${roll}+CAR=${me.attrs?.carisma||0} (${total}) vs DC${dc} — Falha. Nenhum efeito.`
    }

    await addCombatAction({
      session_id:session.id,
      actor_id:me.id, actor_name:me.character_name,
      target_id:target?.id, target_name:target?.character_name,
      action_type:actionKey, skill_name:skill?.name||null,
      roll_result:roll, value, description:desc,
    })

    const {name,color,npcId} = getActorInfo()
    await sendMessage({
      location_id:loc.id, user_id:user.id,
      author_name:name, author_color:color, author_alias:'',
      content:desc, mode:actionKey, npc_id:npcId,
    })

    setTargetId(null); setActionMode(null); setShowSkillMenu(false); load()
  }

  // ── Start combat
  async function startCombat(questId) {
    const{data:sess,error}=await createCombatSession(loc.id,questId||null,user.id)
    if(error){notify('❌ '+error.message,'error');return}
    if(char?.name) await addCombatant({
      session_id:sess.id, user_id:user.id,
      character_name:char.name, avatar_color:char.avatar_color, avatar_url:char.avatar_url,
      hp:char.hp||char.hp_max||100, hp_max:char.hp_max||100,
      quirk_charge:char.quirk_charge||char.quirk_max||100, quirk_max:char.quirk_max||100,
      stamina:char.stamina||char.stamina_max||100, stamina_max:char.stamina_max||100,
      attrs:char.attrs||{}, quirk_data:char.quirk_data||{},
      initiative:rollD(20)+(char.attrs?.agilidade||0), type:'player',
    })
    await upsertLocation({...loc,is_combat:true})
    await addCombatAction({session_id:sess.id,actor_name:'Sistema',action_type:'system',description:`⚔️ COMBATE INICIADO em ${loc.name}!`,value:0})
    setSession(sess); load(); setShowCombatSetup(false)
    notify('⚔️ Combate iniciado!','success')
  }

  // ── Start mission combat
  async function startMissionCombat(quest) {
    const{data:sess,error}=await createCombatSession(loc.id,quest.id,user.id)
    if(error){notify('❌ '+error.message,'error');return}
    const adds=[]
    ;(quest.assigned_users||[]).forEach(uid=>{
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
    })
    ;(quest.assigned_npcs||[]).forEach(npcId=>{
      const npc=npcs.find(n=>n.id===npcId)
      if(npc){
        const derived=calcDerived(npc.attrs||{},npc.quirk_type||'')
        const hpMax=npc.hp_max||derived.hpMax
        adds.push(addCombatant({
          session_id:sess.id, npc_id:npc.id,
          character_name:npc.name, avatar_color:npc.avatar_color||'gray', avatar_url:npc.avatar_url,
          hp:hpMax, hp_max:hpMax,
          quirk_charge:npc.quirk_max||derived.quirkMax, quirk_max:npc.quirk_max||derived.quirkMax,
          stamina:npc.stamina_max||derived.staminaMax, stamina_max:npc.stamina_max||derived.staminaMax,
          attrs:npc.attrs||{}, quirk_data:{name:npc.quirk_name||'',type:npc.quirk_type||''},
          initiative:rollD(20)+(npc.attrs?.agilidade||0),
          type:npc.role==='villain'?'villain':'npc',
        }))
      }
    })
    await Promise.all(adds)
    await upsertLocation({...loc,is_combat:true})
    await addCombatAction({session_id:sess.id,actor_name:'Sistema',action_type:'system',description:`⚔️ MISSÃO: ${quest.title} — Combate iniciado!`,value:0})
    setSession(sess); load(); setShowCombatSetup(false)
    notify('⚔️ Missão iniciada! Combate montado.','success')
  }

  async function endCombat() {
    if(!session||!confirm('Encerrar o combate?'))return
    await endCombatSession(session.id)
    await upsertLocation({...loc,is_combat:false})
    setSession(null); setCombatants([]); load(); onRefreshLocs()
    notify('🏁 Combate encerrado!')
  }

  async function addNpcToCombat(npc) {
    if(!session) return
    const derived=calcDerived(npc.attrs||{},npc.quirk_type||'')
    const hpMax=npc.hp_max||derived.hpMax
    await addCombatant({
      session_id:session.id, npc_id:npc.id,
      character_name:npc.name, avatar_color:npc.avatar_color||'gray', avatar_url:npc.avatar_url,
      hp:hpMax, hp_max:hpMax,
      quirk_charge:npc.quirk_max||derived.quirkMax, quirk_max:npc.quirk_max||derived.quirkMax,
      stamina:npc.stamina_max||derived.staminaMax, stamina_max:npc.stamina_max||derived.staminaMax,
      attrs:npc.attrs||{}, quirk_data:{name:npc.quirk_name||'',type:npc.quirk_type||''},
      initiative:rollD(20)+(npc.attrs?.agilidade||0),
      type:npc.role==='villain'?'villain':'npc',
    })
    await addCombatAction({session_id:session.id,actor_name:'Sistema',action_type:'system',description:`👤 ${npc.name} entrou! HP:${hpMax}`,value:0})
    load()
  }

  async function addPlayerToCombat(p) {
    if(!session) return
    const c=p.characters?.[0]
    if(!c){notify('Sem personagem','error');return}
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
    load()
  }

  const myChar     = getMyCombatant()
  const charSkills = char?.quirk_data?.skills?.filter(s=>techIsAvailable(s,char?.quirk_level||1))||[]
  const activeQuests = quests.filter(q=>!q.completed&&q.is_active)
  const isNarrator = true // all users can declare pending actions for now
  const hpColor = p => p>50?'var(--green)':p>25?'var(--gold)':'var(--red)'

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100dvh - 48px)', overflow:'hidden' }}>
      {/* Banner */}
      <div style={{ position:'relative', height:88, flexShrink:0, overflow:'hidden', borderBottom:'1px solid var(--border)' }}>
        {loc.background_url&&<img src={loc.background_url} alt="" style={{ position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',filter:'blur(4px) brightness(.35)',transform:'scale(1.05)' }}/>}
        <div style={{ position:'absolute',inset:0,background:loc.background_url?'transparent':'linear-gradient(135deg,var(--card),var(--bg))' }}/>
        <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',padding:'0 12px',gap:10 }}>
          <button className="btn btn-g btn-sm" onClick={onBack}>← Locais</button>
          <span style={{ fontSize:22 }}>{loc.icon||'🗺️'}</span>
          <div>
            <div style={{ fontFamily:'Bangers,cursive',fontSize:17,letterSpacing:2,textShadow:'0 2px 8px rgba(0,0,0,.9)',color:'#fff' }}>{loc.name}</div>
            {loc.description&&<div style={{ fontSize:9,color:'rgba(255,255,255,.55)' }}>{loc.description}</div>}
          </div>
          <div style={{ marginLeft:'auto',display:'flex',gap:4,flexWrap:'wrap',alignItems:'center' }}>

            {!session&&<button className="btn btn-red btn-sm" onClick={()=>setShowCombatSetup(true)}>⚔️ Iniciar</button>}
            {session&&<button className="btn btn-danger btn-sm" onClick={endCombat}>🏁</button>}
            {session&&(
              <button className="btn btn-sm" style={{ background:'rgba(237,66,69,.15)',color:'var(--red-l)',border:'1px solid rgba(237,66,69,.3)' }}
                onClick={()=>setShowDeclareModal(true)}>⚠️ Declarar</button>
            )}
            <button className="btn btn-sm" style={{ background:'rgba(255,179,0,.12)',color:'var(--gold)',border:'1px solid rgba(255,179,0,.3)' }}
              onClick={()=>setShowRollModal(true)}>🎲 Rolar</button>
            <button className="btn btn-g btn-sm" style={{ color:activeNpc?'var(--gold)':'var(--muted)',borderColor:activeNpc?'rgba(255,179,0,.4)':'var(--border)' }}
              onClick={()=>setShowNpcPicker(true)}>🎭 {activeNpc?activeNpc.name.slice(0,7):'NPC'}</button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex:1, display:'flex', overflow:'hidden', position:'relative' }}>

        {/* ── CHAT (full width always) ── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }} className="chat-main-col">
          <div className="msgs" style={{ flex:1 }}>
            {messages.map((msg,i)=>{
              const cls=ACTION_MSG_CLASS[msg.mode]||''
              const isNpc=!!msg.npc_id
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

          {/* NPC bar */}
          {activeNpc&&(
            <div className="chat-input-npc" style={{ borderBottom:'1px solid rgba(255,179,0,.2)',background:'rgba(255,179,0,.05)' }}>
              <div style={{ width:20,height:20,borderRadius:'50%',background:avatarBg(activeNpc.avatar_color||'gray'),display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Bangers,cursive',fontSize:9,color:'#fff',border:'1px solid var(--gold)',flexShrink:0 }}>{activeNpc.name[0]}</div>
              <span style={{ fontSize:10,color:'var(--gold)',fontWeight:700 }}>Como: {activeNpc.name}</span>
              <button onClick={()=>setActiveNpc(null)} style={{ marginLeft:'auto',background:'transparent',border:'none',color:'var(--dim)',cursor:'pointer',fontSize:14 }}>✕</button>
            </div>
          )}

          {/* Target indicator */}
          {session&&targetId&&(
            <div style={{ padding:'4px 12px',background:'rgba(237,66,69,.08)',borderBottom:'1px solid rgba(237,66,69,.2)',flexShrink:0,display:'flex',alignItems:'center',gap:8 }}>
              <span style={{ fontSize:10,color:'var(--red-l)' }}>🎯 Alvo: <strong>{combatants.find(c=>c.id===targetId)?.character_name}</strong></span>
              <button onClick={()=>setTargetId(null)} style={{ background:'transparent',border:'none',color:'var(--dim)',cursor:'pointer',fontSize:12,marginLeft:'auto' }}>✕</button>
            </div>
          )}

          {/* Mobile: sticky pending alert above input (when I am a target and panel is closed) */}
          {session&&pendingActions.filter(pa=>{
            const myIds=combatants.filter(c=>c.user_id===user?.id||(activeNpc&&c.npc_id===activeNpc?.id)).map(c=>c.id)
            const resolvedBy=pa.resolved_by||[]
            return pa.is_pending === true && pa.resolved !== true && (pa.pending_for||[]).some(id=>myIds.includes(id)) && !resolvedBy.some(id=>myIds.includes(id))
          }).length>0&&(
            <div style={{ padding:'7px 12px',background:'rgba(237,66,69,.12)',borderBottom:'1px solid rgba(237,66,69,.4)',flexShrink:0,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap' }}>
              <span style={{ fontSize:11,fontWeight:700,color:'var(--red-l)',flexShrink:0 }}>⚠️ Você está sendo atacado!</span>
              <button className="btn btn-sm" style={{ background:'rgba(34,211,238,.2)',color:'var(--teal-l)',border:'1px solid rgba(34,211,238,.4)' }}
                onClick={()=>{
                  const pa=pendingActions.find(a=>{
                    const myIds=combatants.filter(c=>c.user_id===user?.id||(activeNpc&&c.npc_id===activeNpc?.id)).map(c=>c.id)
                    return !a.resolved&&(a.pending_for||[]).some(id=>myIds.includes(id))&&!(a.resolved_by||[]).some(id=>myIds.includes(id))
                  })
                  if(pa) respondToPending('dodge',pa)
                }}>💨 Desviar</button>
              <button className="btn btn-sm" style={{ background:'rgba(88,101,242,.2)',color:'var(--blue-l)',border:'1px solid rgba(88,101,242,.4)' }}
                onClick={()=>{
                  const pa=pendingActions.find(a=>{
                    const myIds=combatants.filter(c=>c.user_id===user?.id||(activeNpc&&c.npc_id===activeNpc?.id)).map(c=>c.id)
                    return !a.resolved&&(a.pending_for||[]).some(id=>myIds.includes(id))&&!(a.resolved_by||[]).some(id=>myIds.includes(id))
                  })
                  if(pa) respondToPending('defend',pa)
                }}>🛡️ Defender</button>
              <button className="btn btn-sm" style={{ background:'rgba(237,66,69,.15)',color:'var(--red-l)',border:'1px solid rgba(237,66,69,.4)' }}
                onClick={()=>{
                  const pa=pendingActions.find(a=>{
                    const myIds=combatants.filter(c=>c.user_id===user?.id||(activeNpc&&c.npc_id===activeNpc?.id)).map(c=>c.id)
                    return !a.resolved&&(a.pending_for||[]).some(id=>myIds.includes(id))&&!(a.resolved_by||[]).some(id=>myIds.includes(id))
                  })
                  if(pa) respondToPending('take',pa)
                }}>💥 Absorver</button>
              <button className="btn btn-g btn-sm" style={{ marginLeft:'auto' }} onClick={()=>setShowSkillMenu(true)}>Ver painel ⚔️</button>
            </div>
          )}

          {/* ── INPUT — sem tabs de ação ── */}
          <div className="chat-input-body" style={{ borderTop:'1px solid var(--border)',padding:'8px 10px' }}>
            {session && (
              <button
                className="combat-toggle-btn"
                onClick={()=>setShowSkillMenu(s=>!s)}
                style={{ width:36,height:36,borderRadius:8,background:showSkillMenu?'rgba(237,66,69,.2)':'var(--panel)',border:`1px solid ${showSkillMenu?'var(--red)':'var(--border)'}`,color:showSkillMenu?'var(--red-l)':'var(--muted)',cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,transition:'all .15s' }}
                title="Painel de Combate"
              >⚔️</button>
            )}
            <textarea className="chat-textarea" rows={1} value={text}
              onChange={e=>setText(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();actionMode?declareAction(actionMode):handleSend()} }}
              placeholder={actionMode
                ? `${getActionType(actionMode)?.label} — descreva e envie...`
                : activeNpc?`Como ${activeNpc.name}...`:`Chat em ${loc.name}...`}
              style={{ border: actionMode ? `1px solid ${getActionType(actionMode)?.color||'var(--border)'}` : undefined }}
            />
            <button className="chat-send"
              onClick={()=>actionMode?declareAction(actionMode):handleSend()}
              disabled={!text.trim()&&!actionMode}
              style={{ background: actionMode ? getActionType(actionMode)?.color : undefined }}>↑</button>
          </div>
        </div>

        {/* ── COMBAT PANEL — fixed right on desktop, overlay on mobile ── */}
        {session&&(
          <>
            {/* Desktop: side panel */}
            <div className="combat-panel-desktop" style={{ width:240,flexShrink:0,borderLeft:'1px solid var(--border)',display:'flex',flexDirection:'column',overflowY:'auto',background:'var(--card)' }}>
              <CombatPanel
                combatants={combatants} combatLog={combatLog}
                targetId={targetId} setTargetId={setTargetId}
                myChar={myChar} actionMode={actionMode} setActionMode={setActionMode}
                charSkills={charSkills} showSkillMenu={showSkillMenu} setShowSkillMenu={setShowSkillMenu}
                declareAction={declareAction} setShowCombatSetup={setShowCombatSetup}
                user={user} activeNpc={activeNpc} hpColor={hpColor} getActionType={getActionType}
                session={session}
                pendingActions={pendingActions}
                onRespondPending={respondToPending}
                discoveredInfo={discoveredInfo}
              />
            </div>

            {/* Mobile: floating overlay triggered by ⚔️ button */}
            {showSkillMenu&&(
              <div className="combat-panel-mobile-overlay" onClick={e=>e.target===e.currentTarget&&setShowSkillMenu(false)}>
                <div className="combat-panel-mobile-sheet">
                  <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:'1px solid var(--border)',flexShrink:0 }}>
                    <span style={{ fontFamily:'Bangers,cursive',fontSize:16,letterSpacing:2,color:'var(--red-l)' }}><span className="live"/>⚔️ COMBATE</span>
                    <button onClick={()=>setShowSkillMenu(false)} style={{ background:'transparent',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:20,lineHeight:1 }}>✕</button>
                  </div>
                  <div style={{ flex:1,overflowY:'auto' }}>
                    <CombatPanel
                      combatants={combatants} combatLog={combatLog}
                      targetId={targetId} setTargetId={setTargetId}
                      myChar={myChar} actionMode={actionMode} setActionMode={setActionMode}
                      charSkills={charSkills} showSkillMenu={false} setShowSkillMenu={()=>{}}
                      declareAction={(key,sk)=>{ declareAction(key,sk); setShowSkillMenu(false) }}
                      setShowCombatSetup={setShowCombatSetup}
                      user={user} activeNpc={activeNpc} hpColor={hpColor} getActionType={getActionType}
                      session={session} isMobile
                      pendingActions={pendingActions}
                      onRespondPending={(type,pa)=>{ respondToPending(type,pa); setShowSkillMenu(false) }}
                      discoveredInfo={discoveredInfo}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODALS */}
      {showCombatSetup&&(
        <Modal title="⚔️ Iniciar / Gerenciar Combate" onClose={()=>setShowCombatSetup(false)} maxWidth={500}>
          {!session?(
            <>
              {activeQuests.length>0&&(
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontFamily:'Bangers,cursive',fontSize:13,letterSpacing:1,color:'var(--gold)',marginBottom:8 }}>📜 INICIAR DE UMA MISSÃO</div>
                  {activeQuests.map(q=>(
                    <div key={q.id} style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 10px',background:'var(--panel)',border:'1px solid var(--border)',borderRadius:6,marginBottom:6 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:12,color:'var(--text-h)' }}>{q.title}</div>
                        <div style={{ fontSize:9,color:'var(--dim)',marginTop:2 }}>{q.assigned_users?.length||0} jogador(es) · {q.assigned_npcs?.length||0} NPC(s) · {q.difficulty}</div>
                      </div>
                      <button className="btn btn-gold btn-sm" onClick={()=>startMissionCombat(q)}>⚔️ Iniciar Missão</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ fontFamily:'Bangers,cursive',fontSize:12,letterSpacing:1,color:'var(--muted)',marginBottom:8 }}>OU COMBATE LIVRE</div>
              <div className="field"><label>Vincular à Missão</label>
                <select className="input" id="quest-sel">
                  <option value="">— Sem missão —</option>
                  {activeQuests.map(q=><option key={q.id} value={q.id}>{q.title}</option>)}
                </select>
              </div>
              <button className="btn btn-red btn-full btn-lg" onClick={()=>startCombat(document.getElementById('quest-sel')?.value||null)}>⚔️ Iniciar Combate Livre</button>
            </>
          ):(
            <>
              <div style={{ fontSize:12,color:'var(--muted)',marginBottom:14 }}>Adicione combatentes:</div>
              <div style={{ fontFamily:'Bangers,cursive',fontSize:11,letterSpacing:1,color:'var(--muted)',marginBottom:8 }}>👥 JOGADORES</div>
              {allProfiles.filter(p=>p.characters?.length>0&&p.characters[0]?.name).map(p=>(
                <div key={p.id} style={{ display:'flex',alignItems:'center',gap:8,marginBottom:6 }}>
                  <Avatar name={p.characters[0]?.name||p.username} color={p.characters[0]?.avatar_color} size={26}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:11 }}>{p.characters[0]?.name}</div>
                    <div style={{ fontSize:9,color:'var(--dim)' }}>@{p.username}</div>
                  </div>
                  <button className="btn btn-p btn-sm" onClick={()=>addPlayerToCombat(p)} disabled={!!combatants.find(c=>c.user_id===p.id)}>
                    {combatants.find(c=>c.user_id===p.id)?'✓':'+ Add'}
                  </button>
                </div>
              ))}
              <div style={{ fontFamily:'Bangers,cursive',fontSize:11,letterSpacing:1,color:'var(--muted)',margin:'12px 0 8px' }}>🎭 NPCs</div>
              {npcs.map(npc=>(
                <div key={npc.id} style={{ display:'flex',alignItems:'center',gap:8,marginBottom:6 }}>
                  <Avatar name={npc.name} color={npc.avatar_color||'gray'} url={npc.avatar_url} size={26}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:11 }}>{npc.name}</div>
                    <div style={{ fontSize:9,color:'var(--dim)' }}>Nv.{npc.level||1} · HP:{npc.hp_max||100}</div>
                  </div>
                  <button className="btn btn-g btn-sm" onClick={()=>addNpcToCombat(npc)}>+ Add</button>
                </div>
              ))}
            </>
          )}
        </Modal>
      )}

      {showDeclareModal&&session&&(
        <DeclarePendingModal
          session={session}
          combatants={combatants}
          skills={charSkills}
          missionDifficulty={currentQuest?.difficulty||null}
          activeNpc={activeNpc}
          userId={user.id}
          loc={loc}
          actorInfo={getActorInfo()}
          onClose={()=>setShowDeclareModal(false)}
          onDeclared={load}
        />
      )}

      {showRollModal&&(
        <FreeRollModal
          char={char}
          attrs={activeNpc
            ? combatants.find(c=>c.npc_id===activeNpc?.id)?.attrs || activeNpc.attrs || {}
            : char?.attrs || {}}
          npcs={npcs}
          combatants={combatants}
          missionDifficulty={currentQuest?.difficulty||null}
          onClose={()=>setShowRollModal(false)}
          onRolled={async ({desc, result, attrKey, extra})=>{
            // Post result to chat
            const {name,color,npcId,alias} = getActorInfo()
            await sendMessage({
              location_id: loc.id, user_id: user.id,
              author_name: name, author_alias: alias,
              author_color: color, content: desc,
              mode: attrKey==='inteligencia'?'intel':attrKey==='carisma'?'charisma':'roll',
              npc_id: npcId,
            })
            // Track intel discoveries
            if (attrKey==='inteligencia' && extra) {
              setDiscoveredInfo(prev=>[...prev, {
                actor: name,
                info: extra,
                time: new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),
                success: result.success,
              }])
            }
            // If in combat, also log the action
            if (session) {
              const me = getMyCombatant()
              if (me) {
                await addCombatAction({
                  session_id: session.id,
                  actor_id: me.id, actor_name: me.character_name,
                  action_type: attrKey==='inteligencia'?'intel':'charisma',
                  description: desc, value: 0,
                })
              }
            }
          }}
        />
      )}

      {showNpcPicker&&(
        <Modal title="🎭 Vestir NPC" onClose={()=>setShowNpcPicker(false)} maxWidth={400}>
          <div style={{ fontSize:11,color:'var(--muted)',marginBottom:12 }}>Suas mensagens e ações serão executadas como o NPC.</div>
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
          {npcs.length===0&&<div style={{ fontSize:11,color:'var(--dim)',padding:8,textAlign:'center' }}>Nenhum NPC. Crie em 🎭 NPCs.</div>}
        </Modal>
      )}
    </div>
  )
}

/* ── LOCATION MODAL ── */
function LocationModal({ loc, onClose, onSaved }) {
  const {user}=useAuth()
  const [form,setForm]=useState({name:loc?.name||'',icon:loc?.icon||'🗺️',category:loc?.category||'',status:loc?.status||'Livre',description:loc?.description||'',pinned:loc?.pinned||false})
  const [coverFile,setCoverFile]=useState(null);const [bgFile,setBgFile]=useState(null)
  const [coverPreview,setCoverPreview]=useState(loc?.cover_url||null);const [bgPreview,setBgPreview]=useState(loc?.background_url||null)
  const [saving,setSaving]=useState(false)
  function handleImg(e,type){const file=e.target.files[0];if(!file)return;if(file.size>4*1024*1024){notify('❌ Máx 4MB','error');return};const url=URL.createObjectURL(file);if(type==='cover'){setCoverFile(file);setCoverPreview(url)}else{setBgFile(file);setBgPreview(url)}}
  async function handleSave(){
    if(!form.name.trim()){notify('❌ Nome obrigatório','error');return}
    setSaving(true)
    let cover_url=loc?.cover_url||null,background_url=loc?.background_url||null
    if(coverFile){const{url}=await uploadToBucket('locations',user.id,coverFile);if(url)cover_url=url}
    if(bgFile){const{url}=await uploadToBucket('locations',user.id,bgFile);if(url)background_url=url}
    const payload={...form,cover_url,background_url,created_by:user.id};if(loc?.id)payload.id=loc.id
    const{error}=await upsertLocation(payload);setSaving(false)
    if(error){notify('❌ '+error.message,'error');return}
    notify('✅ Local salvo!','success');onSaved()
  }
  return(
    <Modal title={loc?'✏️ Editar Local':'+ Novo Local'} onClose={onClose}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        <div className="field"><label>Nome *</label><input className="input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
        <div className="field"><label>Ícone</label><input className="input" value={form.icon} onChange={e=>setForm(f=>({...f,icon:e.target.value}))}/></div>
        <div className="field"><label>Categoria</label><input className="input" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}/></div>
        <div className="field"><label>Status</label><input className="input" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}/></div>
      </div>
      <div className="field"><label>Descrição</label><textarea className="input" rows={2} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/></div>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
        <input type="checkbox" id="pinned" checked={form.pinned} onChange={e=>setForm(f=>({...f,pinned:e.target.checked}))}/>
        <label htmlFor="pinned" style={{fontSize:12,color:'var(--muted)',cursor:'pointer'}}>📌 Fixar no topo</label>
      </div>
      <div className="field"><label>🖼️ Capa</label><div style={{display:'flex',gap:8,alignItems:'center'}}>{coverPreview&&<img src={coverPreview} alt="" style={{width:80,height:45,objectFit:'cover',borderRadius:4,border:'1px solid var(--border)'}}/>}<label className="btn btn-g btn-sm" style={{cursor:'pointer'}}>{coverPreview?'Trocar':'Escolher'}<input type="file" accept="image/*" style={{display:'none'}} onChange={e=>handleImg(e,'cover')}/></label></div></div>
      <div className="field"><label>🌫️ Fundo (blur)</label><div style={{display:'flex',gap:8,alignItems:'center'}}>{bgPreview&&<img src={bgPreview} alt="" style={{width:80,height:45,objectFit:'cover',borderRadius:4,border:'1px solid var(--border)',filter:'blur(2px)'}}/>}<label className="btn btn-g btn-sm" style={{cursor:'pointer'}}>{bgPreview?'Trocar':'Escolher'}<input type="file" accept="image/*" style={{display:'none'}} onChange={e=>handleImg(e,'bg')}/></label></div></div>
      <div style={{display:'flex',gap:6}}><button className="btn btn-p btn-lg" onClick={handleSave} disabled={saving} style={{flex:1}}>{saving?'⏳...':'💾 Salvar'}</button><button className="btn btn-g" onClick={onClose}>Cancelar</button></div>
    </Modal>
  )
}

export default function ExploreView() {
  const [locations,setLocations]=useState([])
  const [currentLoc,setCurrentLoc]=useState(null)
  const [showModal,setShowModal]=useState(false)
  const [editLoc,setEditLoc]=useState(null)
  async function load(){const{data}=await getLocations();if(data)setLocations(data)}
  useEffect(()=>{load()},[])
  async function handleDelete(loc){if(!confirm(`Remover "${loc.name}"?`))return;await deleteLocation(loc.id);notify('🗑️ Removido');load()}
  if(currentLoc) return <LocationChat loc={currentLoc} onBack={()=>{setCurrentLoc(null);load()}} onRefreshLocs={load}/>
  return(<><LocationsGrid locations={locations} onSelect={setCurrentLoc} onAdd={()=>{setEditLoc(null);setShowModal(true)}} onEdit={loc=>{setEditLoc(loc);setShowModal(true)}} onDelete={handleDelete}/>{showModal&&<LocationModal loc={editLoc} onClose={()=>{setShowModal(false);setEditLoc(null)}} onSaved={()=>{load();setShowModal(false);setEditLoc(null)}}/>}</>)
}
