import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getQuests, upsertQuest, deleteQuest, getReputation, updateReputation } from '../../lib/supabase'
import { notify } from '../../components/Toast'
import Modal from '../../components/Modal'

const DIFF_COLORS = {
  'FÁCIL':    { bg:'rgba(22,163,74,.2)',  c:'var(--green-l)',  b:'rgba(22,163,74,.3)' },
  'MÉDIO':    { bg:'rgba(255,179,0,.15)', c:'var(--gold)',     b:'rgba(255,179,0,.25)' },
  'DIFÍCIL':  { bg:'rgba(220,38,38,.2)',  c:'var(--red-l)',    b:'rgba(220,38,38,.3)' },
  'ÉPICO':    { bg:'rgba(124,58,237,.2)', c:'var(--purple-l)', b:'rgba(124,58,237,.3)' },
  'TREINO':   { bg:'rgba(37,99,235,.15)', c:'var(--blue-l)',   b:'rgba(37,99,235,.25)' },
}

export default function QuestsView({ onQuestCountChange }) {
  const { user } = useAuth()
  const [quests, setQuests] = useState([])
  const [rep, setRep] = useState({ civis:0, viloes:0, missoes:0, baixas:0 })
  const [showAdd, setShowAdd] = useState(false)
  const [editQuest, setEditQuest] = useState(null)
  const [showRep, setShowRep] = useState(false)

  async function load() {
    const { data } = await getQuests(user.id)
    if (data) { setQuests(data); onQuestCountChange?.(data.filter(q=>q.is_active).length) }
    const { data: r } = await getReputation(user.id)
    if (r) setRep(r)
  }

  useEffect(() => { load() }, [])

  async function toggleObjective(quest, idx) {
    const newObjs = [...quest.objectives]
    newObjs[idx] = { ...newObjs[idx], done: !newObjs[idx].done }
    await upsertQuest(user.id, { id: quest.id, objectives: newObjs })
    load()
  }

  return (
    <div style={{ flex:1, overflowY:'auto', padding:14 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
        <div style={{ fontFamily:'Bangers,cursive', fontSize:20, letterSpacing:3, color:'var(--blue-l)' }}>MISSÕES</div>
        <button className="btn btn-p btn-sm" onClick={()=>{setEditQuest(null);setShowAdd(true)}}>+ Nova Missão</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 265px', gap:14 }}>
        <div>
          {quests.length === 0 && (
            <div style={{ textAlign:'center', padding:32, color:'var(--muted)', fontSize:12 }}>
              <div style={{ fontSize:36, marginBottom:8 }}>📜</div>
              Sem missões. Clique em "+ Nova Missão".
            </div>
          )}
          {quests.map(q => {
            const dc = DIFF_COLORS[q.difficulty] || DIFF_COLORS['MÉDIO']
            const total = (q.objectives||[]).length
            const done = (q.objectives||[]).filter(o=>o.done).length
            const pct = total>0 ? Math.round(done/total*100) : 0
            return (
              <div key={q.id} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, padding:13, marginBottom:9, transition:'border-color .2s' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor='var(--glow)'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:6 }}>
                  <div style={{ fontFamily:'Bangers,cursive', fontSize:17, letterSpacing:1 }}>{q.title}</div>
                  <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                    <span style={{ fontSize:8, fontWeight:700, padding:'2px 6px', borderRadius:3, textTransform:'uppercase', background:dc.bg, color:dc.c, border:`1px solid ${dc.b}` }}>{q.difficulty}</span>
                    <button onClick={()=>{setEditQuest(q);setShowAdd(true)}} style={{ background:'transparent', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:12 }}>✏️</button>
                  </div>
                </div>
                {q.description && <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.5, marginBottom:9 }}>{q.description}</div>}
                {total > 0 && (
                  <div style={{ marginBottom:9 }}>
                    {q.objectives.map((o,i)=>(
                      <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:6, fontSize:11, marginBottom:4 }}>
                        <div onClick={()=>toggleObjective(q,i)} style={{ width:14, height:14, borderRadius:3, border:`1px solid ${o.done?'var(--green)':'var(--border)'}`, background:o.done?'var(--green)':'transparent', color:'#fff', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, marginTop:1, cursor:'pointer' }}>
                          {o.done?'✓':''}
                        </div>
                        <span style={{ color:o.done?'var(--dim)':'var(--muted)', textDecoration:o.done?'line-through':'none', lineHeight:1.4 }}>{o.text}</span>
                      </div>
                    ))}
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'var(--dim)', marginBottom:3, marginTop:6 }}><span>Progresso</span><span>{done}/{total} ({pct}%)</span></div>
                    <div style={{ height:3, background:'var(--border)', borderRadius:2, overflow:'hidden' }}><div style={{ height:'100%', width:`${pct}%`, background:'var(--blue)', borderRadius:2 }}/></div>
                  </div>
                )}
                {q.rewards && (
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap', borderTop:'1px solid var(--border)', paddingTop:8 }}>
                    {q.rewards.split(',').map((r,i)=>(
                      <div key={i} style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:4, padding:'3px 7px', fontSize:9, color:'var(--muted)', fontWeight:600 }}>{r.trim()}</div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div>
          <div className="card" style={{ marginBottom:10 }}>
            <div className="card-title">📊 Progresso</div>
            {quests.length === 0 && <div style={{ fontSize:10, color:'var(--dim)' }}>Sem missões</div>}
            {quests.map(q=>{
              const total=(q.objectives||[]).length; const done=(q.objectives||[]).filter(o=>o.done).length
              const pct=total>0?Math.round(done/total*100):0
              return (
                <div key={q.id} style={{ marginBottom:7 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--muted)', marginBottom:3 }}><span>{q.title}</span><span style={{ color:'var(--gold)' }}>{pct}%</span></div>
                  <div style={{ height:4, background:'var(--border)', borderRadius:2, overflow:'hidden' }}><div style={{ height:'100%', width:`${pct}%`, background:'var(--blue)', borderRadius:2 }}/></div>
                </div>
              )
            })}
          </div>
          <div className="card">
            <div className="card-title">🏆 Reputação <button className="btn btn-g btn-sm" onClick={()=>setShowRep(true)}>✏️</button></div>
            {[{l:'Civis Salvos',v:rep.civis,c:'var(--green-l)'},{l:'Vilões Capturados',v:rep.viloes,c:'var(--blue-l)'},{l:'Missões Completas',v:rep.missoes,c:'var(--gold)'},{l:'Baixas Civis',v:rep.baixas,c:rep.baixas===0?'var(--green-l)':'var(--red-l)'}].map(s=>(
              <div key={s.l} style={{ display:'flex', justifyContent:'space-between', fontSize:11, padding:'4px 7px', background:'var(--panel)', borderRadius:4, border:'1px solid var(--border)', marginBottom:4 }}>
                <span style={{ color:'var(--muted)' }}>{s.l}</span><span style={{ color:s.c, fontFamily:'Orbitron,monospace', fontSize:10 }}>{s.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showAdd && <QuestModal quest={editQuest} onClose={()=>{setShowAdd(false);setEditQuest(null)}} onSaved={()=>{load();setShowAdd(false);setEditQuest(null)}} userId={user.id} />}
      {showRep && <RepModal rep={rep} onClose={()=>setShowRep(false)} onSaved={async r=>{await updateReputation(user.id,r);setRep(r);setShowRep(false)}} />}
    </div>
  )
}

function QuestModal({ quest, onClose, onSaved, userId }) {
  const [form, setForm] = useState({ title:quest?.title||'', difficulty:quest?.difficulty||'MÉDIO', description:quest?.description||'', rewards:quest?.rewards||'' })
  const [objs, setObjs] = useState(quest?.objectives?.map(o=>o.text) || [''])
  const [saving, setSaving] = useState(false)
  function set(k,v){setForm(f=>({...f,[k]:v}))}
  async function handle(){
    if(!form.title.trim()){notify('❌ Título obrigatório','error');return}
    setSaving(true)
    const objectives = objs.filter(t=>t.trim()).map((t,i)=>({text:t,done: quest?.objectives?.[i]?.done || false}))
    const payload = { ...form, objectives }
    if(quest?.id) payload.id = quest.id
    const { error } = await upsertQuest(userId, payload)
    setSaving(false)
    if(error){notify('❌ '+error.message,'error');return}
    notify('✅ Missão salva!','success'); onSaved()
  }
  return (
    <Modal title={quest?'✏️ Editar Missão':'+ Nova Missão'} onClose={onClose}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div className="field"><label>Título *</label><input className="input" value={form.title} onChange={e=>set('title',e.target.value)} /></div>
        <div className="field"><label>Dificuldade</label>
          <select className="input" value={form.difficulty} onChange={e=>set('difficulty',e.target.value)}>
            {['FÁCIL','MÉDIO','DIFÍCIL','ÉPICO','TREINO'].map(d=><option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>
      <div className="field"><label>Descrição</label><textarea className="input" rows={2} value={form.description} onChange={e=>set('description',e.target.value)} /></div>
      <div className="field"><label>Recompensas (separadas por vírgula)</label><input className="input" value={form.rewards} onChange={e=>set('rewards',e.target.value)} placeholder="+1000 EXP, +500 Créditos" /></div>
      <div className="field">
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
          <label style={{ margin:0 }}>Objetivos</label>
          <button className="btn btn-g btn-sm" onClick={()=>setObjs([...objs,''])}>+ Add</button>
        </div>
        {objs.map((o,i)=>(
          <div key={i} style={{ display:'flex', gap:5, marginBottom:4 }}>
            <input className="input" value={o} onChange={e=>{const n=[...objs];n[i]=e.target.value;setObjs(n)}} placeholder="Objetivo..." />
            <button onClick={()=>setObjs(objs.filter((_,j)=>j!==i))} style={{ background:'transparent', border:'none', color:'var(--dim)', cursor:'pointer' }}>✕</button>
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

function RepModal({ rep, onClose, onSaved }) {
  const [form, setForm] = useState({ civis:rep.civis, viloes:rep.viloes, missoes:rep.missoes, baixas:rep.baixas })
  return (
    <Modal title="🏆 Editar Reputação" onClose={onClose} maxWidth={400}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        {[{l:'Civis Salvos',k:'civis'},{l:'Vilões Capturados',k:'viloes'},{l:'Missões Completas',k:'missoes'},{l:'Baixas Civis',k:'baixas'}].map(f=>(
          <div key={f.k} className="field"><label>{f.l}</label><input className="input" type="number" value={form[f.k]} onChange={e=>setForm(s=>({...s,[f.k]:Number(e.target.value)}))} /></div>
        ))}
      </div>
      <div style={{ display:'flex', gap:6 }}>
        <button className="btn btn-p btn-lg" onClick={()=>onSaved(form)} style={{ flex:1 }}>💾 Salvar</button>
        <button className="btn btn-g" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  )
}
