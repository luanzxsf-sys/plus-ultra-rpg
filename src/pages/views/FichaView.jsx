import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { upsertCharacter, resetCharacterFull, uploadAvatar, getPresetTraits, getCharacterTraits, addTraitToCharacter, removeTraitFromCharacter, createCustomTrait, getUserActivity } from '../../lib/supabase'
import { notify } from '../../components/Toast'
import Modal from '../../components/Modal'
import Avatar, { avatarBg } from '../../components/Avatar'
import AttrBuilder from '../../components/AttrBuilder'
import {
  ATTR_META, ATTR_KEYS, calcDerived, gradeLabel, gradeColor,
  SPECIALTIES, getSpecialty, calcAttrsWithSpecialty,
  QUIRK_TYPE_BONUSES, quirkRankName, calcLevel, POINTS_PER_LEVEL
} from '../../lib/gameSystem'
import { computeProgress, ACHIEVEMENTS } from '../../lib/achievements'

const COLORS = [
  {key:'purple',bg:'linear-gradient(135deg,#7c3aed,#5b21b6)'},{key:'blue',bg:'linear-gradient(135deg,#2563eb,#1d4ed8)'},
  {key:'red',bg:'linear-gradient(135deg,#dc2626,#991b1b)'},{key:'green',bg:'linear-gradient(135deg,#16a34a,#15803d)'},
  {key:'gold',bg:'linear-gradient(135deg,#d97706,#b45309)'},{key:'pink',bg:'linear-gradient(135deg,#db2777,#be185d)'},
  {key:'teal',bg:'linear-gradient(135deg,#0891b2,#0e7490)'},{key:'gray',bg:'linear-gradient(135deg,#374151,#1f2937)'},
]
const TRAIT_TYPES = [
  {k:'passive',l:'Passivo','desc':'Sempre ativo, sem necessidade de ativação.'},
  {k:'active',l:'Ativo','desc':'Deve ser ativado deliberadamente em combate.'},
  {k:'combat',l:'Combate','desc':'Melhora desempenho em situações de batalha.'},
  {k:'quirk_boost',l:'Quirk Boost','desc':'Reduz custo ou amplia o Quirk.'},
]
const TRAIT_BONUS_ATTRS = [
  {k:'none',l:'Nenhum bônus direto'},
  ...ATTR_KEYS.map(k=>({k,l:`${ATTR_META[k].label} +bônus`}))
]
const RANK_COLORS = {S:'#ff79c6','S+':'#ff40ff','SS':'#FF79C6','SS+':'#FF69B4','SSS':'#FF40FF','SSS+':'#FF00FF',A:'#A78BFA','A+':'#9B59B6',B:'#7289DA','B+':'#5865F2',C:'#57F287','C+':'#3BA55D',D:'#FFA500','D+':'#FF8C00',E:'#96989D',F:'#72767D'}

