import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  getQuests, upsertQuest, deleteQuest, completeQuest,
  getReputation, updateReputation,
  getAllProfiles, getLocations
} from '../../lib/supabase'
import { notify } from '../../components/Toast'
import Modal from '../../components/Modal'
import Avatar from '../../components/Avatar'

const DIFF_META = {
  'TREINO':  { bg:'rgba(37,99,235,.15)',  c:'var(--blue-l)',   b:'rgba(37,99,235,.25)',  xp:50   },
  'FÁCIL':   { bg:'rgba(22,163,74,.15)',  c:'var(--green-l)',  b:'rgba(22,163,74,.25)',  xp:100  },
  'MÉDIO':   { bg:'rgba(255,179,0,.15)',  c:'var(--gold)',     b:'rgba(255,179,0,.25)',  xp:250  },
  'DIFÍCIL': { bg:'rgba(220,38,38,.15)',  c:'var(--red-l)',    b:'rgba(220,38,38,.25)',  xp:500  },
  'ÉPICO':   { bg:'rgba(124,58,237,.15)', c:'var(--purple-l)', b:'rgba(124,58,237,.25)', xp:1000 },
}

/* ── QUEST MODAL ── */
function QuestModal({ quest, onClose, onSaved, userId }) {
  const [profiles,  setProfiles]  = useState([])
  const [locations, setLocations] = useState([])
  const [form, setForm] = useState({
    title:          quest?.title        || '',
    difficulty:     quest?.difficulty   || 'MÉDIO',
    description:    quest?.description  || '',
    rewards:        quest?.rewards      || '',
    location_id:    quest?.location_id  || '',
    assigned_users: quest?.assigned_users || [],
  })
  const [objs, setObjs] = useState(quest?.objectives?.map(o => o.text) || [''])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getAllProfiles().then(({ data }) => setProfiles(data || []))
    getLocations().then(({ data }) => setLocations(data || []))
  }, [])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function toggleUser(uid) {
    const cur = form.assigned_users
    set('assigned_users', cur.includes(uid) ? cur.filter(u => u !== uid) : [...cur, uid])
  }

  async function handle() {
    if (!form.title.trim()) { notify('❌ Título obrigatório', 'error'); return }
    setSaving(true)
    const diff = form.difficulty
    const xp_reward = DIFF_META[diff]?.xp || 100
    const objectives = objs.filter(t => t.trim()).map((t, i) => ({
      text: t,
      done: quest?.objectives?.[i]?.done || false
    }))
    const payload = { ...form, objectives, xp_reward, is_active: true }
    if (quest?.id) payload.id = quest.id
    const { error } = await upsertQuest(userId, payload)
    setSaving(false)
    if (error) { notify('❌ ' + error.message, 'error'); return }
    notify('✅ Missão salva!', 'success'); onSaved()
  }

  const dm = DIFF_META[form.difficulty] || DIFF_META['MÉDIO']

  return (
    <Modal title={quest ? '✏️ Editar Missão' : '+ Nova Missão'} onClose={onClose} maxWidth={620}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div className="field"><label>Título *</label><input className="input" value={form.title} onChange={e=>set('title',e.target.value)} /></div>
        <div className="field"><label>Dificuldade</label>
          <select className="input" value={form.difficulty} onChange={e=>set('difficulty',e.target.value)}>
            {Object.keys(DIFF_META).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div style={{ padding:'6px 10px', background:dm.bg, border:`1px solid ${dm.b}`, borderRadius:5, marginBottom:10, fontSize:11, color:dm.c, display:'flex', justifyContent:'space-between' }}>
        <span>Recompensa base: <strong>{dm.xp} EXP</strong></span>
        <span style={{ fontSize:10, opacity:.7 }}>Distribuído para todos os vinculados ao concluir</span>
      </div>

      <div className="field"><label>Descrição</label><textarea className="input" rows={2} value={form.description} onChange={e=>set('description',e.target.value)} /></div>
      <div className="field"><label>Recompensas extras (separadas por vírgula)</label><input className="input" value={form.rewards} onChange={e=>set('rewards',e.target.value)} placeholder="+500 Créditos, Item Raro..." /></div>

      {/* Local vinculado */}
      <div className="field">
        <label>📍 Local Vinculado</label>
        <select className="input" value={form.location_id} onChange={e=>set('location_id',e.target.value)}>
          <option value="">— Sem local específico —</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
        </select>
      </div>

      {/* Jogadores vinculados */}
      <div className="field">
        <label>👥 Jogadores Vinculados (receberão XP ao concluir)</label>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:4 }}>
          {profiles.filter(p => p.characters?.length > 0).map(p => {
            const char = p.characters[0]
            const selected = form.assigned_users.includes(p.id)
            return (
              <div key={p.id} onClick={() => toggleUser(p.id)}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 9px', borderRadius:6, border:`1px solid ${selected?'var(--blue)':'var(--border)'}`, background:selected?'rgba(37,99,235,.1)':'transparent', cursor:'pointer', transition:'all .15s' }}>
                <Avatar name={char?.name||p.username} color={char?.avatar_color||'purple'} url={char?.avatar_url} size={26} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{char?.name||p.username}</div>
                  <div style={{ fontSize:9, color:'var(--dim)' }}>@{p.username}</div>
                </div>
                {selected && <span style={{ color:'var(--blue-l)', fontSize:12, flexShrink:0 }}>✓</span>}
              </div>
            )
          })}
          {profiles.filter(p=>p.characters?.length>0).length === 0 && (
            <div style={{ fontSize:11, color:'var(--dim)', gridColumn:'1/-1' }}>Nenhum jogador com personagem ainda.</div>
          )}
        </div>
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
            <button onClick={() => setObjs(objs.filter((_,j)=>j!==i))} style={{ background:'transparent', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:16, flexShrink:0 }}>✕</button>
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

