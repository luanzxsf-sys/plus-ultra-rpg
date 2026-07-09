import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getNpcs, upsertNpc, deleteNpc, uploadToBucket } from '../../lib/supabase'
import { notify } from '../../components/Toast'
import Modal from '../../components/Modal'
import Avatar, { avatarBg } from '../../components/Avatar'
import AttrBuilder from '../../components/AttrBuilder'
import { calcDerived, calcNpcPointsForLevel, ATTR_KEYS, ATTR_META, gradeLabel, gradeColor, QUIRK_TYPE_BONUSES } from '../../lib/gameSystem'

const COLORS=[
  {key:'gray',bg:'linear-gradient(135deg,#374151,#1f2937)'},{key:'red',bg:'linear-gradient(135deg,#dc2626,#991b1b)'},
  {key:'blue',bg:'linear-gradient(135deg,#2563eb,#1d4ed8)'},{key:'green',bg:'linear-gradient(135deg,#16a34a,#15803d)'},
  {key:'purple',bg:'linear-gradient(135deg,#7c3aed,#5b21b6)'},{key:'gold',bg:'linear-gradient(135deg,#d97706,#b45309)'},
  {key:'pink',bg:'linear-gradient(135deg,#db2777,#be185d)'},{key:'teal',bg:'linear-gradient(135deg,#0891b2,#0e7490)'},
]
const ROLE_STYLE={
  npc:     {bg:'rgba(88,101,242,.15)',  c:'var(--blue-l)',   label:'NPC'},
  villain: {bg:'rgba(237,66,69,.15)',   c:'var(--red-l)',    label:'Vilão'},
  hero_npc:{bg:'rgba(59,165,93,.15)',   c:'var(--green-l)',  label:'Herói'},
  neutral: {bg:'rgba(255,179,0,.15)',   c:'var(--gold)',     label:'Neutro'},
}
const POINTS_PER_LEVEL = 8
const BASE_POINTS      = 42


function calcNpcPoints(level){ return BASE_POINTS + (Math.max(1,level)-1)*POINTS_PER_LEVEL }

