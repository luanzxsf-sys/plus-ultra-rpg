import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { upsertCharacter } from '../../lib/supabase'
import { notify } from '../../components/Toast'
import Modal from '../../components/Modal'
import {
  QUIRK_TYPE_BONUSES, quirkRankName, ATTR_META,
  calcTechDmg, calcTechQuirkCost, techIsAvailable
} from '../../lib/gameSystem'

const QUIRK_TYPES = ['Emitter','Transformation','Accumulation','Mutant','Tool','Composite','Outro']

const EVOLUTION_THRESHOLDS = [
  { level:1, label:'Iniciante',     color:'var(--dim)',       desc:'Estado base do Quirk. Técnicas de nível 1 disponíveis.' },
  { level:2, label:'Intermediário', color:'var(--blue-l)',    desc:'Controle aprimorado. Técnicas de nível 2 desbloqueadas.' },
  { level:3, label:'Avançado',      color:'var(--green-l)',   desc:'Técnicas de nível 3 desbloqueadas. Domínio cresce.' },
  { level:4, label:'Mestre',        color:'var(--gold)',      desc:'Técnicas de nível 4 desbloqueadas. Poder latente emerge.' },
  { level:5, label:'Despertado',    color:'var(--purple-l)',  desc:'⚡ Awakening atingido! Todas as técnicas desbloqueadas.' },
]

// Tipos de técnica por nível do Quirk (a partir do nível 2 pode ter 2 tipos, 4 pode ter 3)
function maxTechTypes(quirk_level) {
  if (quirk_level >= 4) return 3
  if (quirk_level >= 2) return 2
  return 1
}

