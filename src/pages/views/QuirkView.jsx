import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { upsertCharacter } from '../../lib/supabase'
import { notify } from '../../components/Toast'
import Modal from '../../components/Modal'

export default function QuirkView({ onRefreshChar }) {
  const { user, character } = useAuth()
  const [showEdit, setShowEdit] = useState(false)
  const [showAddSkill, setShowAddSkill] = useState(false)
  const [editSkillIdx, setEditSkillIdx] = useState(null)
  const char = character
  const q = char?.quirk_data || { name:'', type:'', subtype:'', level:1, range:'', weakness:'', dominio:0, carga:100, description:'', awakening:'', skills:[] }

  async function saveQuirkData(newQ) {
    const { error } = await upsertCharacter(user.id, { ...char, quirk_data: newQ })
    if (error) { notify('❌ '+error.message,'error'); return false }
    await onRefreshChar(); return true
  }

  if (!char) return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, color:'var(--muted)' }}>
      <div style={{ fontSize:40 }}>✨</div>
      <div style={{ fontFamily:'Bangers,cursive', fontSize:18, letterSpacing:2, color:'var(--purple-l)' }}>CRIE SEU PERSONAGEM PRIMEIRO</div>
      <div style={{ fontSize:12 }}>Acesse a Ficha do Herói para criar seu personagem.</div>
    </div>
  )

  const skills = q.skills || []
  const unlocked = skills.filter(s=>!s.locked)
  const locked = skills.filter(s=>s.locked)

  return (
    <div style={{ flex:1, overflowY:'auto', padding:14 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
        <div style={{ fontFamily:'Bangers,cursive', fontSize:20, letterSpacing:3, color:'var(--purple-l)' }}>QUIRK &amp; HABILIDADES</div>
        <button className="btn btn-p btn-sm" onClick={()=>setShowEdit(true)}>✏️ Editar Quirk</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        {/* LEFT */}
        <div>
          <div className="card card-purple" style={{ marginBottom:12 }}>
            {q.name ? <>
              <div style={{ fontFamily:'Bangers,cursive', fontSize:26, letterSpacing:2, color:'var(--purple-l)' }}>{q.name}</div>
              <div style={{ fontSize:8, letterSpacing:3, color:'var(--purple-l)', opacity:.6, textTransform:'uppercase', marginBottom:8 }}>{q.type}{q.subtype?' · '+q.subtype:''}</div>
              {q.description && <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.6, marginBottom:10 }}>{q.description}</div>}
              {[{l:'CARGA',v:q.carga||100,c:'linear-gradient(90deg,var(--purple),var(--blue-l))',vc:'var(--purple-l)'},{l:'DOMÍNIO',v:q.dominio||0,c:'linear-gradient(90deg,var(--gold-d),var(--gold))',vc:'var(--gold)'}].map(b=>(
                <div key={b.l} style={{ marginBottom:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'var(--dim)', letterSpacing:1, marginBottom:3 }}><span>{b.l}</span><span style={{ color:b.vc }}>{b.v}%</span></div>
                  <div style={{ height:7, background:'var(--border)', borderRadius:4, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${b.v}%`, background:b.c, borderRadius:4, transition:'width .5s' }}/>
                  </div>
                </div>
              ))}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:5 }}>
                {[{l:'Nível',v:`Nv.${q.level}`,c:'var(--gold)'},{l:'Alcance',v:q.range,c:'var(--blue-l)'},{l:'Tipo',v:q.type,c:'var(--purple-l)'},{l:'Fraqueza',v:q.weakness,c:'var(--red-l)'}].filter(s=>s.v).map(s=>(
                  <div key={s.l} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:5, padding:7, textAlign:'center' }}>
                    <div style={{ fontSize:7, letterSpacing:1, color:'var(--dim)', textTransform:'uppercase', marginBottom:3 }}>{s.l}</div>
                    <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:11, color:s.c }}>{s.v}</div>
                  </div>
                ))}
              </div>
              {q.awakening && (
                <div style={{ background:'rgba(255,179,0,.06)', border:'1px solid rgba(255,179,0,.2)', borderRadius:5, padding:8, marginTop:10 }}>
                  <div style={{ fontSize:9, color:'var(--gold)', fontWeight:700, letterSpacing:1, marginBottom:3, textTransform:'uppercase' }}>⚡ Awakening</div>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>{q.awakening}</div>
                </div>
              )}
            </> : (
              <div style={{ textAlign:'center', padding:20 }}>
                <div style={{ fontSize:36, marginBottom:8 }}>✨</div>
                <div style={{ fontFamily:'Bangers,cursive', fontSize:16, letterSpacing:1, color:'var(--purple-l)', marginBottom:6 }}>NENHUM QUIRK CONFIGURADO</div>
                <button className="btn btn-purple btn-sm" onClick={()=>setShowEdit(true)} style={{ background:'var(--purple)', color:'#fff' }}>Configurar Quirk</button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Skill Tree */}
        <div>
          <div className="card">
            <div className="card-title">🌳 Técnicas &amp; Habilidades
              <button className="btn btn-p btn-sm" onClick={()=>{setEditSkillIdx(null);setShowAddSkill(true)}}>+ Add</button>
            </div>
            {skills.length === 0 && <div style={{ fontSize:11, color:'var(--dim)', padding:8 }}>Clique em "+ Add" para adicionar técnicas.</div>}
            {unlocked.length > 0 && <>
              <div style={{ fontSize:9, color:'var(--green-l)', letterSpacing:2, textTransform:'uppercase', marginBottom:6 }}>✅ DESBLOQUEADAS</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7, marginBottom:12 }}>
                {unlocked.map((s,i)=><SkillNode key={i} s={s} idx={skills.indexOf(s)} onEdit={idx=>{setEditSkillIdx(idx);setShowAddSkill(true)}} />)}
              </div>
            </>}
            {locked.length > 0 && <>
              <div style={{ fontSize:9, color:'var(--dim)', letterSpacing:2, textTransform:'uppercase', marginBottom:6 }}>🔒 BLOQUEADAS</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7, opacity:.5 }}>
                {locked.map((s,i)=><SkillNode key={i} s={s} idx={skills.indexOf(s)} onEdit={idx=>{setEditSkillIdx(idx);setShowAddSkill(true)}} />)}
              </div>
            </>}
            <div style={{ fontSize:9, color:'var(--dim)', marginTop:8 }}>Clique numa técnica para editar.</div>
          </div>
        </div>
      </div>

      {showEdit && <QuirkEditModal q={q} onClose={()=>setShowEdit(false)} onSave={async newQ=>{const ok=await saveQuirkData(newQ);if(ok)setShowEdit(false)}} />}
      {showAddSkill && (
        <SkillEditModal
          skill={editSkillIdx!==null?skills[editSkillIdx]:null}
          onClose={()=>{setShowAddSkill(false);setEditSkillIdx(null)}}
          onSave={async sk=>{
            const newSkills=[...skills]
            if(editSkillIdx!==null)newSkills[editSkillIdx]=sk; else newSkills.push(sk)
            const ok=await saveQuirkData({...q,skills:newSkills})
            if(ok){setShowAddSkill(false);setEditSkillIdx(null)}
          }}
          onDelete={editSkillIdx!==null?async()=>{
            const newSkills=skills.filter((_,i)=>i!==editSkillIdx)
            const ok=await saveQuirkData({...q,skills:newSkills})
            if(ok){setShowAddSkill(false);setEditSkillIdx(null)}
          }:null}
        />
      )}
    </div>
  )
}

function SkillNode({ s, idx, onEdit }) {
  return (
    <div onClick={()=>onEdit(idx)} style={{ background:'var(--panel)', border:`1px solid ${s.locked?'var(--border)':'rgba(124,58,237,.5)'}`, borderRadius:7, padding:10, cursor:'pointer', textAlign:'center', position:'relative', transition:'all .2s' }}
      onMouseEnter={e=>e.currentTarget.style.borderColor='var(--purple)'}
      onMouseLeave={e=>e.currentTarget.style.borderColor=s.locked?'var(--border)':'rgba(124,58,237,.5)'}>
      {!s.locked && <div style={{ position:'absolute', top:5, left:7, fontSize:9, color:'var(--green-l)', fontWeight:700 }}>✓</div>}
      <div style={{ fontSize:22, display:'block', marginBottom:4 }}>{s.icon||'⚡'}</div>
      <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:11, color:'var(--text)', marginBottom:2 }}>{s.name}</div>
      <div style={{ fontSize:9, color:'var(--muted)', lineHeight:1.3 }}>{s.type}</div>
      <div style={{ position:'absolute', top:5, right:7, fontFamily:'Orbitron,monospace', fontSize:8, color:'var(--gold)' }}>Nv.{s.level}</div>
    </div>
  )
}

function QuirkEditModal({ q, onClose, onSave }) {
  const [form, setForm] = useState({ name:q.name||'', type:q.type||'', subtype:q.subtype||'', level:q.level||1, range:q.range||'', weakness:q.weakness||'', dominio:q.dominio||0, carga:q.carga||100, description:q.description||'', awakening:q.awakening||'' })
  const [saving, setSaving] = useState(false)
  function set(k,v){setForm(f=>({...f,[k]:v}))}
  async function handle(){
    if(!form.name.trim()){notify('❌ Nome do Quirk obrigatório','error');return}
    setSaving(true)
    await onSave({...q,...form,level:Number(form.level),dominio:Number(form.dominio),carga:Number(form.carga)})
    setSaving(false)
  }
  return (
    <Modal title="✨ Editar Quirk" onClose={onClose}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div className="field"><label>Nome do Quirk *</label><input className="input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Ex: Shadow Weave" /></div>
        <div className="field"><label>Tipo</label><input className="input" value={form.type} onChange={e=>set('type',e.target.value)} placeholder="Ex: Emitter" /></div>
        <div className="field"><label>Subtipo</label><input className="input" value={form.subtype} onChange={e=>set('subtype',e.target.value)} placeholder="Ex: Manipulação" /></div>
        <div className="field"><label>Nível</label><input className="input" type="number" min={1} value={form.level} onChange={e=>set('level',e.target.value)} /></div>
        <div className="field"><label>Alcance</label><input className="input" value={form.range} onChange={e=>set('range',e.target.value)} placeholder="Ex: 15m" /></div>
        <div className="field"><label>Fraqueza</label><input className="input" value={form.weakness} onChange={e=>set('weakness',e.target.value)} placeholder="Ex: Luz intensa" /></div>
        <div className="field"><label>% Domínio (0-100)</label><input className="input" type="number" min={0} max={100} value={form.dominio} onChange={e=>set('dominio',e.target.value)} /></div>
        <div className="field"><label>% Carga Atual (0-100)</label><input className="input" type="number" min={0} max={100} value={form.carga} onChange={e=>set('carga',e.target.value)} /></div>
      </div>
      <div className="field"><label>Descrição completa</label><textarea className="input" rows={3} value={form.description} onChange={e=>set('description',e.target.value)} /></div>
      <div className="field"><label>Awakening (deixe vazio se não tiver)</label><textarea className="input" rows={2} value={form.awakening} onChange={e=>set('awakening',e.target.value)} /></div>
      <div style={{ display:'flex', gap:6 }}>
        <button className="btn btn-p btn-lg" onClick={handle} disabled={saving} style={{ flex:1 }}>{saving?'⏳ Salvando...':'💾 Salvar'}</button>
        <button className="btn btn-g" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  )
}

function SkillEditModal({ skill, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({ name:skill?.name||'', icon:skill?.icon||'⚡', type:skill?.type||'', cost:skill?.cost||'', level:skill?.level||1, locked:skill?.locked||false, desc:skill?.desc||'' })
  const [saving, setSaving] = useState(false)
  function set(k,v){setForm(f=>({...f,[k]:v}))}
  async function handle(){
    if(!form.name.trim()){notify('❌ Nome obrigatório','error');return}
    setSaving(true); await onSave({...form,level:Number(form.level)}); setSaving(false)
  }
  return (
    <Modal title={skill?'✏️ Editar Técnica':'+ Nova Técnica'} onClose={onClose}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div className="field"><label>Nome *</label><input className="input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Ex: Shadow Net" /></div>
        <div className="field"><label>Ícone (emoji)</label><input className="input" value={form.icon} onChange={e=>set('icon',e.target.value)} placeholder="🕸️" /></div>
        <div className="field"><label>Tipo</label><input className="input" value={form.type} onChange={e=>set('type',e.target.value)} placeholder="Ataque / Defesa / Captura / Especial" /></div>
        <div className="field"><label>Custo / Dano</label><input className="input" value={form.cost} onChange={e=>set('cost',e.target.value)} placeholder="Ex: 2d6+4 · 10% Quirk" /></div>
        <div className="field"><label>Nível</label><input className="input" type="number" min={1} value={form.level} onChange={e=>set('level',e.target.value)} /></div>
        <div className="field"><label>Estado</label>
          <select className="input" value={form.locked?'true':'false'} onChange={e=>set('locked',e.target.value==='true')}>
            <option value="false">✅ Desbloqueada</option>
            <option value="true">🔒 Bloqueada</option>
          </select>
        </div>
      </div>
      <div className="field"><label>Descrição / Efeito</label><textarea className="input" rows={2} value={form.desc} onChange={e=>set('desc',e.target.value)} /></div>
      <div style={{ display:'flex', gap:6 }}>
        <button className="btn btn-p btn-lg" onClick={handle} disabled={saving} style={{ flex:1 }}>{saving?'⏳...':'💾 Salvar'}</button>
        {onDelete && <button className="btn btn-danger" onClick={async()=>{if(confirm('Remover?')){setSaving(true);await onDelete();setSaving(false)}}}>🗑️</button>}
        <button className="btn btn-g" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  )
}
