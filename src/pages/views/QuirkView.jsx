import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { upsertCharacter } from '../../lib/supabase'
import { notify } from '../../components/Toast'
import Modal from '../../components/Modal'

const QUIRK_TYPES = ['Emitter','Transformation','Accumulation','Mutant','Tool','Composite','Outro']

const QUIRK_BONUSES = {
  'Emitter':        { attr:'Força',        bonus:'+10',  desc:'Emissores ganham poder de ataque bruto.',           color:'var(--red-l)' },
  'Transformation': { attr:'Resistência',  bonus:'+10',  desc:'Transformação fortalece o corpo.',                  color:'var(--gold)' },
  'Accumulation':   { attr:'Resistência',  bonus:'+15',  desc:'Acumulação gera durabilidade extrema.',             color:'var(--purple-l)' },
  'Mutant':         { attr:'Agilidade',    bonus:'+10',  desc:'Mutantes são naturalmente mais velozes.',           color:'var(--green-l)' },
  'Tool':           { attr:'Inteligência', bonus:'+10',  desc:'Ferramentas exigem precisão estratégica.',          color:'var(--blue-l)' },
  'Composite':      { attr:'Controle',     bonus:'+10',  desc:'Quirks compostos demandam alto controle.',          color:'var(--teal-l)' },
}

const EVOLUTION_THRESHOLDS = [
  { level:1,  label:'Despertar',  color:'var(--dim)',       desc:'Estado base do Quirk.' },
  { level:2,  label:'Controle',   color:'var(--blue-l)',    desc:'Domínio básico das habilidades.' },
  { level:3,  label:'Refinamento',color:'var(--green-l)',   desc:'Técnicas desbloqueadas automaticamente.' },
  { level:4,  label:'Maestria',   color:'var(--gold)',      desc:'O Quirk começa a evoluir além do previsto.' },
  { level:5,  label:'Awakening',  color:'var(--purple-l)',  desc:'Estado de Awakening atingido! Poderes latentes emergem.' },
]