export default function QuirkView({ onRefreshChar }) {
  const { user, character } = useAuth()
  const [showEdit,     setShowEdit]     = useState(false)
  const [showSkill,    setShowSkill]    = useState(false)
  const [editSkillIdx, setEditSkillIdx] = useState(null)
  const char = character
  const q    = char?.quirk_data || { name:'',type:'',subtype:'',level:1,range:'',weakness:'',dominio:0,carga:100,description:'',awakening:'',skills:[] }
  const quirkLevel = char?.quirk_level || 1
  const quirkXp    = char?.quirk_xp    || 0
  const bonus      = QUIRK_TYPE_BONUSES[q.type]
  const attrs      = char?.attrs || {}
  const skills     = q.skills || []

  async function saveQ(newQ) {
    const { error } = await upsertCharacter(user.id, { ...char, quirk_data: newQ })
    if (error) { notify('❌ ' + error.message, 'error'); return false }
    await onRefreshChar(); return true
  }

  async function saveSkill(sk, idx) {
    const newSkills = [...skills]
    if (idx !== null) newSkills[idx] = sk; else newSkills.push(sk)
    return saveQ({ ...q, skills: newSkills })
  }

  async function deleteSkill(idx) {
    return saveQ({ ...q, skills: skills.filter((_,i) => i !== idx) })
  }

  if (!char?.name) return (
    <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12,color:'var(--muted)',padding:20 }}>
      <div style={{ fontSize:48 }}>✨</div>
      <div style={{ fontFamily:'Bangers,cursive',fontSize:18,letterSpacing:2,color:'var(--purple-l)' }}>CRIE SEU PERSONAGEM PRIMEIRO</div>
    </div>
  )

  const currentEvo = [...EVOLUTION_THRESHOLDS].reverse().find(e => quirkLevel >= e.level) || EVOLUTION_THRESHOLDS[0]
  const nextEvo    = EVOLUTION_THRESHOLDS.find(e => e.level > quirkLevel)
  const available  = skills.filter(s => techIsAvailable(s, quirkLevel))
  const locked     = skills.filter(s => !techIsAvailable(s, quirkLevel))

  return (
    <div style={{ flex:1,overflowY:'auto',padding:14 }}>
      <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:12,flexWrap:'wrap' }}>
        <div style={{ fontFamily:'Bangers,cursive',fontSize:20,letterSpacing:3,color:'var(--purple-l)' }}>QUIRK &amp; HABILIDADES</div>
        <button className="btn btn-p btn-sm" onClick={()=>setShowEdit(true)}>✏️ Editar Quirk</button>
        <button className="btn btn-purple btn-sm" onClick={()=>{setEditSkillIdx(null);setShowSkill(true)}} style={{ color:'#fff' }}>+ Técnica</button>
      </div>

      <div className="quirk-layout" style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
        {/* LEFT */}
        <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
          <div className="card card-purple">
            {q.name ? (
              <>
                <div style={{ fontFamily:'Bangers,cursive',fontSize:28,letterSpacing:2,color:'var(--purple-l)' }}>{q.name}</div>
                <div style={{ display:'flex',gap:6,alignItems:'center',marginBottom:10 }}>
                  <span style={{ fontSize:9,fontFamily:'Orbitron,monospace',color:'var(--gold)',fontWeight:700 }}>{quirkRankName(quirkLevel)}</span>
                  {q.type&&<span className="tag" style={{ background:'rgba(155,89,182,.2)',color:'var(--purple-l)',border:'1px solid rgba(155,89,182,.3)' }}>{q.type}</span>}
                  {q.subtype&&<span style={{ fontSize:9,color:'var(--dim)' }}>{q.subtype}</span>}
                </div>

                {bonus&&bonus.attr&&(
                  <div style={{ display:'flex',alignItems:'center',gap:8,padding:'8px 10px',background:`${bonus.color}11`,borderRadius:6,border:`1px solid ${bonus.color}33`,marginBottom:12 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:9,color:bonus.color,fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginBottom:2 }}>✦ Bônus de Tipo — {q.type}</div>
                      <div style={{ fontSize:10,color:'var(--muted)' }}>{bonus.desc}</div>
                    </div>
                    <div style={{ textAlign:'center',flexShrink:0 }}>
                      <div style={{ fontSize:8,color:'var(--dim)',textTransform:'uppercase' }}>{ATTR_META[bonus.attr]?.label}</div>
                      <div style={{ fontFamily:'Bangers,cursive',fontSize:20,color:bonus.color,letterSpacing:1 }}>{bonus.bonus > 0 ? `+${bonus.bonus}` : bonus.label}</div>
                    </div>
                  </div>
                )}

                {[
                  { l:'CARGA',   v:q.carga||100,   c:'linear-gradient(90deg,var(--purple),var(--blue-l))', vc:'var(--purple-l)' },
                  { l:'DOMÍNIO', v:q.dominio||0,   c:'linear-gradient(90deg,var(--gold-d),var(--gold))',   vc:'var(--gold)' },
                ].map(b=>(
                  <div key={b.l} style={{ marginBottom:10 }}>
                    <div style={{ display:'flex',justifyContent:'space-between',fontSize:9,color:'var(--dim)',letterSpacing:1,marginBottom:3 }}><span>{b.l}</span><span style={{ color:b.vc }}>{b.v}%</span></div>
                    <div className="pbar" style={{ height:7,borderRadius:4 }}><div className="pbar-fill" style={{ width:`${b.v}%`,background:b.c,borderRadius:4 }}/></div>
                  </div>
                ))}

                <div style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:6,marginBottom:10 }}>
                  {[
                    {l:'Fase',     v:currentEvo.label, c:currentEvo.color},
                    {l:'Alcance',  v:q.range||(attrs.controle?(attrs.controle*0.5).toFixed(1)+'m extras':'—'), c:'var(--blue-l)'},
                    {l:'Fraqueza', v:q.weakness||'—', c:'var(--red-l)'},
                    {l:'Técnicas', v:`${available.length} ativas / ${locked.length} bloq.`, c:'var(--muted)'},
                  ].map(s=>(
                    <div key={s.l} style={{ background:'var(--card)',border:'1px solid var(--border)',borderRadius:5,padding:'6px 8px' }}>
                      <div style={{ fontSize:7,letterSpacing:1,color:'var(--dim)',textTransform:'uppercase',marginBottom:2 }}>{s.l}</div>
                      <div style={{ fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:11,color:s.c }}>{s.v}</div>
                    </div>
                  ))}
                </div>

                {q.description&&<div style={{ fontSize:11,color:'var(--muted)',lineHeight:1.6,marginBottom:10 }}>{q.description}</div>}
                {q.awakening&&(
                  <div style={{ background:'rgba(255,179,0,.06)',border:'1px solid rgba(255,179,0,.2)',borderRadius:5,padding:9 }}>
                    <div style={{ fontSize:9,color:'var(--gold)',fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginBottom:3 }}>⚡ Awakening</div>
                    <div style={{ fontSize:11,color:'var(--muted)' }}>{q.awakening}</div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign:'center',padding:20 }}>
                <div style={{ fontSize:36,marginBottom:8 }}>✨</div>
                <div style={{ fontFamily:'Bangers,cursive',fontSize:16,letterSpacing:1,color:'var(--purple-l)',marginBottom:8 }}>QUIRK NÃO CONFIGURADO</div>
                <button className="btn btn-purple btn-sm" onClick={()=>setShowEdit(true)} style={{ color:'#fff' }}>Configurar Quirk</button>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">🌟 Linha de Evolução</div>
            <div style={{ fontSize:11,color:'var(--muted)',marginBottom:12 }}>
              O Quirk evolui a cada 2 level-ups do personagem. Cada fase desbloqueia técnicas de nível maior.
            </div>
            {EVOLUTION_THRESHOLDS.map(evo=>(
              <div key={evo.level} style={{ display:'flex',alignItems:'center',gap:10,marginBottom:8,opacity:quirkLevel>=evo.level?1:0.3 }}>
                <div style={{ width:30,height:30,borderRadius:'50%',background:quirkLevel>=evo.level?evo.color:'var(--border)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Orbitron,monospace',fontSize:10,fontWeight:700,color:quirkLevel>=evo.level?'#000':'var(--dim)',flexShrink:0 }}>{evo.level}</div>
                <div>
                  <div style={{ fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:12,color:quirkLevel>=evo.level?evo.color:'var(--dim)' }}>
                    {evo.label}
                    {quirkLevel===evo.level&&<span style={{ fontSize:8,color:'var(--gold)',marginLeft:6 }}>◄ ATUAL</span>}
                    {quirkLevel>evo.level&&<span style={{ fontSize:8,color:'var(--green-l)',marginLeft:6 }}>✓</span>}
                  </div>
                  <div style={{ fontSize:10,color:'var(--dim)' }}>{evo.desc}</div>
                </div>
              </div>
            ))}
            {nextEvo&&(
              <div style={{ marginTop:8,padding:'6px 8px',background:'rgba(255,179,0,.06)',borderRadius:5,border:'1px solid rgba(255,179,0,.15)',fontSize:10,color:'var(--gold)' }}>
                Próxima fase: <strong>{nextEvo.label}</strong> (nível {nextEvo.level})
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Técnicas */}
        <div>
          <div className="card">
            <div className="card-title" style={{ color:'var(--purple-l)' }}>
              🌳 Técnicas
              <span style={{ fontSize:9,color:'var(--dim)',fontFamily:'Orbitron,monospace',fontWeight:400 }}>Nv.Quirk {quirkLevel} · máx {maxTechTypes(quirkLevel)} tipo{maxTechTypes(quirkLevel)>1?'s':''}/técnica</span>
            </div>

            {skills.length===0&&(
              <div style={{ textAlign:'center',padding:16,color:'var(--dim)',fontSize:11 }}>
                Clique em "+ Técnica" para adicionar habilidades ao seu Quirk.
              </div>
            )}

            {available.length>0&&(
              <>
                <div style={{ fontSize:9,color:'var(--green-l)',letterSpacing:2,textTransform:'uppercase',marginBottom:8,fontWeight:700 }}>✅ DISPONÍVEIS</div>
                <div style={{ display:'flex',flexDirection:'column',gap:8,marginBottom:14 }}>
                  {available.map((s,_)=>{
                    const idx=skills.indexOf(s)
                    const estDmg = calcTechDmg(s, attrs, q.type, quirkLevel)
                    const qCost  = calcTechQuirkCost(s, char?.quirk_max||100)
                    return <SkillCard key={idx} s={s} idx={idx} estDmg={estDmg} qCost={qCost} quirkLevel={quirkLevel} onClick={()=>{setEditSkillIdx(idx);setShowSkill(true)}}/>
                  })}
                </div>
              </>
            )}

            {locked.length>0&&(
              <>
                <div style={{ fontSize:9,color:'var(--dim)',letterSpacing:2,textTransform:'uppercase',marginBottom:8,fontWeight:700 }}>🔒 BLOQUEADAS (requer nível maior)</div>
                <div style={{ display:'flex',flexDirection:'column',gap:8,opacity:.4 }}>
                  {locked.map((s,_)=>{
                    const idx=skills.indexOf(s)
                    return <SkillCard key={idx} s={s} idx={idx} estDmg={0} qCost={0} quirkLevel={quirkLevel} onClick={()=>{setEditSkillIdx(idx);setShowSkill(true)}}/>
                  })}
                </div>
              </>
            )}

            <div style={{ fontSize:9,color:'var(--dim)',marginTop:10 }}>Clique numa técnica para editar. Técnicas bloqueadas requerem que o Quirk atinja o nível da técnica.</div>
          </div>
        </div>
      </div>

      {showEdit&&(
        <QuirkEditModal q={q} onClose={()=>setShowEdit(false)}
          onSave={async newQ=>{const ok=await saveQ(newQ);if(ok)setShowEdit(false)}}/>
      )}
      {showSkill&&(
        <SkillEditModal
          skill={editSkillIdx!==null?skills[editSkillIdx]:null}
          quirkLevel={quirkLevel}
          quirkType={q.type}
          attrs={attrs}
          quirkMax={char?.quirk_max||100}
          onClose={()=>{setShowSkill(false);setEditSkillIdx(null)}}
          onSave={async sk=>{const ok=await saveSkill(sk,editSkillIdx);if(ok){setShowSkill(false);setEditSkillIdx(null)}}}
          onDelete={editSkillIdx!==null?async()=>{const ok=await deleteSkill(editSkillIdx);if(ok){setShowSkill(false);setEditSkillIdx(null)}}:null}
        />
      )}
    </div>
  )
}