function NpcModal({ npc, onClose, onSaved }) {
  const {user} = useAuth()
  const defaultAttrs={forca:6,agilidade:6,controle:6,resistencia:6,inteligencia:6,carisma:6,stamina:6}
  const [form,setForm]=useState({
    name:npc?.name||'', alias:npc?.alias||'', description:npc?.description||'',
    role:npc?.role||'npc', quirk_name:npc?.quirk_name||'', quirk_type:npc?.quirk_type||'',
    avatar_color:npc?.avatar_color||'gray', level:npc?.level||1,
    attrs:npc?.attrs||defaultAttrs,
  })
  const [imgFile,setImgFile]=useState(null)
  const [preview,setPreview]=useState(npc?.avatar_url||null)
  const [saving,setSaving]=useState(false)
  const [tab,setTab]=useState('info')

  function set(k,v){setForm(f=>({...f,[k]:v}))}

  // Quando muda o nível, recalcula pontos disponíveis e reseta attrs
  function handleLevelChange(newLevel) {
    const lv = Math.max(1, Math.min(100, Number(newLevel) || 1))
    // Single atomic update to avoid race condition
    setForm(f => ({
      ...f,
      level: lv,
      attrs: { forca:1, agilidade:1, controle:1, resistencia:1, inteligencia:1, carisma:1, stamina:1 }
    }))
  }

  const totalPoints = calcNpcPoints(form.level)
  function handleImg(e){
    const file=e.target.files[0];if(!file)return
    if(file.size>3*1024*1024){notify('❌ Máx 3MB','error');return}
    setImgFile(file);setPreview(URL.createObjectURL(file))
  }

  async function handleSave(){
    if(!form.name.trim()){notify('❌ Nome obrigatório','error');return}
    setSaving(true)
    let avatar_url=npc?.avatar_url||null
    if(imgFile){const{url,error}=await uploadToBucket('npcs',user.id,imgFile);if(error)notify('⚠️ Erro upload','error');else avatar_url=url}
    const derived=calcDerived(form.attrs,form.quirk_type||'')
    const payload={...form,avatar_url,created_by:user.id,
      hp_max:derived.hpMax,quirk_max:derived.quirkMax,stamina_max:derived.staminaMax}
    if(npc?.id) payload.id=npc.id
    const{error}=await upsertNpc(payload)
    setSaving(false)
    if(error){notify('❌ '+error.message,'error');return}
    notify('✅ NPC salvo!','success'); onSaved()
  }

  const rs=ROLE_STYLE[form.role]||ROLE_STYLE.npc
  const derived=calcDerived(form.attrs,form.quirk_type||'')
  const qBonus=QUIRK_TYPE_BONUSES[form.quirk_type]

  return (
    <Modal title={npc?'✏️ Editar NPC':'+ Novo NPC'} onClose={onClose} maxWidth={620}>
      {/* Preview */}
      <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16,padding:'12px 14px',background:'var(--panel)',borderRadius:8,border:'1px solid var(--border)'}}>
        <div style={{position:'relative'}}>
          <div style={{width:64,height:64,borderRadius:'50%',background:avatarBg(form.avatar_color),display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Bangers,cursive',fontSize:26,color:'#fff',overflow:'hidden',border:`2px solid ${rs.c}`}}>
            {preview?<img src={preview} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:(form.name[0]||'?').toUpperCase()}
          </div>
          <label style={{position:'absolute',bottom:-2,right:-2,width:22,height:22,borderRadius:'50%',background:'var(--blue)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:11}}>
            📷<input type="file" accept="image/*" style={{display:'none'}} onChange={handleImg}/>
          </label>
        </div>
        <div>
          <div style={{fontFamily:'Bangers,cursive',fontSize:20,letterSpacing:1,color:'var(--text-h)'}}>{form.name||'—'}</div>
          {form.alias&&<div style={{fontSize:10,color:'var(--gold)',letterSpacing:1}}>"{form.alias}"</div>}
          <div style={{display:'flex',gap:6,marginTop:4,alignItems:'center'}}>
            <span style={{fontSize:8,fontWeight:700,padding:'2px 6px',borderRadius:3,background:rs.bg,color:rs.c,textTransform:'uppercase'}}>{rs.label}</span>
            <span style={{fontSize:9,color:'var(--dim)',fontFamily:'Orbitron,monospace'}}>Nv.{form.level}</span>
            <span style={{fontSize:9,color:'var(--muted)'}}>{totalPoints}pts disponíveis</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',borderBottom:'1px solid var(--border)',marginBottom:14}}>
        {[{k:'info',l:'📋 Info'},{k:'attrs',l:'⚡ Atributos'},{k:'quirk',l:'✨ Quirk'}].map(t=>(
          <div key={t.k} onClick={()=>setTab(t.k)} style={{padding:'8px 16px',cursor:'pointer',fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:11,letterSpacing:1,textTransform:'uppercase',color:tab===t.k?'var(--blue-l)':'var(--muted)',borderBottom:`2px solid ${tab===t.k?'var(--blue)':'transparent'}`}}>{t.l}</div>
        ))}
      </div>

      {tab==='info'&&(
        <>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <div className="field"><label>Nome *</label><input className="input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Ex: All For One"/></div>
            <div className="field"><label>Alias / Título</label><input className="input" value={form.alias} onChange={e=>set('alias',e.target.value)} placeholder='"O Grande Mal"'/></div>
            <div className="field"><label>Tipo / Papel</label>
              <select className="input" value={form.role} onChange={e=>set('role',e.target.value)}>
                <option value="npc">NPC</option><option value="villain">Vilão</option>
                <option value="hero_npc">Herói (NPC)</option><option value="neutral">Neutro</option>
              </select>
            </div>
            <div className="field"><label>Nível</label>
              <input className="input" type="number" min={1} max={100} value={form.level}
                onChange={e=>handleLevelChange(e.target.value)}/>
              <div style={{fontSize:9,color:'var(--dim)',marginTop:3}}>Pontos disponíveis: <strong style={{color:'var(--gold)'}}>{totalPoints}</strong> (+{POINTS_PER_LEVEL}/nível)</div>
            </div>
          </div>
          <div className="field">
            <label>Cor do Avatar</label>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:4}}>
              {COLORS.map(c=><div key={c.key} onClick={()=>set('avatar_color',c.key)} style={{width:26,height:26,borderRadius:'50%',background:c.bg,cursor:'pointer',border:`2px solid ${form.avatar_color===c.key?'#fff':'transparent'}`,transition:'border .15s'}}/>)}
            </div>
          </div>
          <div className="field"><label>Descrição / Lore</label><textarea className="input" rows={3} value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Background, motivações, personalidade..."/></div>
        </>
      )}

      {tab==='attrs'&&(
        <div>
          <AttrBuilder
            attrs={form.attrs}
            onChange={newAttrs => setForm(f => ({...f, attrs: newAttrs}))}
            quirk_type={form.quirk_type||''}
            totalPoints={totalPoints}
          />
        </div>
      )}

      {tab==='quirk'&&(
        <div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <div className="field"><label>Nome do Quirk</label><input className="input" value={form.quirk_name} onChange={e=>set('quirk_name',e.target.value)} placeholder="Ex: All For One"/></div>
            <div className="field"><label>Tipo do Quirk</label>
              <select className="input" value={form.quirk_type} onChange={e=>set('quirk_type',e.target.value)}>
                <option value="">— Sem tipo —</option>
                {Object.keys(QUIRK_TYPE_BONUSES).map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          {qBonus&&qBonus.attr&&(
            <div style={{padding:'7px 10px',background:`${qBonus.color}11`,border:`1px solid ${qBonus.color}33`,borderRadius:6,marginBottom:10,fontSize:11,color:qBonus.color}}>
              ✦ Bônus de tipo <strong>{form.quirk_type}</strong>: {qBonus.label} — {qBonus.desc}
            </div>
          )}
        </div>
      )}

      <div style={{display:'flex',gap:6,marginTop:14}}>
        <button className="btn btn-p btn-lg" onClick={handleSave} disabled={saving} style={{flex:1}}>{saving?'⏳ Salvando...':'💾 Salvar NPC'}</button>
        {npc&&<button className="btn btn-danger" onClick={async()=>{if(!confirm('Remover NPC?'))return;await deleteNpc(npc.id);notify('🗑️ Removido');onSaved()}}>🗑️</button>}
        <button className="btn btn-g" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  )
}

export default function NpcsView() {
  const [npcs,setNpcs]=useState([])
  const [loading,setLoading]=useState(true)
  const [showModal,setShowModal]=useState(false)
  const [editNpc,setEditNpc]=useState(null)
  const [detailNpc,setDetailNpc]=useState(null)
  const [filter,setFilter]=useState('all')

  async function load(){setLoading(true);const{data}=await getNpcs();if(data)setNpcs(data);setLoading(false)}
  useEffect(()=>{load()},[])

  const filtered=filter==='all'?npcs:npcs.filter(n=>n.role===filter)

  return (
    <div style={{flex:1,overflowY:'auto',padding:14}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,flexWrap:'wrap'}}>
        <div style={{fontFamily:'Bangers,cursive',fontSize:20,letterSpacing:3,color:'var(--text-h)'}}>🎭 NPCs</div>
        <div style={{fontSize:11,color:'var(--muted)'}}>{npcs.length} personagens</div>
        <div style={{display:'flex',gap:4,marginLeft:8}}>
          {[{k:'all',l:'Todos'},{k:'npc',l:'NPCs'},{k:'villain',l:'Vilões'},{k:'hero_npc',l:'Heróis'},{k:'neutral',l:'Neutros'}].map(f=>(
            <button key={f.k} className={`btn btn-sm ${filter===f.k?'btn-p':'btn-g'}`} onClick={()=>setFilter(f.k)}>{f.l}</button>
          ))}
        </div>
        <button className="btn btn-p btn-sm" style={{marginLeft:'auto'}} onClick={()=>{setEditNpc(null);setShowModal(true)}}>+ Novo NPC</button>
      </div>

      {loading&&<div style={{textAlign:'center',padding:40}}><div className="spinner" style={{margin:'0 auto'}}/></div>}

      {!loading&&filtered.length===0&&(
        <div style={{textAlign:'center',padding:40,color:'var(--muted)'}}>
          <div style={{fontSize:48,marginBottom:12}}>🎭</div>
          <div style={{fontFamily:'Bangers,cursive',fontSize:18,letterSpacing:2,color:'var(--blue-l)',marginBottom:8}}>NENHUM NPC</div>
          {filter==='all'&&<button className="btn btn-p btn-lg" style={{marginTop:8}} onClick={()=>{setEditNpc(null);setShowModal(true)}}>+ Criar Primeiro NPC</button>}
        </div>
      )}

      <div className="npc-grid" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
        {filtered.map(npc=>{
          const rs=ROLE_STYLE[npc.role]||ROLE_STYLE.npc
          return(
            <div key={npc.id} className="npc-card" onClick={()=>setDetailNpc(npc)}>
              {npc.avatar_url
                ?<img src={npc.avatar_url} alt="" className="npc-cover"/>
                :<div className="npc-cover-placeholder" style={{background:avatarBg(npc.avatar_color||'gray')}}>{npc.name[0]}</div>
              }
              <div className="npc-body">
                <div className="npc-name">{npc.name}</div>
                <div style={{display:'flex',gap:5,alignItems:'center',marginBottom:4}}>
                  <span className="npc-role-badge" style={{background:rs.bg,color:rs.c}}>{rs.label}</span>
                  {npc.level&&<span style={{fontFamily:'Orbitron,monospace',fontSize:8,color:'var(--dim)'}}>Nv.{npc.level}</span>}
                </div>
                {npc.alias&&<div style={{fontSize:9,color:'var(--gold)',marginBottom:3}}>"{npc.alias}"</div>}
                {npc.quirk_name&&<div style={{fontSize:10,color:'var(--purple-l)',marginBottom:4}}>✨ {npc.quirk_name}</div>}
                {npc.description&&<div className="npc-desc">{npc.description.slice(0,80)}{npc.description.length>80?'...':''}</div>}
              </div>
            </div>
          )
        })}
      </div>

      {showModal&&<NpcModal npc={editNpc} onClose={()=>{setShowModal(false);setEditNpc(null)}} onSaved={()=>{load();setShowModal(false);setEditNpc(null)}}/>}

      {detailNpc&&(
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setDetailNpc(null)}>
          <div className="modal" style={{maxWidth:460}}>
            <div className="modal-hdr"><div className="modal-title">🎭 {detailNpc.name}</div><button className="modal-close" onClick={()=>setDetailNpc(null)}>✕</button></div>
            {(() => {
              const rs=ROLE_STYLE[detailNpc.role]||ROLE_STYLE.npc
              const derived=calcDerived(detailNpc.attrs||{},detailNpc.quirk_type||'')
              return(
                <>
                  <div style={{textAlign:'center',marginBottom:14}}>
                    <div style={{width:80,height:80,borderRadius:'50%',background:avatarBg(detailNpc.avatar_color||'gray'),margin:'0 auto 10px',overflow:'hidden',border:`3px solid ${rs.c}`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Bangers,cursive',fontSize:32,color:'#fff'}}>
                      {detailNpc.avatar_url?<img src={detailNpc.avatar_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:detailNpc.name[0]}
                    </div>
                    <div style={{fontFamily:'Bangers,cursive',fontSize:22,letterSpacing:2,color:'var(--text-h)'}}>{detailNpc.name}</div>
                    {detailNpc.alias&&<div style={{fontSize:11,color:'var(--gold)',letterSpacing:2,marginTop:2}}>"{detailNpc.alias}"</div>}
                    <div style={{display:'flex',gap:6,justifyContent:'center',marginTop:6}}>
                      <span style={{fontSize:9,fontWeight:700,padding:'2px 8px',borderRadius:3,background:rs.bg,color:rs.c,textTransform:'uppercase'}}>{rs.label}</span>
                      {detailNpc.level&&<span style={{fontFamily:'Orbitron,monospace',fontSize:9,color:'var(--gold)',padding:'2px 6px',background:'rgba(255,179,0,.1)',borderRadius:3}}>Nível {detailNpc.level}</span>}
                    </div>
                  </div>
                  {detailNpc.quirk_name&&(
                    <div style={{background:'rgba(155,89,182,.08)',border:'1px solid rgba(155,89,182,.3)',borderRadius:6,padding:'8px 12px',marginBottom:12,textAlign:'center'}}>
                      <div style={{fontSize:9,color:'var(--purple-l)',letterSpacing:2,textTransform:'uppercase',marginBottom:2}}>✨ Quirk</div>
                      <div style={{fontFamily:'Bangers,cursive',fontSize:16,color:'var(--purple-l)',letterSpacing:1}}>{detailNpc.quirk_name}</div>
                      {detailNpc.quirk_type&&<div style={{fontSize:9,color:'var(--dim)',marginTop:2}}>{detailNpc.quirk_type}</div>}
                    </div>
                  )}
                  {detailNpc.attrs&&(
                    <div style={{marginBottom:12}}>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5,marginBottom:8}}>
                        {[{l:'HP Máx',v:derived.hpMax,c:'var(--red-l)'},{l:'Quirk Máx',v:derived.quirkMax,c:'var(--purple-l)'},{l:'Stamina Máx',v:derived.staminaMax,c:'var(--blue-l)'}].map(s=>(
                          <div key={s.l} style={{background:'var(--panel)',border:'1px solid var(--border)',borderRadius:5,padding:'5px 7px',textAlign:'center'}}>
                            <div style={{fontSize:7,color:'var(--dim)',textTransform:'uppercase',marginBottom:2}}>{s.l}</div>
                            <div style={{fontFamily:'Orbitron,monospace',fontSize:12,fontWeight:700,color:s.c}}>{s.v}</div>
                          </div>
                        ))}
                      </div>
                      {ATTR_KEYS.map(k=>{
                        const v=detailNpc.attrs[k]||0
                        return(
                          <div key={k} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                            <span style={{fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:10,color:'var(--muted)',width:80,textTransform:'uppercase'}}>{ATTR_META[k].label}</span>
                            <div style={{flex:1,height:4,background:'var(--border)',borderRadius:2,overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min(100,(v/30)*100)}%`,background:ATTR_META[k].color,borderRadius:2}}/></div>
                            <span style={{fontFamily:'Orbitron,monospace',fontSize:9,color:gradeColor(v),width:26,textAlign:'right'}}>{gradeLabel(v)}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {detailNpc.description&&<div style={{fontSize:11,color:'var(--muted)',lineHeight:1.6,marginBottom:12}}>{detailNpc.description}</div>}
                  <div style={{display:'flex',gap:6}}>
                    <button className="btn btn-p btn-sm" style={{flex:1}} onClick={()=>{setEditNpc(detailNpc);setDetailNpc(null);setShowModal(true)}}>✏️ Editar</button>
                    <button className="btn btn-g btn-sm" style={{flex:1}} onClick={()=>setDetailNpc(null)}>Fechar</button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
