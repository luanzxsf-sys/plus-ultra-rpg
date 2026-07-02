import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { upsertCharacter, uploadAvatar, getPresetTraits, getCharacterTraits, addTraitToCharacter, removeTraitFromCharacter, createCustomTrait } from '../../lib/supabase'
import { notify } from '../../components/Toast'
import Modal from '../../components/Modal'
import Avatar, { avatarBg } from '../../components/Avatar'

const COLORS = [
  {key:'purple',bg:'linear-gradient(135deg,#7c3aed,#5b21b6)'},
  {key:'blue',  bg:'linear-gradient(135deg,#2563eb,#1d4ed8)'},
  {key:'red',   bg:'linear-gradient(135deg,#dc2626,#991b1b)'},
  {key:'green', bg:'linear-gradient(135deg,#16a34a,#15803d)'},
  {key:'gold',  bg:'linear-gradient(135deg,#d97706,#b45309)'},
  {key:'pink',  bg:'linear-gradient(135deg,#db2777,#be185d)'},
  {key:'teal',  bg:'linear-gradient(135deg,#0891b2,#0e7490)'},
  {key:'gray',  bg:'linear-gradient(135deg,#374151,#1f2937)'},
]

const ATTR_META = {
  forca:       { label:'Força',       color:'var(--red)',      desc:'Dano físico e poder bruto' },
  agilidade:   { label:'Agilidade',   color:'var(--green)',    desc:'Velocidade, esquiva e iniciativa' },
  controle:    { label:'Controle',    color:'var(--blue)',     desc:'+5 Quirk máx por ponto' },
  resistencia: { label:'Resistência', color:'var(--gold)',     desc:'+5 HP máx por ponto' },
  inteligencia:{ label:'Inteligência',color:'var(--purple)',   desc:'Estratégia e habilidades mentais' },
  carisma:     { label:'Carisma',     color:'var(--blue-l)',   desc:'Liderança e interações sociais' },
  stamina:     { label:'Stamina',     color:'var(--teal)',     desc:'+3 Stamina máx por ponto' },
}

const QUIRK_BONUSES = {
  'Emitter':        { attr:'forca',       bonus:10, label:'+10 Força' },
  'Transformation': { attr:'resistencia', bonus:10, label:'+10 Resistência' },
  'Accumulation':   { attr:'resistencia', bonus:15, label:'+15 Resistência' },
  'Mutant':         { attr:'agilidade',   bonus:10, label:'+10 Agilidade' },
  'Tool':           { attr:'inteligencia',bonus:10, label:'+10 Inteligência' },
  'Composite':      { attr:'controle',    bonus:10, label:'+10 Controle' },
}

const RANK_COLORS = { S:'#ff79c6', A:'var(--purple-l)', B:'var(--blue-l)', C:'var(--green-l)', D:'var(--muted)', E:'var(--dim)' }
const TOTAL_POINTS = 60
const ATTR_MIN = 1
const ATTR_MAX = 20

function gradeLabel(v) {
  if(v>=18)return'S'; if(v>=15)return'A'; if(v>=12)return'B'; if(v>=8)return'C'; if(v>=5)return'D'; return'E'
}

function calcDerived(attrs) {
  return {
    hpMax:      100 + (attrs.resistencia || 0) * 5,
    quirkMax:   100 + (attrs.controle    || 0) * 5,
    staminaMax: 100 + (attrs.stamina     || 0) * 3,
  }
}