/* ── MAIN VIEW ── */
export default function QuestsView({ onQuestCountChange }) {
  const { user } = useAuth()
  const [quests, setQuests]   = useState([])
  const [rep, setRep]         = useState({ civis:0, viloes:0, missoes:0, baixas:0 })
  const [showAdd, setShowAdd] = useState(false)
  const [editQ, setEditQ]     = useState(null)
  const [showRep, setShowRep] = useState(false)
  const [tab, setTab]         = useState('active')  // active | completed

  async function load() {
    const { data } = await getQuests(user.id)
    if (data) {
      setQuests(data)
      onQuestCountChange?.(data.filter(q => q.is_active && !q.completed).length)
    }
    const { data: r } = await getReputation(user.id)
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
    if (!confirm(`Concluir "${quest.title}"? O XP será distribuído automaticamente para todos os jogadores vinculados.`)) return
    const { error } = await completeQuest(quest.id)
    if (error) { notify('❌ ' + error.message, 'error'); return }
    notify(`🏆 Missão concluída! ${quest.xp_reward||100} EXP distribuídos!`, 'success')
    // Atualiza reputação de missões concluídas
    await updateReputation(user.id, { missoes: (rep.missoes || 0) + 1 })
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

      <div style={{ display:'grid', gridTemplateColumns:'1fr 265px', gap:14 }} className="q-layout">
        <div>
          {displayed.length === 0 && (
            <div style={{ textAlign:'center', padding:32, color:'var(--muted)', fontSize:12 }}>
              <div style={{ fontSize:36, marginBottom:8 }}>{tab==='active'?'📜':'🏆'}</div>
              {tab==='active' ? 'Nenhuma missão ativa. Clique em "+ Nova Missão".' : 'Nenhuma missão concluída ainda.'}
            </div>
          )}

          {displayed.map(q => {
            const dm = DIFF_META[q.difficulty] || DIFF_META['MÉDIO']
            const total = (q.objectives||[]).length
            const done  = (q.objectives||[]).filter(o=>o.done).length
            const pct   = total>0 ? Math.round(done/total*100) : 0
            return (
              <div key={q.id} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, padding:14, marginBottom:10, transition:'border-color .2s' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor='var(--glow)'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>

                {/* Header */}
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8, gap:6 }}>
                  <div>
                    <div style={{ fontFamily:'Bangers,cursive', fontSize:18, letterSpacing:1 }}>{q.title}</div>
                    {q.completed && <span style={{ fontSize:9, color:'var(--green-l)', fontWeight:700 }}>✓ CONCLUÍDA</span>}
                  </div>
                  <div style={{ display:'flex', gap:4, alignItems:'center', flexShrink:0 }}>
                    <span style={{ fontSize:8, fontWeight:700, padding:'2px 6px', borderRadius:3, textTransform:'uppercase', background:dm.bg, color:dm.c, border:`1px solid ${dm.b}` }}>{q.difficulty}</span>
                    <span style={{ fontSize:9, color:'var(--gold)', fontFamily:'Orbitron,monospace' }}>+{q.xp_reward||100}</span>
                    {!q.completed && <button className="btn btn-g btn-sm" onClick={() => { setEditQ(q); setShowAdd(true) }}>✏️</button>}
                  </div>
                </div>

                {q.description && <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.5, marginBottom:10 }}>{q.description}</div>}

                {/* Objetivos */}
                {total > 0 && (
                  <div style={{ marginBottom:10 }}>
                    {q.objectives.map((o,i) => (
                      <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:7, marginBottom:5 }}>
                        <div onClick={() => !q.completed && toggleObj(q, i)}
                          style={{ width:15, height:15, borderRadius:3, border:`1px solid ${o.done?'var(--green)':'var(--border)'}`, background:o.done?'var(--green)':'transparent', color:'#fff', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, marginTop:1, cursor:q.completed?'default':'pointer' }}>
                          {o.done?'✓':''}
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

                {/* Jogadores vinculados */}
                {q.assigned_users?.length > 0 && (
                  <div style={{ display:'flex', gap:4, alignItems:'center', marginBottom:8, flexWrap:'wrap' }}>
                    <span style={{ fontSize:9, color:'var(--dim)' }}>Participantes:</span>
                    {q.assigned_users.map(uid => (
                      <div key={uid} style={{ width:20, height:20, borderRadius:'50%', background:'var(--glow)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, color:'#fff' }} title={uid.slice(0,8)}>👤</div>
                    ))}
                    <span style={{ fontSize:9, color:'var(--muted)' }}>({q.assigned_users.length} jogador{q.assigned_users.length>1?'es':''})</span>
                  </div>
                )}

                {/* Footer */}
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
              const total=(q.objectives||[]).length
              const done=(q.objectives||[]).filter(o=>o.done).length
              const pct=total>0?Math.round(done/total*100):0
              return (
                <div key={q.id} style={{ marginBottom:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--muted)', marginBottom:3 }}>
                    <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:130 }}>{q.title}</span>
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
              {l:'Civis Salvos',       v:rep.civis,   c:'var(--green-l)'},
              {l:'Vilões Capturados',  v:rep.viloes,  c:'var(--blue-l)'},
              {l:'Missões Completas',  v:rep.missoes, c:'var(--gold)'},
              {l:'Baixas Civis',       v:rep.baixas,  c:rep.baixas===0?'var(--green-l)':'var(--red-l)'},
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
          <RepForm rep={rep} onSave={async r => { await updateReputation(user.id, r); setRep(r); setShowRep(false) }} />
        </Modal>
      )}
    </div>
  )
}

function RepForm({ rep, onSave }) {
  const [form, setForm] = useState({ ...rep })
  return (
    <>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        {[{l:'Civis Salvos',k:'civis'},{l:'Vilões Capturados',k:'viloes'},{l:'Missões Completas',k:'missoes'},{l:'Baixas Civis',k:'baixas'}].map(f => (
          <div key={f.k} className="field"><label>{f.l}</label><input className="input" type="number" value={form[f.k]} onChange={e => setForm(s => ({...s,[f.k]:Number(e.target.value)}))} /></div>
        ))}
      </div>
      <button className="btn btn-p btn-full btn-lg" onClick={() => onSave(form)}>💾 Salvar</button>
    </>
  )
}
