import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  getQuests, upsertQuest, deleteQuest, completeQuest,
  getReputation, updateReputation, getAllProfiles, getLocations, getNpcs
} from '../../lib/supabase'
import { notify } from '../../components/Toast'
import Modal from '../../components/Modal'
import Avatar from '../../components/Avatar'
import { calcMissionXp, MISSION_TYPES, getMissionType } from '../../lib/gameSystem'
import { ROLE_STYLE } from './NpcsView'

const DIFF_META = {
  'TREINO':  { bg:'rgba(59,111,240,.15)',  c:'var(--blue-l)',   b:'rgba(59,111,240,.25)'  },
  'FÁCIL':   { bg:'rgba(47,191,113,.15)',   c:'var(--green-l)',  b:'rgba(47,191,113,.25)'   },
  'MÉDIO':   { bg:'rgba(242,183,5,.15)',   c:'var(--gold)',     b:'rgba(242,183,5,.25)'   },
  'DIFÍCIL': { bg:'rgba(229,72,77,.15)',   c:'var(--red-l)',    b:'rgba(229,72,77,.25)'   },
  'ÉPICO':   { bg:'rgba(139,92,246,.15)',  c:'var(--purple-l)', b:'rgba(139,92,246,.25)'  },
}

function QuestModal({ quest, onClose, onSaved, userId }) {
  const [profiles,  setProfiles]  = useState([])
  const [locations, setLocations] = useState([])
  const [npcs,      setNpcs]      = useState([])
  const [loading,   setLoading]   = useState(true)
  const [form, setForm] = useState({
    title:          quest?.title          || '',
    difficulty:     quest?.difficulty     || 'MÉDIO',
    mission_type:   quest?.mission_type   || 'combat',
    description:    quest?.description    || '',
    rewards:        quest?.rewards        || '',
    location_id:    quest?.location_id    || '',
    assigned_users: quest?.assigned_users || [],
    assigned_npcs:  quest?.assigned_npcs  || [],
  })
  const [objs, setObjs]     = useState(quest?.objectives?.map(o => o.text) || [''])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([getAllProfiles(), getLocations(), getNpcs()]).then(([{data:p},{data:l},{data:n}]) => {
      setProfiles(p || [])
      setLocations(l || [])
      setNpcs(n || [])
      setLoading(false)
    })
  }, [])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function toggleUser(uid) {
    const cur = form.assigned_users
    set('assigned_users', cur.includes(uid) ? cur.filter(u => u !== uid) : [...cur, uid])
  }

  function toggleNpc(npcId) {
    const cur = form.assigned_npcs
    set('assigned_npcs', cur.includes(npcId) ? cur.filter(n => n !== npcId) : [...cur, npcId])
  }

  // Calcula XP reactivo ao nível dos NPCs vinculados
  const linkedNpcLevels = npcs
    .filter(n => form.assigned_npcs.includes(n.id))
    .map(n => n.level || 1)
  const computedXp = calcMissionXp(form.difficulty, linkedNpcLevels)
  const missionTypeObj = getMissionType(form.mission_type)

  async function handle() {
    if (!form.title.trim()) { notify('❌ Título obrigatório', 'error'); return }
    setSaving(true)
    const objectives = objs.filter(t => t.trim()).map((t, i) => ({
      text: t,
      done: quest?.objectives?.[i]?.done || false
    }))
    const payload = { ...form, objectives, xp_reward: computedXp, is_active: true }
    if (quest?.id) payload.id = quest.id
    const { error } = await upsertQuest(userId, payload)
    setSaving(false)
    if (error) { notify('❌ ' + error.message, 'error'); return }
    notify('✅ Missão salva!', 'success'); onSaved()
  }

  const dm = DIFF_META[form.difficulty] || DIFF_META['MÉDIO']
  const playersWithChar = profiles.filter(p => p.characters?.length > 0 && p.characters[0]?.name)

  return (
    <Modal title={quest ? '✏️ Editar Missão' : '+ Nova Missão'} onClose={onClose} maxWidth={660}>
      {/* Tipo e Dificuldade */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div className="field">
          <label>Título *</label>
          <input className="input" value={form.title} onChange={e => set('title', e.target.value)} />
        </div>
        <div className="field">
          <label>Dificuldade</label>
          <select className="input" value={form.difficulty} onChange={e => set('difficulty', e.target.value)}>
            {Object.keys(DIFF_META).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Tipo de missão */}
      <div className="field">
        <label>🎯 Tipo de Missão</label>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginTop:4 }}>
          {MISSION_TYPES.map(mt => (
            <div key={mt.key} onClick={() => set('mission_type', mt.key)}
              style={{ border:`1px solid ${form.mission_type===mt.key?'var(--blue)':'var(--border)'}`, borderRadius:6, padding:'7px 6px', cursor:'pointer', textAlign:'center', background:form.mission_type===mt.key?'rgba(59,111,240,.12)':'transparent', transition:'all .15s' }}>
              <div style={{ fontSize:18, marginBottom:3 }}>{mt.icon}</div>
              <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:10, color:form.mission_type===mt.key?'var(--blue-l)':'var(--muted)' }}>{mt.label}</div>
            </div>
          ))}
        </div>
        {missionTypeObj && (
          <div style={{ fontSize:10, color:'var(--dim)', marginTop:6 }}>{missionTypeObj.desc} · Mult. XP: ×{missionTypeObj.xpMult}</div>
        )}
      </div>

      {/* XP preview */}
      <div style={{ padding:'8px 12px', background:dm.bg, border:`1px solid ${dm.b}`, borderRadius:6, marginBottom:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:9, color:'var(--dim)', textTransform:'uppercase', letterSpacing:1, marginBottom:2 }}>XP calculado</div>
          <div style={{ fontFamily:'Orbitron,monospace', fontSize:20, fontWeight:700, color:dm.c }}>{computedXp}</div>
        </div>
        <div style={{ fontSize:10, color:'var(--muted)', textAlign:'right', maxWidth:200 }}>
          {linkedNpcLevels.length > 0
            ? `Baseado no nível médio dos ${linkedNpcLevels.length} NPC(s) vinculados (Nv. médio: ${(linkedNpcLevels.reduce((a,b)=>a+b,0)/linkedNpcLevels.length).toFixed(1)})`
            : 'Vincule NPCs para ajustar o XP ao nível deles'
          }
        </div>
      </div>

      <div className="field"><label>Descrição</label><textarea className="input" rows={2} value={form.description} onChange={e => set('description', e.target.value)} /></div>
      <div className="field"><label>Recompensas extras (vírgula)</label><input className="input" value={form.rewards} onChange={e => set('rewards', e.target.value)} placeholder="+500 Créditos, Item Raro..." /></div>

      <div className="field">
        <label>📍 Local Vinculado</label>
        <select className="input" value={form.location_id} onChange={e => set('location_id', e.target.value)}>
          <option value="">— Sem local específico —</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
        </select>
      </div>

      {/* NPCs vinculados (afeta XP) */}
      <div className="field">
        <label>🎭 NPCs Vinculados <span style={{ color:'var(--gold)', fontWeight:400 }}>(nível deles afeta o XP)</span></label>
        {loading && <div style={{ fontSize:11, color:'var(--dim)', padding:8 }}>Carregando...</div>}
        {!loading && npcs.length === 0 && <div style={{ fontSize:11, color:'var(--dim)' }}>Nenhum NPC criado ainda.</div>}
        {!loading && npcs.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:4 }}>
            {npcs.map(npc => {
              const sel = form.assigned_npcs.includes(npc.id)
              const rsColor = ROLE_STYLE[npc.role]?.c || 'var(--blue-l)'
              const rsLabel = ROLE_STYLE[npc.role]?.label || npc.role
              return (
                <div key={npc.id} onClick={() => toggleNpc(npc.id)}
                  style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 9px', borderRadius:6, border:`1px solid ${sel?'var(--gold)':'var(--border)'}`, background:sel?'rgba(242,183,5,.06)':'transparent', cursor:'pointer', transition:'all .15s' }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:`linear-gradient(135deg,#374151,#1f2937)`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Bangers,cursive', fontSize:12, color:'#fff', flexShrink:0, overflow:'hidden' }}>
                    {npc.avatar_url ? <img src={npc.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : npc.name[0]}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:11, color:sel?'var(--text-h)':'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{npc.name}</div>
                    <div style={{ fontSize:9, color:rsColor }}>Nv.{npc.level||1} · {rsLabel}</div>
                  </div>
                  {sel && <span style={{ color:'var(--gold)', fontSize:14, flexShrink:0 }}>✓</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Jogadores vinculados */}
      <div className="field">
        <label>👥 Jogadores Vinculados <span style={{ color:'var(--blue-l)', fontWeight:400 }}>(receberão XP ao concluir)</span></label>
        {loading && <div style={{ fontSize:11, color:'var(--dim)', padding:8 }}>Carregando jogadores...</div>}
        {!loading && playersWithChar.length === 0 && (
          <div style={{ fontSize:11, color:'var(--dim)', padding:'8px 0' }}>
            Nenhum jogador com personagem criado. Peça para criarem na aba Ficha.
          </div>
        )}
        {!loading && playersWithChar.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:4 }}>
            {playersWithChar.map(p => {
              const char = p.characters[0]
              const selected = form.assigned_users.includes(p.id)
              return (
                <div key={p.id} onClick={() => toggleUser(p.id)}
                  style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 9px', borderRadius:6, border:`1px solid ${selected?'var(--blue)':'var(--border)'}`, background:selected?'rgba(59,111,240,.1)':'transparent', cursor:'pointer', transition:'all .15s' }}>
                  <Avatar name={char?.name||p.username} color={char?.avatar_color||'purple'} url={char?.avatar_url} size={28} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:selected?'var(--text-h)':'var(--text)' }}>{char?.name}</div>
                    <div style={{ fontSize:9, color:'var(--dim)' }}>@{p.username}</div>
                  </div>
                  {selected && <span style={{ color:'var(--blue-l)', fontSize:14, flexShrink:0 }}>✓</span>}
                </div>
              )
            })}
          </div>
        )}
        {form.assigned_users.length > 0 && (
          <div style={{ fontSize:10, color:'var(--blue-l)', marginTop:6, fontWeight:700 }}>
            {form.assigned_users.length} jogador{form.assigned_users.length>1?'es':''} selecionado{form.assigned_users.length>1?'s':''}
          </div>
        )}
      </div>

      {/* Objetivos */}
      <div className="field">
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
          <label style={{ margin:0 }}>Objetivos</label>
          <button className="btn btn-g btn-sm" onClick={() => setObjs([...objs, ''])}>+ Add</button>
        </div>
        {objs.map((o, i) => (
          <div key={i} style={{ display:'flex', gap:5, marginBottom:5 }}>
            <input className="input" value={o} onChange={e => { const n=[...objs]; n[i]=e.target.value; setObjs(n) }} placeholder={`Objetivo ${i+1}...`} />
            <button onClick={() => setObjs(objs.filter((_,j) => j!==i))} style={{ background:'transparent', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:18, flexShrink:0 }}>✕</button>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:6 }}>
        <button className="btn btn-p btn-lg" onClick={handle} disabled={saving} style={{ flex:1 }}>{saving?'⏳...':'💾 Salvar'}</button>
        {quest && <button className="btn btn-danger" onClick={async()=>{if(!confirm('Remover?'))return;await deleteQuest(quest.id);notify('🗑️ Removida');onSaved()}}>🗑️</button>}
        <button className="btn btn-g" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  )
}