export default function QuirkView({ onRefreshChar }) {
  const { user, character } = useAuth()
  const [showEdit,     setShowEdit]     = useState(false)
  const [showSkill,    setShowSkill]    = useState(false)
  const [editSkillIdx, setEditSkillIdx] = useState(null)
  const char = character
  const q    = char?.quirk_data || { name:'',type:'',subtype:'',level:1,range:'',weakness:'',dominio:0,carga:100,description:'',awakening:'',skills:[] }
  const quirkLevel = char?.quirk_level || 1
  const quirkXp    = char?.quirk_xp    || 0
  const bonus      = QUIRK_BONUSES[q.type]

  async function saveQ(newQ) {
    const { error } = await upsertCharacter(user.id, { ...char, quirk_data: newQ })
    if (error) { notify('❌ ' + error.message, 'error'); return false }
    await onRefreshChar(); return true
  }

  async function saveSkill(sk, idx) {
    const skills = [...(q.skills||[])]
    if (idx !== null) skills[idx] = sk; else skills.push(sk)
    return saveQ({ ...q, skills })
  }

  async function deleteSkill(idx) {
    const skills = (q.skills||[]).filter((_,i) => i !== idx)
    return saveQ({ ...q, skills })
  }

  if (!char) return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, color:'var(--muted)', padding:20 }}>
      <div style={{ fontSize:48 }}>✨</div>
      <div style={{ fontFamily:'Bangers,cursive', fontSize:18, letterSpacing:2, color:'var(--purple-l)' }}>CRIE SEU PERSONAGEM PRIMEIRO</div>
    </div>
  )

  const skills   = q.skills || []
  const unlocked = skills.filter(s => !s.locked)
  const locked   = skills.filter(s => s.locked)
  const currentEvo = EVOLUTION_THRESHOLDS.find(e => e.level === quirkLevel) || EVOLUTION_THRESHOLDS[0]

  return (
    <div style={{ flex:1, overflowY:'auto', padding:14 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, flexWrap:'wrap' }}>
        <div style={{ fontFamily:'Bangers,cursive', fontSize:20, letterSpacing:3, color:'var(--purple-l)' }}>QUIRK & HABILIDADES</div>
        <button className="btn btn-p btn-sm" onClick={() => setShowEdit(true)}>✏️ Editar Quirk</button>
        <button className="btn btn-purple btn-sm" onClick={() => { setEditSkillIdx(null); setShowSkill(true) }}>+ Técnica</button>
      </div>

      <div className="quirk-layout" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        {/* LEFT — Quirk Info */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {/* Main Quirk Card */}
          <div className="card card-purple">
            {q.name ? (
              <>
                <div style={{ fontFamily:'Bangers,cursive', fontSize:28, letterSpacing:2, color:'var(--purple-l)', marginBottom:2 }}>{q.name}</div>
                <div style={{ fontSize:8, letterSpacing:3, color:'var(--purple-l)', opacity:.6, textTransform:'uppercase', marginBottom:12 }}>
                  {q.type}{q.subtype ? ' · ' + q.subtype : ''}
                </div>

                {/* Bônus por tipo */}
                {bonus && (
                  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'rgba(0,0,0,.2)', borderRadius:6, border:`1px solid ${bonus.color}33`, marginBottom:12 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:9, color:bonus.color, fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:2 }}>✦ Bônus de Tipo — {q.type}</div>
                      <div style={{ fontSize:11, color:'var(--muted)' }}>{bonus.desc}</div>
                    </div>
                    <div style={{ textAlign:'center', flexShrink:0 }}>
                      <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:11, color:'var(--dim)' }}>{bonus.attr}</div>
                      <div style={{ fontFamily:'Bangers,cursive', fontSize:22, color:bonus.color, letterSpacing:1 }}>{bonus.bonus}</div>
                    </div>
                  </div>
                )}

                {/* Barras */}
                {[
                  { l:'CARGA',   v:q.carga||100,   c:'linear-gradient(90deg,var(--purple),var(--blue-l))',   vc:'var(--purple-l)' },
                  { l:'DOMÍNIO', v:q.dominio||0,   c:'linear-gradient(90deg,var(--gold-d),var(--gold))',     vc:'var(--gold)' },
                ].map(b => (
                  <div key={b.l} style={{ marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'var(--dim)', letterSpacing:1, marginBottom:3 }}>
                      <span>{b.l}</span><span style={{ color:b.vc }}>{b.v}%</span>
                    </div>
                    <div className="pbar" style={{ height:7, borderRadius:4 }}>
                      <div className="pbar-fill" style={{ width:`${b.v}%`, background:b.c, borderRadius:4 }} />
                    </div>
                  </div>
                ))}

                {/* Stats */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6, marginBottom:10 }}>
                  {[
                    {l:'Nível Quirk',  v:`Nv.${quirkLevel}`, c:'var(--gold)'},
                    {l:'Alcance',      v:q.range||'—',       c:'var(--blue-l)'},
                    {l:'Fraqueza',     v:q.weakness||'—',    c:'var(--red-l)'},
                    {l:'Fase',         v:currentEvo.label,   c:currentEvo.color},
                  ].map(s => (
                    <div key={s.l} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:5, padding:'6px 8px' }}>
                      <div style={{ fontSize:7, letterSpacing:1, color:'var(--dim)', textTransform:'uppercase', marginBottom:2 }}>{s.l}</div>
                      <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:12, color:s.c }}>{s.v}</div>
                    </div>
                  ))}
                </div>

                {q.description && <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.6, marginBottom:10 }}>{q.description}</div>}
                {q.awakening && (
                  <div style={{ background:'rgba(255,179,0,.06)', border:'1px solid rgba(255,179,0,.2)', borderRadius:5, padding:9 }}>
                    <div style={{ fontSize:9, color:'var(--gold)', fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:3 }}>⚡ Awakening</div>
                    <div style={{ fontSize:11, color:'var(--muted)' }}>{q.awakening}</div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign:'center', padding:20 }}>
                <div style={{ fontSize:36, marginBottom:8 }}>✨</div>
                <div style={{ fontFamily:'Bangers,cursive', fontSize:16, letterSpacing:1, color:'var(--purple-l)', marginBottom:8 }}>QUIRK NÃO CONFIGURADO</div>
                <button className="btn btn-purple btn-sm" onClick={() => setShowEdit(true)} style={{ color:'#fff' }}>Configurar Quirk</button>
              </div>
            )}
          </div>

          {/* Evolução */}
          <div className="card">
            <div className="card-title">🌟 Evolução do Quirk</div>
            <div style={{ fontSize:11, color:'var(--muted)', marginBottom:12 }}>O Quirk evolui automaticamente conforme seu personagem sobe de nível. A cada 2 level-ups do personagem, o Quirk sobe 1 nível.</div>
            {EVOLUTION_THRESHOLDS.map(evo => (
              <div key={evo.level} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8, opacity: quirkLevel >= evo.level ? 1 : 0.35 }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background: quirkLevel >= evo.level ? evo.color : 'var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Orbitron,monospace', fontSize:10, fontWeight:700, color: quirkLevel >= evo.level ? '#000' : 'var(--dim)', flexShrink:0 }}>
                  {evo.level}
                </div>
                <div>
                  <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:12, color: quirkLevel >= evo.level ? evo.color : 'var(--dim)' }}>
                    {evo.label}
                    {quirkLevel === evo.level && <span style={{ fontSize:8, color:'var(--gold)', marginLeft:6 }}>◄ ATUAL</span>}
                    {quirkLevel > evo.level && <span style={{ fontSize:8, color:'var(--green-l)', marginLeft:6 }}>✓</span>}
                  </div>
                  <div style={{ fontSize:10, color:'var(--dim)' }}>{evo.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — Skills */}
        <div>
          <div className="card">
            <div className="card-title">🌳 Técnicas & Habilidades</div>

            {skills.length === 0 && (
              <div style={{ textAlign:'center', padding:16, color:'var(--dim)', fontSize:11 }}>
                Clique em "+ Técnica" para adicionar habilidades ao seu Quirk.
              </div>
            )}

            {unlocked.length > 0 && (
              <>
                <div style={{ fontSize:9, color:'var(--green-l)', letterSpacing:2, textTransform:'uppercase', marginBottom:8 }}>✅ DESBLOQUEADAS</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
                  {unlocked.map((s, i) => (
                    <SkillNode key={i} s={s} idx={skills.indexOf(s)} onClick={idx => { setEditSkillIdx(idx); setShowSkill(true) }} />
                  ))}
                </div>
              </>
            )}

            {locked.length > 0 && (
              <>
                <div style={{ fontSize:9, color:'var(--dim)', letterSpacing:2, textTransform:'uppercase', marginBottom:8 }}>🔒 BLOQUEADAS</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, opacity:.45 }}>
                  {locked.map((s, i) => (
                    <SkillNode key={i} s={s} idx={skills.indexOf(s)} onClick={idx => { setEditSkillIdx(idx); setShowSkill(true) }} />
                  ))}
                </div>
              </>
            )}

            <div style={{ fontSize:9, color:'var(--dim)', marginTop:10 }}>Clique numa técnica para editar.</div>
          </div>
        </div>
      </div>

      {showEdit && (
        <QuirkEditModal q={q} onClose={() => setShowEdit(false)}
          onSave={async newQ => { const ok = await saveQ(newQ); if (ok) setShowEdit(false) }} />
      )}

      {showSkill && (
        <SkillEditModal
          skill={editSkillIdx !== null ? skills[editSkillIdx] : null}
          onClose={() => { setShowSkill(false); setEditSkillIdx(null) }}
          onSave={async sk => { const ok = await saveSkill(sk, editSkillIdx); if (ok) { setShowSkill(false); setEditSkillIdx(null) } }}
          onDelete={editSkillIdx !== null ? async () => { const ok = await deleteSkill(editSkillIdx); if (ok) { setShowSkill(false); setEditSkillIdx(null) } } : null}
        />
      )}
    </div>
  )
}