function SkillCard({ s, idx, estDmg, qCost, quirkLevel, onClick }) {
  const available = techIsAvailable(s, quirkLevel)
  const types = [s.type, s.type2, s.type3].filter(Boolean)
  return (
    <div onClick={onClick} style={{ background:'var(--panel)',border:`1px solid ${available?'rgba(155,89,182,.4)':'var(--border)'}`,borderRadius:7,padding:'10px 12px',cursor:'pointer',transition:'all .2s',position:'relative' }}
      onMouseEnter={e=>e.currentTarget.style.borderColor='var(--purple)'}
      onMouseLeave={e=>e.currentTarget.style.borderColor=available?'rgba(155,89,182,.4)':'var(--border)'}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4 }}>
        <div style={{ display:'flex',alignItems:'center',gap:6 }}>
          <span style={{ fontSize:18 }}>{s.icon||'⚡'}</span>
          <div>
            <div style={{ fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:13,color:'var(--text-h)' }}>{s.name}</div>
            <div style={{ display:'flex',gap:4,marginTop:2 }}>
              {types.map((t,i)=>(
                <span key={i} className="tag" style={{ background:'rgba(155,89,182,.15)',color:'var(--purple-l)',border:'1px solid rgba(155,89,182,.25)',fontSize:7 }}>{t}</span>
              ))}
            </div>
          </div>
        </div>
        <div style={{ textAlign:'right',flexShrink:0 }}>
          <div style={{ fontFamily:'Orbitron,monospace',fontSize:9,color:'var(--gold)',fontWeight:700 }}>Nv.{s.level}</div>
          {!available&&<div style={{ fontSize:8,color:'var(--red-l)' }}>bloq. (req.{s.level})</div>}
        </div>
      </div>
      {s.desc&&<div style={{ fontSize:10,color:'var(--muted)',lineHeight:1.4,marginBottom:6 }}>{s.desc}</div>}
      {available&&(
        <div style={{ display:'flex',gap:8,marginTop:4 }}>
          {estDmg>0&&<div style={{ fontSize:9,color:'var(--red-l)',fontFamily:'Orbitron,monospace',fontWeight:700 }}>⚔️ ~{estDmg} dmg</div>}
          {qCost>0&&<div style={{ fontSize:9,color:'var(--purple-l)',fontFamily:'Orbitron,monospace' }}>💜 {qCost} quirk</div>}
          {s.cost&&<div style={{ fontSize:9,color:'var(--dim)' }}>{s.cost}</div>}
        </div>
      )}
    </div>
  )
}