export default function QuestsView({ onQuestCountChange }) {
  const { user, refreshCharacter } = useAuth()
  const [quests, setQuests]   = useState([])
  const [rep, setRep]         = useState({ civis:0, viloes:0, missoes:0, baixas:0 })
  const [showAdd, setShowAdd] = useState(false)
  const [editQ, setEditQ]     = useState(null)
  const [showRep, setShowRep] = useState(false)
  const [tab, setTab]         = useState('active')

  async function load() {
    const { data } = await getQuests(user.id)
    if (data) { setQuests(data); onQuestCountChange?.(data.filter(q => q.is_active && !q.completed).length) }
    const { data:r } = await getReputation(user.id)
    if (r) setRep(r)
  }
  useEffect(() => { load() }, [])

  async function toggleObj(quest, idx) {
    const newObjs = [...quest.objectives]
    newObjs[idx] = { ...newObjs[idx], done: !newObjs[idx].done }
    await upsertQuest(user.id, { id: quest.id, objectives: newObjs })
    load()
  }

  async function handleComplete(quest) {
    const recipients = [...new Set([user.id, ...(quest.assigned_users||[])].filter(Boolean))]
    if (!confirm(`Concluir "${quest.title}"?\n+${quest.xp_reward||100} XP para ${recipients.length} participante(s).`)) return
    const { error, xpAwarded, leveledUp, newLevel } = await completeQuest(quest.id, user.id)
    if (error) { notify('❌ ' + error.message, 'error'); return }
    notify(`🏆 Missão concluída! +${xpAwarded||quest.xp_reward||100} XP distribuídos!`, 'success')
    if (leveledUp) {
      setTimeout(() => notify(`⬆️ LEVEL UP! Você é agora Nível ${newLevel}! Distribua seus novos pontos na Ficha.`, 'success'), 800)
    }
    await updateReputation(user.id, { missoes: (rep.missoes||0) + 1 })
    // Refresh the local character so level + XP bar update immediately
    await refreshCharacter()
    load()
  }

  const active    = quests.filter(q => q.is_active && !q.completed)
  const completed = quests.filter(q => q.completed)
  const displayed = tab === 'active' ? active : completed

  return (
    <div style={{ flex:1, overflowY:'auto', padding:14 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, flexWrap:'wrap' }}>
        <div style={{ fontFamily:'Bangers,cursive', fontSize:20, letterSpacing:3, color:'var(--blue-l)' }}>MISSÕES</div>
        <button className="btn btn-p btn-sm" onClick={() => { setEditQ(null); setShowAdd(true) }}>+ Nova Missão</button>
        <div style={{ display:'flex', gap:4, marginLeft:8 }}>
          <button className={`btn btn-sm ${tab==='active'?'btn-p':'btn-g'}`} onClick={() => setTab('active')}>Ativas ({active.length})</button>
          <button className={`btn btn-sm ${tab==='completed'?'btn-p':'btn-g'}`} onClick={() => setTab('completed')}>Concluídas ({completed.length})</button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:14, maxWidth:1200, margin:'0 auto' }} className="q-layout">
        <div>
          {displayed.length === 0 && (
            <div style={{ textAlign:'center', padding:32, color:'var(--muted)', fontSize:12 }}>
              <div style={{ fontSize:36, marginBottom:8 }}>{tab==='active'?'📜':'🏆'}</div>
              {tab==='active' ? 'Nenhuma missão ativa. Clique em "+ Nova Missão".' : 'Nenhuma missão concluída ainda.'}
            </div>
          )}
          {displayed.map(q => {
            const dm    = DIFF_META[q.difficulty] || DIFF_META['MÉDIO']
            const mt    = getMissionType(q.mission_type)
            const total = (q.objectives||[]).length
            const done  = (q.objectives||[]).filter(o => o.done).length
            const pct   = total > 0 ? Math.round(done/total*100) : 0
            return (
              <div key={q.id} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, padding:14, marginBottom:10, transition:'border-color .2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor='var(--glow)'}
                onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8, gap:6 }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:3 }}>
                      {mt && <span style={{ fontSize:18 }}>{mt.icon}</span>}
                      <div style={{ fontFamily:'Bangers,cursive', fontSize:18, letterSpacing:1, color:'var(--text-h)' }}>{q.title}</div>
                    </div>
                    <div style={{ display:'flex', gap:5 }}>
                      <span style={{ fontSize:8, fontWeight:700, padding:'2px 5px', borderRadius:3, textTransform:'uppercase', background:dm.bg, color:dm.c, border:`1px solid ${dm.b}` }}>{q.difficulty}</span>
                      {mt && <span style={{ fontSize:8, color:'var(--muted)', padding:'2px 5px', background:'var(--panel)', borderRadius:3 }}>{mt.label}</span>}
                      {q.completed && <span style={{ fontSize:8, color:'var(--green-l)', fontWeight:700 }}>✓ CONCLUÍDA</span>}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:4, alignItems:'center', flexShrink:0 }}>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontFamily:'Orbitron,monospace', fontSize:12, fontWeight:700, color:'var(--gold)' }}>+{q.xp_reward||100}</div>
                      <div style={{ fontSize:8, color:'var(--dim)' }}>XP</div>
                    </div>
                    {!q.completed && <button className="btn btn-g btn-sm" onClick={() => { setEditQ(q); setShowAdd(true) }}>✏️</button>}
                  </div>
                </div>

                {q.description && <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.5, marginBottom:10 }}>{q.description}</div>}

                {total > 0 && (
                  <div style={{ marginBottom:10 }}>
                    {q.objectives.map((o, i) => (
                      <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:7, marginBottom:5 }}>
                        <div onClick={() => !q.completed && toggleObj(q, i)}
                          style={{ width:15, height:15, borderRadius:3, border:`1px solid ${o.done?'var(--green)':'var(--border)'}`, background:o.done?'var(--green)':'transparent', color:'#fff', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, marginTop:1, cursor:q.completed?'default':'pointer' }}>
                          {o.done ? '✓' : ''}
                        </div>
                        <span style={{ fontSize:11, color:o.done?'var(--dim)':'var(--muted)', textDecoration:o.done?'line-through':'none', lineHeight:1.4 }}>{o.text}</span>
                      </div>
                    ))}
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'var(--dim)', marginBottom:3, marginTop:7 }}>
                      <span>Progresso</span><span>{done}/{total} ({pct}%)</span>
                    </div>
                    <div className="pbar"><div className="pbar-fill" style={{ width:`${pct}%`, background:'var(--blue)' }} /></div>
                  </div>
                )}

                {/* Badges de vinculados */}
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8, alignItems:'center' }}>
                  {q.assigned_users?.length > 0 && (
                    <span style={{ fontSize:9, color:'var(--blue-l)', background:'rgba(59,111,240,.1)', padding:'2px 7px', borderRadius:3, border:'1px solid rgba(59,111,240,.25)' }}>
                      👥 {q.assigned_users.length} jogador{q.assigned_users.length>1?'es':''}
                    </span>
                  )}
                  {q.assigned_npcs?.length > 0 && (
                    <span style={{ fontSize:9, color:'var(--gold)', background:'rgba(242,183,5,.08)', padding:'2px 7px', borderRadius:3, border:'1px solid rgba(242,183,5,.2)' }}>
                      🎭 {q.assigned_npcs.length} NPC{q.assigned_npcs.length>1?'s':''}
                    </span>
                  )}
                  {q.location_id && (
                    <span style={{ fontSize:9, color:'var(--muted)', background:'var(--panel)', padding:'2px 7px', borderRadius:3, border:'1px solid var(--border)' }}>
                      📍 Local vinculado
                    </span>
                  )}
                </div>

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderTop:'1px solid var(--border)', paddingTop:8 }}>
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                    {q.rewards && q.rewards.split(',').map((r,i) => (
                      <span key={i} style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:3, padding:'2px 6px', fontSize:9, color:'var(--muted)' }}>{r.trim()}</span>
                    ))}
                  </div>
                  {!q.completed && (
                    <button className="btn btn-gold btn-sm" onClick={() => handleComplete(q)}>✓ Concluir</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Sidebar */}
        <div>
          <div className="card" style={{ marginBottom:10 }}>
            <div className="card-title">📊 Progresso</div>
            {active.length === 0 && <div style={{ fontSize:10, color:'var(--dim)' }}>Sem missões ativas.</div>}
            {active.map(q => {
              const total=(q.objectives||[]).length, done=(q.objectives||[]).filter(o=>o.done).length
              const pct=total>0?Math.round(done/total*100):0
              const mt=getMissionType(q.mission_type)
              return (
                <div key={q.id} style={{ marginBottom:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--muted)', marginBottom:3 }}>
                    <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:120 }}>{mt?.icon} {q.title}</span>
                    <span style={{ color:'var(--gold)', flexShrink:0 }}>{pct}%</span>
                  </div>
                  <div className="pbar"><div className="pbar-fill" style={{ width:`${pct}%`, background:'var(--blue)' }} /></div>
                </div>
              )
            })}
          </div>

          <div className="card">
            <div className="card-title">🏆 Reputação <button className="btn btn-g btn-sm" onClick={() => setShowRep(true)}>✏️</button></div>
            {[
              {l:'Civis Salvos',      v:rep.civis,   c:'var(--green-l)'},
              {l:'Vilões Capturados', v:rep.viloes,  c:'var(--blue-l)'},
              {l:'Missões Completas', v:rep.missoes, c:'var(--gold)'},
              {l:'Baixas Civis',      v:rep.baixas,  c:rep.baixas===0?'var(--green-l)':'var(--red-l)'},
            ].map(s => (
              <div key={s.l} style={{ display:'flex', justifyContent:'space-between', fontSize:11, padding:'5px 8px', background:'var(--panel)', borderRadius:4, border:'1px solid var(--border)', marginBottom:4 }}>
                <span style={{ color:'var(--muted)' }}>{s.l}</span>
                <span style={{ color:s.c, fontFamily:'Orbitron,monospace', fontSize:11 }}>{s.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showAdd && (
        <QuestModal quest={editQ} onClose={() => { setShowAdd(false); setEditQ(null) }}
          onSaved={() => { load(); setShowAdd(false); setEditQ(null) }} userId={user.id} />
      )}

      {showRep && (
        <Modal title="🏆 Reputação" onClose={() => setShowRep(false)} maxWidth={400}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {[{l:'Civis Salvos',k:'civis'},{l:'Vilões Capturados',k:'viloes'},{l:'Missões Completas',k:'missoes'},{l:'Baixas Civis',k:'baixas'}].map(f => (
              <div key={f.k} className="field"><label>{f.l}</label>
                <input className="input" type="number" value={rep[f.k]} onChange={e => setRep(r => ({...r,[f.k]:Number(e.target.value)}))} />
              </div>
            ))}
          </div>
          <button className="btn btn-p btn-full btn-lg" onClick={async () => { await updateReputation(user.id, rep); setShowRep(false); notify('✅ Reputação salva!') }}>💾 Salvar</button>
        </Modal>
      )}
    </div>
  )
}