function SkillNode({ s, idx, onClick }) {
  return (
    <div onClick={() => onClick(idx)}
      style={{ background:'var(--panel)', border:`1px solid ${s.locked?'var(--border)':'rgba(124,58,237,.5)'}`, borderRadius:7, padding:10, cursor:'pointer', textAlign:'center', position:'relative', transition:'all .2s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--purple)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = s.locked ? 'var(--border)' : 'rgba(124,58,237,.5)'}>
      {!s.locked && <div style={{ position:'absolute', top:5, left:7, fontSize:9, color:'var(--green-l)', fontWeight:700 }}>✓</div>}
      <div style={{ fontSize:22, display:'block', marginBottom:4 }}>{s.icon||'⚡'}</div>
      <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:11, color:'var(--text)', marginBottom:2 }}>{s.name}</div>
      <div style={{ fontSize:9, color:'var(--muted)', lineHeight:1.3 }}>{s.type}</div>
      <div style={{ position:'absolute', top:5, right:7, fontFamily:'Orbitron,monospace', fontSize:8, color:'var(--gold)' }}>Nv.{s.level}</div>
    </div>
  )
}

function QuirkEditModal({ q, onClose, onSave }) {
  const [form, setForm] = useState({ name:q.name||'',type:q.type||'',subtype:q.subtype||'',level:q.level||1,range:q.range||'',weakness:q.weakness||'',dominio:q.dominio||0,carga:q.carga||100,description:q.description||'',awakening:q.awakening||'' })
  const [saving, setSaving] = useState(false)
  function set(k,v){setForm(f=>({...f,[k]:v}))}
  const bonus = QUIRK_BONUSES[form.type]

  async function handle() {
    if (!form.name.trim()) { notify('❌ Nome obrigatório','error'); return }
    setSaving(true)
    await onSave({ ...q, ...form, level:Number(form.level), dominio:Number(form.dominio), carga:Number(form.carga) })
    setSaving(false)
  }
  return (
    <Modal title="✨ Editar Quirk" onClose={onClose}>
      {bonus && (
        <div style={{ padding:'7px 10px', background:`${bonus.color}11`, border:`1px solid ${bonus.color}33`, borderRadius:6, marginBottom:12, fontSize:11, color:bonus.color }}>
          ✦ Bônus de tipo <strong>{form.type}</strong>: {bonus.attr} {bonus.bonus} — {bonus.desc}
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div className="field"><label>Nome do Quirk *</label><input className="input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Ex: Shadow Weave" /></div>
        <div className="field"><label>Tipo</label>
          <select className="input" value={form.type} onChange={e=>set('type',e.target.value)}>
            <option value="">— Selecionar —</option>
            {QUIRK_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="field"><label>Subtipo</label><input className="input" value={form.subtype} onChange={e=>set('subtype',e.target.value)} placeholder="Ex: Manipulação de Sombras" /></div>
        <div className="field"><label>Alcance</label><input className="input" value={form.range} onChange={e=>set('range',e.target.value)} placeholder="Ex: 15m" /></div>
        <div className="field"><label>Fraqueza</label><input className="input" value={form.weakness} onChange={e=>set('weakness',e.target.value)} placeholder="Ex: Luz intensa" /></div>
        <div className="field"><label>% Domínio (0–100)</label><input className="input" type="number" min={0} max={100} value={form.dominio} onChange={e=>set('dominio',e.target.value)} /></div>
        <div className="field"><label>% Carga Atual (0–100)</label><input className="input" type="number" min={0} max={100} value={form.carga} onChange={e=>set('carga',e.target.value)} /></div>
      </div>
      <div className="field"><label>Descrição</label><textarea className="input" rows={3} value={form.description} onChange={e=>set('description',e.target.value)} /></div>
      <div className="field"><label>Awakening (vazio se não tiver)</label><textarea className="input" rows={2} value={form.awakening} onChange={e=>set('awakening',e.target.value)} /></div>
      <div style={{ display:'flex', gap:6 }}>
        <button className="btn btn-p btn-lg" onClick={handle} disabled={saving} style={{ flex:1 }}>{saving?'⏳...':'💾 Salvar'}</button>
        <button className="btn btn-g" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  )
}

function SkillEditModal({ skill, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({ name:skill?.name||'',icon:skill?.icon||'⚡',type:skill?.type||'',cost:skill?.cost||'',level:skill?.level||1,locked:skill?.locked||false,desc:skill?.desc||'' })
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
        <div className="field"><label>Ícone (emoji)</label><input className="input" value={form.icon} onChange={e=>set('icon',e.target.value)} /></div>
        <div className="field"><label>Tipo</label><input className="input" value={form.type} onChange={e=>set('type',e.target.value)} placeholder="Ataque / Defesa / Captura..." /></div>
        <div className="field"><label>Custo / Dano</label><input className="input" value={form.cost} onChange={e=>set('cost',e.target.value)} placeholder="2d6+4 · 10% Quirk" /></div>
        <div className="field"><label>Nível mínimo</label><input className="input" type="number" min={1} value={form.level} onChange={e=>set('level',e.target.value)} /></div>
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
        {onDelete && <button className="btn btn-danger" onClick={async()=>{if(!confirm('Remover?'))return;setSaving(true);await onDelete();setSaving(false)}}>🗑️</button>}
        <button className="btn btn-g" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  )
}