/* ── TRAITS MODAL ── */
function TraitsModal({ userId, charTraits, setCharTraits, onClose }) {
  const [presets, setPresets] = useState([])
  const [tab, setTab]         = useState('preset')
  const [form, setForm]       = useState({ name:'', description:'', icon:'⭐', rank:'C', type:'passive', attr_bonus:'none', bonus_value:5 })
  const [saving, setSaving]   = useState(false)

  useEffect(() => { getPresetTraits().then(({data})=>setPresets(data||[])) }, [])

  const acquiredIds = charTraits.map(ct=>ct.trait_id)

  async function toggle(traitId) {
    if (acquiredIds.includes(traitId)) {
      await removeTraitFromCharacter(userId, traitId)
      setCharTraits(p=>p.filter(ct=>ct.trait_id!==traitId))
      notify('Trait removido')
    } else {
      if (charTraits.length>=4){notify('Máximo 4 traits','error');return}
      const {data,error}=await addTraitToCharacter(userId, traitId)
      if(error){notify('❌ '+error.message,'error');return}
      setCharTraits(p=>[...p,data])
      notify('✅ Trait adquirido!')
    }
  }

  async function createTrait() {
    if(!form.name.trim()){notify('❌ Nome obrigatório','error');return}
    setSaving(true)
    const effect = form.attr_bonus!=='none' ? {attr:form.attr_bonus, bonus:Number(form.bonus_value)} : {}
    const {data,error}=await createCustomTrait(userId,{...form,effect})
    setSaving(false)
    if(error){notify('❌ '+error.message,'error');return}
    setPresets(p=>[...p,data])
    notify('✅ Trait criado!')
    setForm({name:'',description:'',icon:'⭐',rank:'C',type:'passive',attr_bonus:'none',bonus_value:5})
  }

  return (
    <Modal title="✦ Traits & Características" onClose={onClose} maxWidth={640}>
      <div style={{fontSize:11,color:'var(--muted)',marginBottom:12}}>
        Selecione até <strong style={{color:'var(--gold)'}}>4 traits</strong>. Os bônus são aplicados automaticamente em atributos e ações de combate.
        <span style={{color:charTraits.length>=4?'var(--red-l)':'var(--green-l)',marginLeft:8}}>({charTraits.length}/4 selecionados)</span>
      </div>
      <div style={{display:'flex',borderBottom:'1px solid var(--border)',marginBottom:14}}>
        {[{k:'preset',l:'Pré-definidos'},{k:'custom',l:'Criar Trait'}].map(t=>(
          <div key={t.k} onClick={()=>setTab(t.k)} style={{padding:'8px 16px',cursor:'pointer',fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:11,letterSpacing:1,textTransform:'uppercase',color:tab===t.k?'var(--blue-l)':'var(--muted)',borderBottom:`2px solid ${tab===t.k?'var(--blue)':'transparent'}`}}>{t.l}</div>
        ))}
      </div>
      {tab==='preset' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          {presets.map(tr=>{
            const has=acquiredIds.includes(tr.id)
            const rc=RANK_COLORS[tr.rank]||'var(--muted)'
            return (
              <div key={tr.id} className={`trait-card ${has?'selected':''}`} onClick={()=>toggle(tr.id)}>
                <span className="trait-rank" style={{color:rc}}>{tr.rank}</span>
                <div style={{fontSize:20,marginBottom:4}}>{tr.icon}</div>
                <div style={{fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:12,marginBottom:2}}>{tr.name}</div>
                <div style={{fontSize:10,color:'var(--muted)',lineHeight:1.4,marginBottom:4}}>{tr.description}</div>
                {tr.effect?.attr && (
                  <div style={{fontSize:9,color:'var(--blue-l)',fontWeight:700}}>
                    +{tr.effect.bonus} {ATTR_META[tr.effect.attr]?.label||tr.effect.attr}
                  </div>
                )}
                <div style={{fontSize:9,color:'var(--dim)',marginTop:2,textTransform:'uppercase',letterSpacing:1}}>
                  {TRAIT_TYPES.find(t=>t.k===tr.type)?.l||tr.type}
                </div>
                {has && <div style={{position:'absolute',top:6,left:8,fontSize:12,color:'var(--green-l)',fontWeight:700}}>✓</div>}
              </div>
            )
          })}
        </div>
      )}
      {tab==='custom' && (
        <div>
          <div style={{fontSize:11,color:'var(--muted)',marginBottom:12}}>Crie um trait personalizado. Defina o bônus de atributo que ele concede — isso será calculado automaticamente em combate.</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <div className="field"><label>Nome *</label><input className="input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Ex: Sensei Natural" /></div>
            <div className="field"><label>Ícone (emoji)</label><input className="input" value={form.icon} onChange={e=>setForm(f=>({...f,icon:e.target.value}))} /></div>
            <div className="field"><label>Rank</label>
              <select className="input" value={form.rank} onChange={e=>setForm(f=>({...f,rank:e.target.value}))}>
                {['F','E','D','D+','C','C+','B','B+','A','A+','S','S+','SS','SS+','SSS','SSS+'].map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="field"><label>Tipo</label>
              <select className="input" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                {TRAIT_TYPES.map(t=><option key={t.k} value={t.k}>{t.l} — {t.desc}</option>)}
              </select>
            </div>
            <div className="field"><label>Bônus de Atributo</label>
              <select className="input" value={form.attr_bonus} onChange={e=>setForm(f=>({...f,attr_bonus:e.target.value}))}>
                {TRAIT_BONUS_ATTRS.map(a=><option key={a.k} value={a.k}>{a.l}</option>)}
              </select>
            </div>
            {form.attr_bonus!=='none' && (
              <div className="field"><label>Quantidade do Bônus</label>
                <input className="input" type="number" min={1} max={50} value={form.bonus_value} onChange={e=>setForm(f=>({...f,bonus_value:e.target.value}))} />
              </div>
            )}
          </div>
          <div className="field"><label>Descrição / Efeito</label><textarea className="input" rows={2} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Descreva o efeito narrativo e mecânico..." /></div>
          <button className="btn btn-p btn-lg btn-full" onClick={createTrait} disabled={saving}>{saving?'⏳...':'✦ Criar Trait'}</button>
        </div>
      )}
    </Modal>
  )
}