/* ── ATTR BUILDER ── */
function AttrBuilder({ attrs, onChange, readOnly }) {
  const used = Object.values(attrs).reduce((a,b)=>a+b,0)
  const left = TOTAL_POINTS - used
  const derived = calcDerived(attrs)

  function inc(k) {
    if (left <= 0 || attrs[k] >= ATTR_MAX) return
    onChange({ ...attrs, [k]: attrs[k] + 1 })
  }
  function dec(k) {
    if (attrs[k] <= ATTR_MIN) return
    onChange({ ...attrs, [k]: attrs[k] - 1 })
  }

  return (
    <div>
      {!readOnly && (
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, padding:'10px 12px', background:'var(--panel)', borderRadius:8, border:'1px solid var(--border)' }}>
          <div>
            <div className="points-left">{left}</div>
            <div style={{ fontSize:9, color:'var(--dim)', textTransform:'uppercase', letterSpacing:1 }}>pontos restantes</div>
          </div>
          <div style={{ flex:1, fontSize:11, color:'var(--muted)', lineHeight:1.5 }}>
            Distribua {TOTAL_POINTS} pontos entre os atributos.<br/>
            <span style={{ color:'var(--gold)', fontSize:10 }}>Resistência +5 HP · Controle +5 Quirk · Stamina +3 Stamina</span>
          </div>
        </div>
      )}
      {Object.entries(ATTR_META).map(([k, meta]) => {
        const v = attrs[k] || 0
        const pct = (v / ATTR_MAX) * 100
        const grade = gradeLabel(v)
        return (
          <div key={k} className="attr-builder-row">
            <div className="attr-builder-name" title={meta.desc}>{meta.label}</div>
            {!readOnly && (
              <div className="attr-builder-controls">
                <button className="attr-btn" onClick={()=>dec(k)} disabled={v<=ATTR_MIN}>−</button>
                <span className="attr-val">{v}</span>
                <button className="attr-btn" onClick={()=>inc(k)} disabled={v>=ATTR_MAX||left<=0}>+</button>
              </div>
            )}
            {readOnly && <span className="attr-val" style={{ fontFamily:'Orbitron,monospace', fontSize:13, marginRight:4 }}>{v}</span>}
            <div className="attr-bar-wrap">
              <div className="attr-bar-fill" style={{ width:`${pct}%`, background:meta.color }} />
            </div>
            <span className="attr-grade" style={{ color: RANK_COLORS[grade]||'var(--text)' }}>{grade}</span>
          </div>
        )
      })}
      <div style={{ marginTop:10, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
        {[
          { l:'HP Máx',     v:derived.hpMax,      c:'var(--green)' },
          { l:'Quirk Máx',  v:derived.quirkMax,   c:'var(--purple)' },
          { l:'Stamina Máx',v:derived.staminaMax,  c:'var(--blue)' },
        ].map(s => (
          <div key={s.l} style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:5, padding:'6px 8px', textAlign:'center' }}>
            <div style={{ fontSize:8, color:'var(--dim)', textTransform:'uppercase', letterSpacing:1, marginBottom:2 }}>{s.l}</div>
            <div style={{ fontFamily:'Orbitron,monospace', fontSize:13, fontWeight:700, color:s.c }}>{s.v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── TRAITS SELECTOR ── */
function TraitsModal({ userId, onClose }) {
  const [presets, setPresets]       = useState([])
  const [charTraits, setCharTraits] = useState([])
  const [tab, setTab]               = useState('preset')
  const [customForm, setCustomForm] = useState({ name:'', description:'', icon:'⭐', rank:'C', type:'passive' })
  const [saving, setSaving]         = useState(false)

  useEffect(() => {
    getPresetTraits().then(({ data }) => setPresets(data || []))
    getCharacterTraits(userId).then(({ data }) => setCharTraits(data || []))
  }, [])

  const acquiredIds = charTraits.map(ct => ct.trait_id)

  async function toggle(traitId) {
    if (acquiredIds.includes(traitId)) {
      await removeTraitFromCharacter(userId, traitId)
      notify('Trait removido')
    } else {
      if (charTraits.length >= 4) { notify('Máximo 4 traits por personagem', 'error'); return }
      await addTraitToCharacter(userId, traitId)
      notify('✅ Trait adquirido!')
    }
    const { data } = await getCharacterTraits(userId)
    setCharTraits(data || [])
  }

  async function createTrait() {
    if (!customForm.name.trim()) { notify('❌ Nome obrigatório','error'); return }
    setSaving(true)
    const { data, error } = await createCustomTrait(userId, customForm)
    setSaving(false)
    if (error) { notify('❌ '+error.message,'error'); return }
    setPresets(p => [...p, data])
    notify('✅ Trait criado!')
    setCustomForm({ name:'', description:'', icon:'⭐', rank:'C', type:'passive' })
  }

  const rankColor = { S:'#ff79c6', A:'var(--purple-l)', B:'var(--blue-l)', C:'var(--green-l)', D:'var(--muted)', E:'var(--dim)' }

  return (
    <Modal title="✦ Traits & Características" onClose={onClose} maxWidth={620}>
      <div style={{ fontSize:11, color:'var(--muted)', marginBottom:12 }}>
        Selecione até <strong style={{ color:'var(--gold)' }}>4 traits</strong>. Traits moldam a identidade de combate do seu personagem.
        <span style={{ color: charTraits.length>=4?'var(--red-l)':'var(--green-l)', marginLeft:8 }}>({charTraits.length}/4 selecionados)</span>
      </div>

      <div style={{ display:'flex', gap:0, borderBottom:'1px solid var(--border)', marginBottom:14 }}>
        {[{k:'preset',l:'Pré-definidos'},{k:'custom',l:'Criar Trait'}].map(t=>(
          <div key={t.k} onClick={()=>setTab(t.k)} style={{ padding:'8px 16px', cursor:'pointer', fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:11, letterSpacing:1, textTransform:'uppercase', color:tab===t.k?'var(--blue-l)':'var(--muted)', borderBottom:`2px solid ${tab===t.k?'var(--blue)':'transparent'}` }}>{t.l}</div>
        ))}
      </div>

      {tab==='preset' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {presets.map(tr => {
            const has = acquiredIds.includes(tr.id)
            return (
              <div key={tr.id} className={`trait-card ${has?'selected':''}`} onClick={()=>toggle(tr.id)}>
                <span className="trait-rank" style={{ color: rankColor[tr.rank]||'var(--text)' }}>{tr.rank}</span>
                <div style={{ fontSize:20, marginBottom:4 }}>{tr.icon}</div>
                <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:12, marginBottom:2 }}>{tr.name}</div>
                <div style={{ fontSize:10, color:'var(--muted)', lineHeight:1.4 }}>{tr.description}</div>
                <div style={{ fontSize:9, color:'var(--dim)', marginTop:4, textTransform:'uppercase', letterSpacing:1 }}>{tr.type}</div>
                {has && <div style={{ position:'absolute', top:6, left:8, fontSize:10, color:'var(--green-l)', fontWeight:700 }}>✓</div>}
              </div>
            )
          })}
        </div>
      )}

      {tab==='custom' && (
        <div>
          <div style={{ fontSize:11, color:'var(--muted)', marginBottom:12 }}>Crie um trait personalizado para seu personagem. Ele ficará disponível na lista geral.</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div className="field"><label>Nome *</label><input className="input" value={customForm.name} onChange={e=>setCustomForm(f=>({...f,name:e.target.value}))} placeholder="Ex: Sensei Natural" /></div>
            <div className="field"><label>Ícone (emoji)</label><input className="input" value={customForm.icon} onChange={e=>setCustomForm(f=>({...f,icon:e.target.value}))} placeholder="⭐" /></div>
            <div className="field"><label>Rank</label>
              <select className="input" value={customForm.rank} onChange={e=>setCustomForm(f=>({...f,rank:e.target.value}))}>
                {['E','D','C','B','A','S'].map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="field"><label>Tipo</label>
              <select className="input" value={customForm.type} onChange={e=>setCustomForm(f=>({...f,type:e.target.value}))}>
                {['passive','active','combat','quirk_boost'].map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label>Descrição / Efeito</label><textarea className="input" rows={2} value={customForm.description} onChange={e=>setCustomForm(f=>({...f,description:e.target.value}))} placeholder="Descreva o efeito..." /></div>
          <button className="btn btn-p btn-lg btn-full" onClick={createTrait} disabled={saving}>{saving?'⏳...':'✦ Criar Trait'}</button>
        </div>
      )}
    </Modal>
  )
}

/* ── EDIT MODAL ── */
function EditCharModal({ char, onClose, onSaved }) {
  const { user } = useAuth()
  const defaultAttrs = { forca:6, agilidade:6, controle:6, resistencia:6, inteligencia:6, carisma:6, stamina:6 }
  // 7 attrs * 6 = 42, sobrando 18 para distribuir — começa com mínimo
  const startAttrs = char?.attrs || defaultAttrs
  const startUsed = Object.values(startAttrs).reduce((a,b)=>a+b,0)
  // Se attrs antigas não têm stamina, add
  if (!startAttrs.stamina) startAttrs.stamina = 6

  const [form, setForm] = useState({
    name:        char?.name || '',
    alias:       char?.alias || '',
    age:         char?.age || '',
    height:      char?.height || '',
    affiliation: char?.affiliation || '',
    rank:        char?.rank || '',
    specialty:   char?.specialty || '',
    bio:         char?.bio || '',
    avatar_color:char?.avatar_color || 'purple',
  })
  const [attrs, setAttrs] = useState(startAttrs)
  const [saving, setSaving]     = useState(false)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(char?.avatar_url || null)

  function set(k,v) { setForm(f=>({...f,[k]:v})) }

  function handleAvatarChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2*1024*1024) { notify('❌ Imagem muito grande (máx 2MB)','error'); return }
    setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!form.name.trim()) { notify('❌ Nome obrigatório','error'); return }
    const used = Object.values(attrs).reduce((a,b)=>a+b,0)
    if (used > TOTAL_POINTS) { notify(`❌ Máximo ${TOTAL_POINTS} pontos de atributos (${used} usados)`,'error'); return }
    setSaving(true)
    let avatar_url = char?.avatar_url || null
    if (avatarFile) {
      const { url, error } = await uploadAvatar(user.id, avatarFile)
      if (error) notify('⚠️ Erro no upload da foto','error')
      else avatar_url = url
    }
    const derived = calcDerived(attrs)
    const payload = {
      ...form, avatar_url, attrs,
      hp_max:      derived.hpMax,
      quirk_max:   derived.quirkMax,
      stamina_max: derived.staminaMax,
      hp:          Math.min(char?.hp || derived.hpMax, derived.hpMax),
      quirk_charge:Math.min(char?.quirk_charge || derived.quirkMax, derived.quirkMax),
      stamina:     Math.min(char?.stamina || derived.staminaMax, derived.staminaMax),
      quirk_data:  char?.quirk_data || { name:'',type:'',subtype:'',level:1,range:'',weakness:'',dominio:0,carga:100,description:'',awakening:'',skills:[] },
      quirk_xp:    char?.quirk_xp || 0,
      quirk_level: char?.quirk_level || 1,
      xp:          char?.xp || 0,
      xp_max:      char?.xp_max || 1000,
    }
    const { error } = await upsertCharacter(user.id, payload)
    setSaving(false)
    if (error) { notify('❌ '+error.message,'error'); return }
    notify('✅ Personagem salvo!','success')
    onSaved(); onClose()
  }

  return (
    <Modal title={char ? '✏️ Editar Personagem' : '✦ Criar Personagem'} onClose={onClose} maxWidth={640}>
      {/* Avatar */}
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:18, padding:'12px 14px', background:'var(--panel)', borderRadius:8, border:'1px solid var(--border)' }}>
        <div style={{ position:'relative' }}>
          <div style={{ width:60, height:60, borderRadius:'50%', background:avatarBg(form.avatar_color), display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', fontFamily:'Bangers,cursive', fontSize:24, color:'#fff' }}>
            {avatarPreview ? <img src={avatarPreview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : (form.name[0]||'?').toUpperCase()}
          </div>
          <label style={{ position:'absolute', bottom:-2, right:-2, width:22, height:22, borderRadius:'50%', background:'var(--blue)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:11 }}>
            📷<input type="file" accept="image/*" style={{ display:'none' }} onChange={handleAvatarChange} />
          </label>
        </div>
        <div>
          <div style={{ fontFamily:'Bangers,cursive', fontSize:18, letterSpacing:1 }}>{form.name||'—'}</div>
          <div style={{ fontSize:9, color:'var(--gold)', letterSpacing:2 }}>{form.alias?`"${form.alias}"`:'Codinome'}</div>
          <div style={{ fontSize:9, color:'var(--muted)', marginTop:2 }}>Clique em 📷 para foto de perfil</div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div className="field"><label>Nome Real *</label><input className="input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Ex: Emi Yakumo" /></div>
        <div className="field"><label>Codinome</label><input className="input" value={form.alias} onChange={e=>set('alias',e.target.value)} placeholder='"Shadowlace"' /></div>
        <div className="field"><label>Idade</label><input className="input" value={form.age} onChange={e=>set('age',e.target.value)} /></div>
        <div className="field"><label>Altura</label><input className="input" value={form.height} onChange={e=>set('height',e.target.value)} /></div>
        <div className="field"><label>Afiliação</label><input className="input" value={form.affiliation} onChange={e=>set('affiliation',e.target.value)} placeholder="Ex: U.A. High · 2-A" /></div>
        <div className="field"><label>Rank</label><input className="input" value={form.rank} onChange={e=>set('rank',e.target.value)} placeholder="Ex: Rank B" /></div>
        <div className="field" style={{ gridColumn:'1/-1' }}><label>Especialidade</label><input className="input" value={form.specialty} onChange={e=>set('specialty',e.target.value)} /></div>
      </div>

      <div className="field">
        <label>Cor do Avatar</label>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
          {COLORS.map(c=>(
            <div key={c.key} onClick={()=>set('avatar_color',c.key)} style={{ width:26, height:26, borderRadius:'50%', background:c.bg, cursor:'pointer', border:`2px solid ${form.avatar_color===c.key?'#fff':'transparent'}`, transition:'border .15s' }} />
          ))}
        </div>
      </div>

      <div className="field"><label>Histórico / Bio</label><textarea className="input" rows={3} value={form.bio} onChange={e=>set('bio',e.target.value)} /></div>

      <div style={{ borderTop:'1px solid var(--border)', paddingTop:12, marginTop:4 }}>
        <div style={{ fontFamily:'Bangers,cursive', fontSize:14, color:'var(--blue-l)', marginBottom:10, letterSpacing:1 }}>⚡ DISTRIBUIR ATRIBUTOS</div>
        <AttrBuilder attrs={attrs} onChange={setAttrs} />
      </div>

      <div style={{ display:'flex', gap:8, marginTop:14 }}>
        <button className="btn btn-p btn-lg" onClick={handleSave} disabled={saving} style={{ flex:1 }}>{saving?'⏳ Salvando...':'💾 Salvar Personagem'}</button>
        <button className="btn btn-g" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  )
}

/* ── MAIN VIEW ── */
export default function FichaView() {
  const { user, character, refreshCharacter } = useAuth()
  const [showEdit, setShowEdit]     = useState(false)
  const [showTraits, setShowTraits] = useState(false)
  const [charTraits, setCharTraits] = useState([])

  const char = character

  useEffect(() => {
    if (user) getCharacterTraits(user.id).then(({ data }) => setCharTraits(data || []))
  }, [user, char])

  async function handleSaved() { await refreshCharacter() }

  const quirkType = char?.quirk_data?.type || ''
  const quirkBonus = QUIRK_BONUSES[quirkType]

  if (!char) return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16, color:'var(--muted)', padding:20 }}>
      <div style={{ fontSize:56 }}>🦸</div>
      <div style={{ fontFamily:'Bangers,cursive', fontSize:22, letterSpacing:2, color:'var(--blue-l)' }}>CRIE SEU PERSONAGEM</div>
      <div style={{ fontSize:13, textAlign:'center', maxWidth:280, lineHeight:1.6 }}>Distribua seus atributos, escolha sua build e dê vida ao seu herói.</div>
      <button className="btn btn-p btn-lg" onClick={()=>setShowEdit(true)}>✦ Criar Personagem</button>
      {showEdit && <EditCharModal char={null} onClose={()=>setShowEdit(false)} onSaved={handleSaved} />}
    </div>
  )

  const derived = calcDerived(char.attrs || {})
  const skills = (char.quirk_data?.skills||[]).filter(s=>!s.locked).slice(0,4)
  const rankColor = { S:'#ff79c6', A:'var(--purple-l)', B:'var(--blue-l)', C:'var(--green-l)', D:'var(--muted)', E:'var(--dim)' }

  return (
    <div style={{ flex:1, overflowY:'auto', padding:14 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, flexWrap:'wrap' }}>
        <div style={{ fontFamily:'Bangers,cursive', fontSize:20, letterSpacing:3, color:'var(--blue-l)' }}>FICHA DO HERÓI</div>
        <button className="btn btn-p btn-sm" onClick={()=>setShowEdit(true)}>✏️ Editar</button>
        <button className="btn btn-g btn-sm" onClick={()=>setShowTraits(true)}>✦ Traits ({charTraits.length}/4)</button>
      </div>

      <div className="ficha-grid" style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:12 }}>
        {/* LEFT */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div className="card">
            <div className="card-title">👤 Identidade</div>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
              <Avatar name={char.name} color={char.avatar_color} url={char.avatar_url} size={56} />
              <div>
                <div style={{ fontFamily:'Bangers,cursive', fontSize:20, letterSpacing:1 }}>{char.name}</div>
                {char.alias && <div style={{ fontSize:10, color:'var(--gold)', letterSpacing:2 }}>"{char.alias}"</div>}
                {char.rank && <span className="tag" style={{ background:'rgba(220,38,38,.2)', color:'var(--red-l)', border:'1px solid rgba(220,38,38,.3)', marginTop:4 }}>{char.rank}</span>}
              </div>
            </div>
            <table style={{ width:'100%', fontSize:11, borderCollapse:'collapse' }}>
              <tbody>
                {[{l:'Afiliação',v:char.affiliation,c:'var(--blue-l)'},{l:'Idade',v:char.age},{l:'Altura',v:char.height},{l:'Especialidade',v:char.specialty,c:'var(--purple-l)'}].filter(r=>r.v).map(r=>(
                  <tr key={r.l}><td style={{ color:'var(--dim)', paddingBottom:4, width:100, fontWeight:600 }}>{r.l}</td><td style={{ color:r.c||'var(--text)', paddingBottom:4 }}>{r.v}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-title">⚡ Atributos</div>
            {quirkBonus && <div style={{ fontSize:10, color:'var(--gold)', marginBottom:8, padding:'4px 7px', background:'rgba(255,179,0,.08)', borderRadius:4, border:'1px solid rgba(255,179,0,.2)' }}>✨ Bônus {quirkType}: <strong>{quirkBonus.label}</strong></div>}
            <AttrBuilder attrs={char.attrs||{}} onChange={()=>{}} readOnly />
          </div>

          <div className="card">
            <div className="card-title">❤️ Vitais</div>
            {[
              {l:'HP',     v:char.hp,           m:char.hp_max,      c:'var(--green)'},
              {l:'Quirk',  v:char.quirk_charge,  m:char.quirk_max,   c:'var(--purple)'},
              {l:'Stamina',v:char.stamina,        m:char.stamina_max, c:'var(--blue)'},
              {l:'EXP',    v:char.xp,             m:char.xp_max,      c:'linear-gradient(90deg,var(--blue),var(--purple))'},
            ].map(b=>{
              const p = b.m>0?Math.min(100,Math.round(b.v/b.m*100)):100
              return (
                <div key={b.l} style={{ marginBottom:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'var(--dim)', marginBottom:3 }}><span>{b.l}</span><span>{b.v}/{b.m}</span></div>
                  <div className="pbar"><div className="pbar-fill" style={{ width:`${p}%`, background:b.c }} /></div>
                </div>
              )
            })}
          </div>

          {charTraits.length > 0 && (
            <div className="card">
              <div className="card-title">✦ Traits <button className="btn btn-g btn-sm" onClick={()=>setShowTraits(true)}>Editar</button></div>
              {charTraits.map(ct=>(
                <div key={ct.id} style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:5, padding:'7px 9px', marginBottom:5 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                    <span style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:12 }}>{ct.traits?.icon} {ct.traits?.name}</span>
                    <span style={{ fontFamily:'Orbitron,monospace', fontSize:9, color: rankColor[ct.traits?.rank]||'var(--muted)' }}>{ct.traits?.rank}</span>
                  </div>
                  <div style={{ fontSize:10, color:'var(--muted)', lineHeight:1.4 }}>{ct.traits?.description}</div>
                </div>
              ))}
            </div>
          )}

          {char.bio && (
            <div className="card">
              <div className="card-title">🧠 Histórico</div>
              <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.7 }}>{char.bio}</div>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {char.quirk_data?.name ? (
            <div className="card card-purple">
              <div className="card-title" style={{ color:'var(--purple-l)' }}>✨ {char.quirk_data.name}
                <div style={{ display:'flex', gap:5, alignItems:'center' }}>
                  <span style={{ fontFamily:'Orbitron,monospace', fontSize:9, color:'var(--gold)' }}>Nv.{char.quirk_level||1}</span>
                  {char.quirk_data.type && <span className="tag" style={{ background:'rgba(124,58,237,.2)', color:'var(--purple-l)', border:'1px solid rgba(124,58,237,.3)' }}>{char.quirk_data.type}</span>}
                </div>
              </div>
              {[{l:'CARGA',v:char.quirk_data.carga||100,c:'linear-gradient(90deg,var(--purple),var(--blue-l))',vc:'var(--purple-l)'},{l:'DOMÍNIO',v:char.quirk_data.dominio||0,c:'linear-gradient(90deg,var(--gold-d),var(--gold))',vc:'var(--gold)'}].map(b=>(
                <div key={b.l} style={{ marginBottom:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'var(--dim)', marginBottom:3 }}><span>{b.l}</span><span style={{ color:b.vc }}>{b.v}%</span></div>
                  <div className="pbar" style={{ height:7 }}><div className="pbar-fill" style={{ width:`${b.v}%`, background:b.c, borderRadius:4 }} /></div>
                </div>
              ))}
              {char.quirk_data.description && <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.6, marginBottom:10 }}>{char.quirk_data.description}</div>}
              {char.quirk_data.awakening && (
                <div style={{ background:'rgba(255,179,0,.06)', border:'1px solid rgba(255,179,0,.2)', borderRadius:5, padding:8 }}>
                  <div style={{ fontSize:9, color:'var(--gold)', fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:3 }}>⚡ Awakening</div>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>{char.quirk_data.awakening}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="card card-glow">
              <div className="card-title">✨ Quirk</div>
              <div style={{ fontSize:11, color:'var(--muted)' }}>Configure seu Quirk no menu <strong>Quirk & Habilidades</strong>.</div>
            </div>
          )}

          {skills.length > 0 && (
            <div className="card">
              <div className="card-title">⚔️ Técnicas</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {skills.map((s,i)=>(
                  <div key={i} style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:5, padding:'8px 10px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                      <span style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:12 }}>{s.icon||'⚡'} {s.name}</span>
                      <span style={{ fontFamily:'Orbitron,monospace', fontSize:9, color:'var(--gold)' }}>Nv.{s.level}</span>
                    </div>
                    <div style={{ fontFamily:'Orbitron,monospace', fontSize:9, color:'var(--red-l)', marginBottom:2 }}>{s.cost}</div>
                    <div style={{ fontSize:10, color:'var(--muted)', lineHeight:1.4 }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showEdit   && <EditCharModal char={char} onClose={()=>setShowEdit(false)} onSaved={handleSaved} />}
      {showTraits && <TraitsModal userId={user.id} onClose={()=>{ setShowTraits(false); if(user) getCharacterTraits(user.id).then(({data})=>setCharTraits(data||[])) }} />}
    </div>
  )
}