function QuirkEditModal({ q, onClose, onSave }) {
  const [form,setForm]=useState({name:q.name||'',type:q.type||'',subtype:q.subtype||'',range:q.range||'',weakness:q.weakness||'',dominio:q.dominio||0,carga:q.carga||100,description:q.description||'',awakening:q.awakening||''})
  const [saving,setSaving]=useState(false)
  function set(k,v){setForm(f=>({...f,[k]:v}))}
  const bonus=QUIRK_TYPE_BONUSES[form.type]
  async function handle(){
    if(!form.name.trim()){notify('❌ Nome obrigatório','error');return}
    setSaving(true); await onSave({...q,...form,dominio:Number(form.dominio),carga:Number(form.carga)}); setSaving(false)
  }
  return (
    <Modal title="✨ Editar Quirk" onClose={onClose}>
      {bonus&&bonus.attr&&(
        <div style={{ padding:'7px 10px',background:`${bonus.color}11`,border:`1px solid ${bonus.color}33`,borderRadius:6,marginBottom:12,fontSize:11,color:bonus.color }}>
          ✦ Bônus <strong>{form.type}</strong>: {bonus.label} — {bonus.desc}
        </div>
      )}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
        <div className="field"><label>Nome *</label><input className="input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Ex: Shadow Weave"/></div>
        <div className="field"><label>Tipo</label>
          <select className="input" value={form.type} onChange={e=>set('type',e.target.value)}>
            <option value="">— Selecionar —</option>
            {QUIRK_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="field"><label>Subtipo</label><input className="input" value={form.subtype} onChange={e=>set('subtype',e.target.value)} placeholder="Ex: Manipulação de Sombras"/></div>
        <div className="field"><label>Alcance base</label><input className="input" value={form.range} onChange={e=>set('range',e.target.value)} placeholder="Ex: 10m (+ bônus Controle)"/></div>
        <div className="field"><label>Fraqueza</label><input className="input" value={form.weakness} onChange={e=>set('weakness',e.target.value)} placeholder="Ex: Luz intensa"/></div>
        <div className="field"><label>% Domínio (0–100)</label><input className="input" type="number" min={0} max={100} value={form.dominio} onChange={e=>set('dominio',e.target.value)}/></div>
        <div className="field" style={{ gridColumn:'1/-1' }}><label>% Carga Atual (0–100)</label><input className="input" type="number" min={0} max={100} value={form.carga} onChange={e=>set('carga',e.target.value)}/></div>
      </div>
      <div className="field"><label>Descrição</label><textarea className="input" rows={3} value={form.description} onChange={e=>set('description',e.target.value)}/></div>
      <div className="field"><label>Awakening (vazio se não tiver)</label><textarea className="input" rows={2} value={form.awakening} onChange={e=>set('awakening',e.target.value)}/></div>
      <div style={{ display:'flex',gap:6 }}>
        <button className="btn btn-p btn-lg" onClick={handle} disabled={saving} style={{ flex:1 }}>{saving?'⏳...':'💾 Salvar'}</button>
        <button className="btn btn-g" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  )
}

function SkillEditModal({ skill, quirkLevel, quirkType, attrs, quirkMax, onClose, onSave, onDelete }) {
  const maxTypes = maxTechTypes(quirkLevel)
  const [form,setForm]=useState({
    name:skill?.name||'', icon:skill?.icon||'⚡',
    type:skill?.type||'', type2:skill?.type2||'', type3:skill?.type3||'',
    level:skill?.level||1, desc:skill?.desc||'', cost:skill?.cost||''
  })
  const [saving,setSaving]=useState(false)
  function set(k,v){setForm(f=>({...f,[k]:v}))}

  const techLevel = Number(form.level)||1
  const estDmg    = calcTechDmg({...form,level:techLevel}, attrs, quirkType, quirkLevel)
  const qCost     = calcTechQuirkCost({...form,level:techLevel}, quirkMax)
  const isAvail   = techIsAvailable({...form,level:techLevel}, quirkLevel)

  async function handle(){
    if(!form.name.trim()){notify('❌ Nome obrigatório','error');return}
    if(techLevel>quirkLevel){notify(`⚠️ Quirk nível ${quirkLevel} — técnica nível ${techLevel} só ficará disponível quando o Quirk evoluir.`)}
    setSaving(true); await onSave({...form,level:techLevel}); setSaving(false)
  }

  const TECH_TYPES=['Ataque','Defesa','Captura','Cura','Controle','Especial','Área','Mobilidade']

  return (
    <Modal title={skill?'✏️ Editar Técnica':'+ Nova Técnica'} onClose={onClose}>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
        <div className="field"><label>Nome *</label><input className="input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Ex: Shadow Net"/></div>
        <div className="field"><label>Ícone (emoji)</label><input className="input" value={form.icon} onChange={e=>set('icon',e.target.value)}/></div>
        <div className="field"><label>Nível mínimo do Quirk</label>
          <select className="input" value={form.level} onChange={e=>set('level',Number(e.target.value))}>
            {[1,2,3,4,5].map(l=><option key={l} value={l}>Nv.{l} — {['Iniciante','Intermediário','Avançado','Mestre','Despertado'][l-1]}</option>)}
          </select>
          {!isAvail&&<div style={{ fontSize:9,color:'var(--gold)',marginTop:3 }}>⚠️ Ficará bloqueada até Quirk Nv.{techLevel}</div>}
        </div>
        <div className="field"><label>Tipo Principal</label>
          <select className="input" value={form.type} onChange={e=>set('type',e.target.value)}>
            <option value="">— Selecionar —</option>
            {TECH_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {maxTypes>=2&&(
          <div className="field"><label>2º Tipo {maxTypes>=2?'(Quirk Nv.2+)':''}</label>
            <select className="input" value={form.type2} onChange={e=>set('type2',e.target.value)}>
              <option value="">— Nenhum —</option>
              {TECH_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}
        {maxTypes>=3&&(
          <div className="field"><label>3º Tipo (Quirk Nv.4+)</label>
            <select className="input" value={form.type3} onChange={e=>set('type3',e.target.value)}>
              <option value="">— Nenhum —</option>
              {TECH_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Preview de dano/custo */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12,padding:'8px 10px',background:'var(--panel)',borderRadius:6,border:'1px solid var(--border)' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:8,color:'var(--dim)',textTransform:'uppercase',letterSpacing:1,marginBottom:3 }}>Dano Estimado</div>
          <div style={{ fontFamily:'Orbitron,monospace',fontSize:16,fontWeight:700,color:'var(--red-l)' }}>~{estDmg}</div>
          <div style={{ fontSize:8,color:'var(--dim)',marginTop:2 }}>baseado em Força + Nv.Quirk</div>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:8,color:'var(--dim)',textTransform:'uppercase',letterSpacing:1,marginBottom:3 }}>Custo Quirk</div>
          <div style={{ fontFamily:'Orbitron,monospace',fontSize:16,fontWeight:700,color:'var(--purple-l)' }}>{qCost}</div>
          <div style={{ fontSize:8,color:'var(--dim)',marginTop:2 }}>8% Quirk Máx × nível</div>
        </div>
      </div>

      <div className="field"><label>Descrição / Efeito Narrativo</label><textarea className="input" rows={2} value={form.desc} onChange={e=>set('desc',e.target.value)} placeholder="Descreva como a técnica funciona..."/></div>
      <div className="field"><label>Custo / Dano customizado (opcional, sobrescreve cálculo)</label><input className="input" value={form.cost} onChange={e=>set('cost',e.target.value)} placeholder="Ex: 3d8+12 · 15% Quirk"/></div>

      <div style={{ display:'flex',gap:6 }}>
        <button className="btn btn-p btn-lg" onClick={handle} disabled={saving} style={{ flex:1 }}>{saving?'⏳...':'💾 Salvar'}</button>
        {onDelete&&<button className="btn btn-danger" onClick={async()=>{if(!confirm('Remover técnica?'))return;setSaving(true);await onDelete();setSaving(false)}}>🗑️ Excluir</button>}
        <button className="btn btn-g" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  )
}