/* ── DELETE CHARACTER MODAL ── */
function DeleteCharModal({ onClose, onConfirm }) {
  const [confirm, setConfirm] = useState('')
  return (
    <Modal title="🗑️ Excluir Personagem" onClose={onClose} maxWidth={400}>
      <div style={{fontSize:12,color:'var(--muted)',lineHeight:1.7,marginBottom:14}}>
        Isso irá <strong style={{color:'var(--red-l)'}}>apagar permanentemente</strong> toda a ficha do personagem, incluindo atributos, Quirk e técnicas.<br/>
        Missões, inventário e histórico de chat <strong>não</strong> serão apagados.<br/><br/>
        Para confirmar, digite <strong style={{color:'var(--red-l)'}}>EXCLUIR</strong> abaixo:
      </div>
      <div className="field"><input className="input" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Digite EXCLUIR" /></div>
      <div style={{display:'flex',gap:6}}>
        <button className="btn btn-danger btn-lg" disabled={confirm!=='EXCLUIR'} onClick={onConfirm} style={{flex:1}}>🗑️ Excluir</button>
        <button className="btn btn-g" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  )
}

/* ── EDIT CHAR MODAL ── */
function EditCharModal({ char, onClose, onSaved }) {
  const {user} = useAuth()
  const defaultAttrs = {forca:6,agilidade:6,controle:6,resistencia:6,inteligencia:6,carisma:6,stamina:6}
  const [form, setForm] = useState({
    name:char?.name||'', alias:char?.alias||'', age:char?.age||'',
    height:char?.height||'', affiliation:char?.affiliation||'',
    specialty:char?.specialty||'', bio:char?.bio||'',
    avatar_color:char?.avatar_color||'purple',
  })
  const [attrs, setAttrs]   = useState(char?.attrs||defaultAttrs)
  const [saving, setSaving] = useState(false)
  const [avatarFile, setAvatarFile]     = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(char?.avatar_url||null)

  function set(k,v){setForm(f=>({...f,[k]:v}))}

  function handleAvatarChange(e){
    const file=e.target.files[0];if(!file)return
    if(file.size>2*1024*1024){notify('❌ Máx 2MB','error');return}
    setAvatarFile(file);setAvatarPreview(URL.createObjectURL(file))
  }

  async function handleSave(){
    if(!form.name.trim()){notify('❌ Nome obrigatório','error');return}
    const used=ATTR_KEYS.reduce((s,k)=>s+(attrs[k]||0),0)
    const charLevel = char?.level ?? 1
    const maxPts = 60 + (charLevel - 1) * 3
    if(used>maxPts){notify(`❌ Máximo ${maxPts} pontos para nível ${charLevel} (${used} usados)`,'error');return}
    setSaving(true)
    let avatar_url=char?.avatar_url||null
    if(avatarFile){const{url,error}=await uploadAvatar(user.id,avatarFile);if(error)notify('⚠️ Erro foto','error');else avatar_url=url}
    const effectiveAttrs = form.specialty ? calcAttrsWithSpecialty(attrs, form.specialty) : attrs
    const derived=calcDerived(effectiveAttrs, char?.quirk_data?.type||'')
    const payload={
      ...form, avatar_url, attrs,
      hp_max:derived.hpMax, quirk_max:derived.quirkMax, stamina_max:derived.staminaMax,
      hp:Math.min(char?.hp||derived.hpMax,derived.hpMax),
      quirk_charge:Math.min(char?.quirk_charge||derived.quirkMax,derived.quirkMax),
      stamina:Math.min(char?.stamina||derived.staminaMax,derived.staminaMax),
      quirk_data:char?.quirk_data||{name:'',type:'',subtype:'',level:1,range:'',weakness:'',dominio:0,carga:100,description:'',awakening:'',skills:[]},
      quirk_xp:char?.quirk_xp||0, quirk_level:char?.quirk_level||1,
      // Preserve XP/level — never overwrite from ficha edit
      // upsertCharacter will strip these anyway, but keep for reference
      xp:char?.xp||0, xp_max:char?.xp_max||1000,
    }
    // Never save xp_total or level from ficha edit — those come from addXpToCharacter only
    const{error}=await upsertCharacter(user.id,payload)
    setSaving(false)
    if(error){notify('❌ '+error.message,'error');return}
    notify('✅ Personagem salvo!','success'); onSaved(); onClose()
  }

  const specObj = getSpecialty(form.specialty)

  return (
    <Modal title={char?'✏️ Editar Personagem':'✦ Criar Personagem'} onClose={onClose} maxWidth={640}>
      {/* Avatar */}
      <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:18,padding:'12px 14px',background:'var(--panel)',borderRadius:8,border:'1px solid var(--border)'}}>
        <div style={{position:'relative'}}>
          <div style={{width:60,height:60,borderRadius:'50%',background:avatarBg(form.avatar_color),display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',fontFamily:'Bangers,cursive',fontSize:24,color:'#fff'}}>
            {avatarPreview?<img src={avatarPreview} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:(form.name[0]||'?').toUpperCase()}
          </div>
          <label style={{position:'absolute',bottom:-2,right:-2,width:22,height:22,borderRadius:'50%',background:'var(--blue)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:11}}>
            📷<input type="file" accept="image/*" style={{display:'none'}} onChange={handleAvatarChange}/>
          </label>
        </div>
        <div>
          <div style={{fontFamily:'Bangers,cursive',fontSize:18,letterSpacing:1}}>{form.name||'—'}</div>
          {form.alias&&<div style={{fontSize:9,color:'var(--gold)',letterSpacing:2}}>"{form.alias}"</div>}
          {specObj&&<div style={{fontSize:9,color:'var(--blue-l)',marginTop:2}}>{specObj.icon} {specObj.label}</div>}
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        <div className="field"><label>Nome Real *</label><input className="input" value={form.name} onChange={e=>set('name',e.target.value)}/></div>
        <div className="field"><label>Codinome</label><input className="input" value={form.alias} onChange={e=>set('alias',e.target.value)} placeholder='"Shadowlace"'/></div>
        <div className="field"><label>Idade</label><input className="input" value={form.age} onChange={e=>set('age',e.target.value)}/></div>
        <div className="field"><label>Altura</label><input className="input" value={form.height} onChange={e=>set('height',e.target.value)}/></div>
        <div className="field"><label>Afiliação</label><input className="input" value={form.affiliation} onChange={e=>set('affiliation',e.target.value)}/></div>
      </div>

      {/* Especialidade */}
      <div className="field">
        <label>⭐ Especialidade</label>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginTop:4}}>
          {SPECIALTIES.map(sp=>(
            <div key={sp.key} onClick={()=>set('specialty',form.specialty===sp.key?'':sp.key)}
              style={{border:`1px solid ${form.specialty===sp.key?'var(--blue)':'var(--border)'}`,borderRadius:6,padding:'7px 6px',cursor:'pointer',textAlign:'center',background:form.specialty===sp.key?'rgba(59,111,240,.12)':'transparent',transition:'all .15s'}}>
              <div style={{fontSize:18,marginBottom:3}}>{sp.icon}</div>
              <div style={{fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:10,color:form.specialty===sp.key?'var(--blue-l)':'var(--muted)'}}>{sp.label}</div>
            </div>
          ))}
        </div>
        {specObj&&<div style={{marginTop:6,fontSize:10,color:'var(--muted)',padding:'5px 8px',background:'var(--panel)',borderRadius:4}}>
          {Object.entries(specObj.bonuses).map(([k,v])=>`${ATTR_META[k]?.label} +${v}`).join(' · ')} — {specObj.passive}
        </div>}
      </div>

      <div className="field">
        <label>Cor do Avatar</label>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:4}}>
          {COLORS.map(c=><div key={c.key} onClick={()=>set('avatar_color',c.key)} style={{width:26,height:26,borderRadius:'50%',background:c.bg,cursor:'pointer',border:`2px solid ${form.avatar_color===c.key?'#fff':'transparent'}`,transition:'border .15s'}}/>)}
        </div>
      </div>

      <div className="field"><label>Histórico / Bio</label><textarea className="input" rows={3} value={form.bio} onChange={e=>set('bio',e.target.value)}/></div>

      <div style={{borderTop:'1px solid var(--border)',paddingTop:12,marginTop:4}}>
        <div style={{fontFamily:'Bangers,cursive',fontSize:14,color:'var(--blue-l)',marginBottom:10,letterSpacing:1}}>⚡ DISTRIBUIR ATRIBUTOS (60 pontos)</div>
        <AttrBuilder attrs={attrs} onChange={setAttrs} quirk_type={char?.quirk_data?.type||''} specialty={form.specialty} charLevel={char?.level ?? calcLevel(char?.xp_total ?? char?.xp ?? 0)}/>
      </div>

      <div style={{display:'flex',gap:8,marginTop:14}}>
        <button className="btn btn-p btn-lg" onClick={handleSave} disabled={saving} style={{flex:1}}>{saving?'⏳ Salvando...':'💾 Salvar'}</button>
        <button className="btn btn-g" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  )
}

/* ── MAIN VIEW ── */
const DIARY_ICONS = { attack:'⚔️', skill:'✨', defend:'🛡️', dodge:'💨', heal:'💚', intel:'🧠', charisma:'💬', system:'⚠️', take:'💥' }
function HeroDiaryCard({ userId }) {
  const [entries,setEntries]=useState(null)
  const [open,setOpen]=useState(false)
  useEffect(()=>{
    if(open && entries===null) getUserActivity(userId,25).then(({data})=>setEntries(data))
  },[open])
  function timeAgo(iso){
    const diff=(Date.now()-new Date(iso).getTime())/1000
    if(diff<60) return 'agora'
    if(diff<3600) return `${Math.floor(diff/60)}min atrás`
    if(diff<86400) return `${Math.floor(diff/3600)}h atrás`
    return `${Math.floor(diff/86400)}d atrás`
  }
  return (
    <div className="card">
      <div className="card-title" style={{cursor:'pointer'}} onClick={()=>setOpen(o=>!o)}>
        📖 Diário do Herói <span style={{fontSize:11}}>{open?'▲':'▼'}</span>
      </div>
      {open && (
        entries===null ? <div style={{fontSize:11,color:'var(--dim)'}}>Carregando...</div> :
        entries.length===0 ? <div style={{fontSize:11,color:'var(--dim)'}}>Nenhuma atividade registrada ainda. Entre em combate ou aja em uma missão!</div> :
        <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:280,overflowY:'auto'}}>
          {entries.map(e=>{
            const clean = (e.content||'').split(' ‖ ').join(' — ').replace(/^⚠️\s*/,'')
            return (
              <div key={e.id} style={{display:'flex',gap:8,fontSize:11}}>
                <span style={{flexShrink:0}}>{DIARY_ICONS[e.mode]||'📌'}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:'var(--text)',lineHeight:1.4}}>{clean}</div>
                  <div style={{color:'var(--dim)',fontSize:9,marginTop:1}}>{timeAgo(e.created_at)}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Fundo temático de acordo com o tipo da Quirk — cada tipo tem um padrão visual próprio
function quirkTypeBg(type, color){
  const c = color || '#5C6478'
  switch(type){
    case 'Emissor': // rajadas de energia
      return `repeating-conic-gradient(from 0deg at 100% 0%, ${c}14 0deg 8deg, transparent 8deg 24deg)`
    case 'Transformação':
    case 'Acumulação': // ondas orgânicas
      return `repeating-linear-gradient(135deg, ${c}12 0 6px, transparent 6px 22px)`
    case 'Mutante': // riscos de velocidade
      return `repeating-linear-gradient(115deg, ${c}18 0 3px, transparent 3px 26px)`
    case 'Ferramenta': // grid técnico
      return `repeating-linear-gradient(0deg, ${c}10 0 1px, transparent 1px 18px), repeating-linear-gradient(90deg, ${c}10 0 1px, transparent 1px 18px)`
    case 'Composto': // circuito/pontos
      return `radial-gradient(${c}22 1.4px, transparent 1.4px)`
    default:
      return `linear-gradient(160deg, ${c}10, transparent 60%)`
  }
}

function AchievementsCard({ char }) {
  const level = char?.level ?? calcLevel(char?.xp_total ?? char?.xp ?? 0)
  const { unlocked, total, pct } = computeProgress(char, level)
  const unlockedIds = new Set(unlocked.map(a=>a.id))
  const [selected, setSelected] = useState(null)
  return (
    <div className="card">
      <div className="card-title">🎖️ Conquistas <span style={{fontSize:10,color:'var(--dim)',fontWeight:400,textTransform:'none',letterSpacing:0}}>{unlocked.length}/{total}</span></div>
      <div style={{height:5,background:'var(--border)',borderRadius:3,overflow:'hidden',marginBottom:10}}>
        <div style={{height:'100%',width:`${pct}%`,background:'linear-gradient(90deg,var(--gold-d),var(--gold))',borderRadius:3,transition:'width .3s'}}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:6}}>
        {ACHIEVEMENTS.map(a=>{
          const on = unlockedIds.has(a.id)
          const isSel = selected?.id===a.id
          return (
            <div key={a.id} onClick={()=>setSelected(isSel?null:a)}
              style={{
                aspectRatio:'1',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:16,cursor:'pointer',
                background:on?'linear-gradient(135deg,rgba(242,183,5,.18),rgba(242,183,5,.05))':'var(--panel)',
                border:`1px solid ${isSel?'var(--gold)':on?'rgba(242,183,5,.4)':'var(--border)'}`,
                filter:on?'none':'grayscale(1) opacity(.35)',
                transition:'all .15s',
              }}>
              {a.icon}
            </div>
          )
        })}
      </div>
      {selected && (
        <div style={{marginTop:10,padding:'8px 10px',background:'var(--panel)',borderRadius:7,border:'1px solid var(--border)'}}>
          <div style={{fontSize:12,fontWeight:700,color:unlockedIds.has(selected.id)?'var(--gold)':'var(--muted)'}}>
            {selected.icon} {selected.label} {!unlockedIds.has(selected.id) && <span style={{fontSize:9,color:'var(--dim)',fontWeight:400}}>(bloqueada)</span>}
          </div>
          <div style={{fontSize:11,color:'var(--muted)',marginTop:3}}>{selected.desc}</div>
        </div>
      )}
    </div>
  )
}

export default function FichaView({ onRefreshChar }) {
  const {user, character, refreshCharacter} = useAuth()
  const [showEdit,   setShowEdit]   = useState(false)
  const [showTraits, setShowTraits] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [charTraits, setCharTraits] = useState([])
  const char = character

  useEffect(()=>{
    if(user) getCharacterTraits(user.id).then(({data})=>setCharTraits(data||[]))
  },[user,char?.id])

  async function handleSaved(){ await refreshCharacter(); if(onRefreshChar) onRefreshChar() }

  async function handleDelete(){
    // Full reset — name, attrs AND level/xp all go back to defaults
    const{error}=await resetCharacterFull(user.id,{
      name:'',alias:'',age:'',height:'',affiliation:'',specialty:'',bio:'',
      avatar_url:null,avatar_color:'purple',
      attrs:{forca:6,agilidade:6,controle:6,resistencia:6,inteligencia:6,carisma:6,stamina:6},
      quirk_data:{name:'',type:'',subtype:'',level:1,range:'',weakness:'',dominio:0,carga:100,description:'',awakening:'',skills:[]},
      hp:100,hp_max:100,quirk_charge:100,quirk_max:100,stamina:100,stamina_max:100,
      quirk_level:1,quirk_xp:0,
    })
    if(error){notify('❌ '+error.message,'error');return}
    notify('🗑️ Personagem excluído. Crie um novo.','success')
    setShowDelete(false)
    await refreshCharacter()
  }

  const quirkType  = char?.quirk_data?.type||''
  const quirkBonus = QUIRK_TYPE_BONUSES[quirkType]
  const specObj    = getSpecialty(char?.specialty)
  const effectiveAttrs = specObj ? calcAttrsWithSpecialty(char?.attrs||{}, char?.specialty) : (char?.attrs||{})
  const derived    = calcDerived(effectiveAttrs, quirkType, charTraits)
  const skills     = (char?.quirk_data?.skills||[]).filter(s=>!s.locked).slice(0,4)

  if(!char?.name) return (
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16,color:'var(--muted)',padding:20}}>
      <div style={{fontSize:56}}>🦸</div>
      <div style={{fontFamily:'Bangers,cursive',fontSize:22,letterSpacing:2,color:'var(--blue-l)'}}>CRIE SEU PERSONAGEM</div>
      <div style={{fontSize:13,textAlign:'center',maxWidth:280,lineHeight:1.6}}>Distribua seus atributos, escolha sua especialidade e dê vida ao seu herói.</div>
      <button className="btn btn-p btn-lg" onClick={()=>setShowEdit(true)}>✦ Criar Personagem</button>
      {showEdit&&<EditCharModal char={null} onClose={()=>setShowEdit(false)} onSaved={handleSaved}/>}
    </div>
  )

  return (
    <div style={{flex:1,overflowY:'auto',padding:14}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,flexWrap:'wrap'}}>
        <div style={{fontFamily:'Bangers,cursive',fontSize:20,letterSpacing:3,color:'var(--blue-l)'}}>FICHA DO HERÓI</div>
        <button className="btn btn-p btn-sm" onClick={()=>setShowEdit(true)}>✏️ Editar</button>
        <button className="btn btn-g btn-sm" onClick={()=>setShowTraits(true)}>✦ Traits ({charTraits.length}/4)</button>
        <button className="btn btn-danger btn-sm" style={{marginLeft:'auto'}} onClick={()=>setShowDelete(true)}>🗑️ Excluir</button>
      </div>

      <div className="ficha-grid" style={{display:'grid',gridTemplateColumns:'280px 1fr',gap:12}}>
        {/* LEFT */}
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <AchievementsCard char={char}/>
          <HeroDiaryCard userId={user.id}/>
          <div className="card" style={{ backgroundImage: quirkTypeBg(char.quirk_data?.type, QUIRK_TYPE_BONUSES[char.quirk_data?.type]?.color), backgroundBlendMode:'overlay' }}>
            <div className="card-title">👤 Identidade</div>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
              <Avatar name={char.name} color={char.avatar_color} url={char.avatar_url} size={56}/>
              <div>
                <div style={{fontFamily:'Bangers,cursive',fontSize:20,letterSpacing:1,color:'var(--text-h)'}}>{char.name}</div>
                {char.alias&&<div style={{fontSize:10,color:'var(--gold)',letterSpacing:2}}>"{char.alias}"</div>}
              </div>
            </div>
            {specObj&&(
              <div style={{display:'flex',alignItems:'center',gap:7,padding:'6px 9px',background:'rgba(59,111,240,.08)',borderRadius:6,border:'1px solid rgba(59,111,240,.2)',marginBottom:8}}>
                <span style={{fontSize:18}}>{specObj.icon}</span>
                <div><div style={{fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:12,color:'var(--blue-l)'}}>{specObj.label}</div>
                <div style={{fontSize:9,color:'var(--dim)'}}>{specObj.passive}</div></div>
              </div>
            )}
            <table style={{width:'100%',fontSize:11,borderCollapse:'collapse'}}>
              <tbody>
                {[{l:'Afiliação',v:char.affiliation,c:'var(--blue-l)'},{l:'Idade',v:char.age},{l:'Altura',v:char.height},{l:'Especialidade',v:specObj?.label,c:'var(--purple-l)'}].filter(r=>r.v).map(r=>(
                  <tr key={r.l}><td style={{color:'var(--dim)',paddingBottom:4,width:100,fontWeight:600}}>{r.l}</td><td style={{color:r.c||'var(--text)',paddingBottom:4}}>{r.v}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-title">📊 Atributos</div>
            {quirkBonus&&quirkBonus.attr&&(
              <div style={{fontSize:10,color:quirkBonus.color,marginBottom:8,padding:'4px 7px',background:`${quirkBonus.color}11`,borderRadius:4,border:`1px solid ${quirkBonus.color}33`}}>
                ✨ Bônus {quirkType}: <strong>{quirkBonus.label}</strong>
              </div>
            )}
            <AttrBuilder attrs={char.attrs||{}} onChange={()=>{}} readOnly quirk_type={quirkType} traits={charTraits} specialty={char.specialty} charLevel={char?.level ?? calcLevel(char?.xp_total ?? char?.xp ?? 0)}/>
          </div>

          <div className="card">
            <div className="card-title">❤️ Vitais</div>
            {[
              {l:'HP',v:char.hp,m:derived.hpMax,c:'var(--red-l)'},
              {l:'Quirk',v:char.quirk_charge,m:derived.quirkMax,c:'var(--purple-l)'},
              {l:'Stamina',v:char.stamina,m:derived.staminaMax,c:'var(--blue-l)'},
              {l:'EXP',v:char.xp,m:char.xp_max,c:'linear-gradient(90deg,var(--blue),var(--purple))'},
            ].map(b=>{
              const p=b.m>0?Math.min(100,Math.round(b.v/b.m*100)):100
              return(
                <div key={b.l} style={{marginBottom:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'var(--dim)',marginBottom:3}}><span>{b.l}</span><span>{b.v}/{b.m}</span></div>
                  <div className="pbar"><div className="pbar-fill" style={{width:`${p}%`,background:b.c}}/></div>
                </div>
              )
            })}
          </div>

          {charTraits.length>0&&(
            <div className="card">
              <div className="card-title">✦ Traits <button className="btn btn-g btn-sm" onClick={()=>setShowTraits(true)}>Editar</button></div>
              {charTraits.map(ct=>(
                <div key={ct.id} style={{background:'var(--panel)',border:'1px solid var(--border)',borderRadius:5,padding:'7px 9px',marginBottom:5}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:2}}>
                    <span style={{fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:12}}>{ct.traits?.icon} {ct.traits?.name}</span>
                    <span style={{fontFamily:'Orbitron,monospace',fontSize:9,color:RANK_COLORS[ct.traits?.rank]||'var(--muted)'}}>{ct.traits?.rank}</span>
                  </div>
                  <div style={{fontSize:10,color:'var(--muted)',lineHeight:1.4}}>{ct.traits?.description}</div>
                  {ct.traits?.effect?.attr&&<div style={{fontSize:9,color:'var(--blue-l)',marginTop:3,fontWeight:700}}>+{ct.traits.effect.bonus} {ATTR_META[ct.traits.effect.attr]?.label}</div>}
                </div>
              ))}
            </div>
          )}

          {char.bio&&<div className="card"><div className="card-title">🧠 Histórico</div><div style={{fontSize:11,color:'var(--muted)',lineHeight:1.7}}>{char.bio}</div></div>}
        </div>

        {/* RIGHT */}
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {char.quirk_data?.name?(
            <div className="card card-purple">
              <div className="card-title" style={{color:'var(--purple-l)'}}>✨ {char.quirk_data.name}
                <div style={{display:'flex',gap:5,alignItems:'center'}}>
                  <span style={{fontFamily:'Orbitron,monospace',fontSize:9,color:'var(--gold)'}}>{quirkRankName(char.quirk_level||1)}</span>
                  {char.quirk_data.type&&<span className="tag" style={{background:'rgba(139,92,246,.2)',color:'var(--purple-l)',border:'1px solid rgba(139,92,246,.3)'}}>{char.quirk_data.type}</span>}
                </div>
              </div>
              {[
                {l:'CARGA',v:char.quirk_data.carga||100,c:'linear-gradient(90deg,var(--purple),var(--blue-l))',vc:'var(--purple-l)'},
                {l:'DOMÍNIO',v:char.quirk_data.dominio||0,c:'linear-gradient(90deg,var(--gold-d),var(--gold))',vc:'var(--gold)'},
              ].map(b=>(
                <div key={b.l} style={{marginBottom:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'var(--dim)',marginBottom:3}}><span>{b.l}</span><span style={{color:b.vc}}>{b.v}%</span></div>
                  <div className="pbar" style={{height:7,borderRadius:4}}><div className="pbar-fill" style={{width:`${b.v}%`,background:b.c,borderRadius:4}}/></div>
                </div>
              ))}
              {char.quirk_data.description&&<div style={{fontSize:11,color:'var(--muted)',lineHeight:1.6,marginBottom:10}}>{char.quirk_data.description}</div>}
              {char.quirk_data.awakening&&(
                <div style={{background:'rgba(242,183,5,.06)',border:'1px solid rgba(242,183,5,.2)',borderRadius:5,padding:8}}>
                  <div style={{fontSize:9,color:'var(--gold)',fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginBottom:3}}>⚡ Awakening</div>
                  <div style={{fontSize:11,color:'var(--muted)'}}>{char.quirk_data.awakening}</div>
                </div>
              )}
            </div>
          ):(
            <div className="card card-glow"><div className="card-title">✨ Quirk</div><div style={{fontSize:11,color:'var(--muted)'}}>Configure no menu <strong>Quirk & Habilidades</strong>.</div></div>
          )}
          {skills.length>0&&(
            <div className="card">
              <div className="card-title">⚔️ Técnicas Ativas</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {skills.map((s,i)=>(
                  <div key={i} style={{background:'var(--panel)',border:'1px solid var(--border)',borderRadius:5,padding:'8px 10px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:2}}>
                      <span style={{fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:12}}>{s.icon||'⚡'} {s.name}</span>
                      <span style={{fontFamily:'Orbitron,monospace',fontSize:8,color:'var(--gold)'}}>Nv.{s.level}</span>
                    </div>
                    <div style={{fontFamily:'Orbitron,monospace',fontSize:9,color:'var(--red-l)',marginBottom:2}}>{s.cost}</div>
                    <div style={{fontSize:10,color:'var(--muted)',lineHeight:1.4}}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showEdit   &&<EditCharModal char={char} onClose={()=>setShowEdit(false)} onSaved={handleSaved}/>}
      {showTraits &&<TraitsModal userId={user.id} charTraits={charTraits} setCharTraits={setCharTraits} onClose={()=>setShowTraits(false)}/>}
      {showDelete &&<DeleteCharModal onClose={()=>setShowDelete(false)} onConfirm={handleDelete}/>}
    </div>
  )
}
