import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getNpcs, upsertNpc, deleteNpc, uploadToBucket } from '../../lib/supabase'
import { notify } from '../../components/Toast'
import Modal from '../../components/Modal'
import Avatar, { avatarBg } from '../../components/Avatar'

const COLORS = [
  {key:'gray',  bg:'linear-gradient(135deg,#374151,#1f2937)'},
  {key:'red',   bg:'linear-gradient(135deg,#dc2626,#991b1b)'},
  {key:'blue',  bg:'linear-gradient(135deg,#2563eb,#1d4ed8)'},
  {key:'green', bg:'linear-gradient(135deg,#16a34a,#15803d)'},
  {key:'purple',bg:'linear-gradient(135deg,#7c3aed,#5b21b6)'},
  {key:'gold',  bg:'linear-gradient(135deg,#d97706,#b45309)'},
  {key:'pink',  bg:'linear-gradient(135deg,#db2777,#be185d)'},
  {key:'teal',  bg:'linear-gradient(135deg,#0891b2,#0e7490)'},
]

const ROLE_STYLE = {
  npc:      { bg:'rgba(37,99,235,.15)',   c:'var(--blue-l)',   label:'NPC'      },
  villain:  { bg:'rgba(220,38,38,.15)',   c:'var(--red-l)',    label:'Vilão'    },
  hero_npc: { bg:'rgba(22,163,74,.15)',   c:'var(--green-l)',  label:'Herói'    },
  neutral:  { bg:'rgba(255,179,0,.15)',   c:'var(--gold)',     label:'Neutro'   },
}

function NpcModal({ npc, onClose, onSaved }) {
  const { user } = useAuth()
  const [form, setForm] = useState({
    name:        npc?.name        || '',
    alias:       npc?.alias       || '',
    description: npc?.description || '',
    role:        npc?.role        || 'npc',
    quirk_name:  npc?.quirk_name  || '',
    avatar_color:npc?.avatar_color|| 'gray',
  })
  const [imgFile, setImgFile]     = useState(null)
  const [preview, setPreview]     = useState(npc?.avatar_url || null)
  const [saving, setSaving]       = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function handleImg(e) {
    const file = e.target.files[0]; if (!file) return
    if (file.size > 3 * 1024 * 1024) { notify('❌ Máx 3MB', 'error'); return }
    setImgFile(file); setPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!form.name.trim()) { notify('❌ Nome obrigatório', 'error'); return }
    setSaving(true)
    let avatar_url = npc?.avatar_url || null
    if (imgFile) {
      const { url, error } = await uploadToBucket('npcs', user.id, imgFile)
      if (error) notify('⚠️ Erro no upload', 'error')
      else avatar_url = url
    }
    const payload = { ...form, avatar_url, created_by: user.id }
    if (npc?.id) payload.id = npc.id
    const { error } = await upsertNpc(payload)
    setSaving(false)
    if (error) { notify('❌ ' + error.message, 'error'); return }
    notify('✅ NPC salvo!', 'success'); onSaved()
  }

  const rs = ROLE_STYLE[form.role] || ROLE_STYLE.npc

  return (
    <Modal title={npc ? '✏️ Editar NPC' : '+ Novo NPC'} onClose={onClose}>
      {/* Preview */}
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:18, padding:'12px 14px', background:'var(--panel)', borderRadius:8, border:'1px solid var(--border)' }}>
        <div style={{ position:'relative' }}>
          <div style={{ width:64, height:64, borderRadius:'50%', background:avatarBg(form.avatar_color), display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Bangers,cursive', fontSize:26, color:'#fff', overflow:'hidden', border:`2px solid ${rs.c}` }}>
            {preview
              ? <img src={preview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : (form.name[0] || '?').toUpperCase()
            }
          </div>
          <label style={{ position:'absolute', bottom:-2, right:-2, width:22, height:22, borderRadius:'50%', background:'var(--blue)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:11 }}>
            📷<input type="file" accept="image/*" style={{ display:'none' }} onChange={handleImg} />
          </label>
        </div>
        <div>
          <div style={{ fontFamily:'Bangers,cursive', fontSize:18, letterSpacing:1 }}>{form.name || '—'}</div>
          {form.alias && <div style={{ fontSize:10, color:'var(--gold)', letterSpacing:1 }}>"{form.alias}"</div>}
          <span style={{ fontSize:8, fontWeight:700, padding:'2px 6px', borderRadius:3, background:rs.bg, color:rs.c, display:'inline-block', marginTop:3, textTransform:'uppercase' }}>{rs.label}</span>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div className="field"><label>Nome *</label><input className="input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Ex: All For One" /></div>
        <div className="field"><label>Alias / Título</label><input className="input" value={form.alias} onChange={e=>set('alias',e.target.value)} placeholder='Ex: "O Grande Mal"' /></div>
        <div className="field"><label>Tipo / Papel</label>
          <select className="input" value={form.role} onChange={e=>set('role',e.target.value)}>
            <option value="npc">NPC</option>
            <option value="villain">Vilão</option>
            <option value="hero_npc">Herói (NPC)</option>
            <option value="neutral">Neutro</option>
          </select>
        </div>
        <div className="field"><label>Quirk / Habilidade</label><input className="input" value={form.quirk_name} onChange={e=>set('quirk_name',e.target.value)} placeholder="Ex: All For One" /></div>
      </div>

      <div className="field">
        <label>Cor do Avatar</label>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
          {COLORS.map(c => (
            <div key={c.key} onClick={() => set('avatar_color', c.key)} style={{ width:26, height:26, borderRadius:'50%', background:c.bg, cursor:'pointer', border:`2px solid ${form.avatar_color===c.key?'#fff':'transparent'}`, transition:'border .15s' }} />
          ))}
        </div>
      </div>

      <div className="field"><label>Descrição / Lore</label><textarea className="input" rows={3} value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Background, motivações, personalidade..." /></div>

      <div style={{ display:'flex', gap:6 }}>
        <button className="btn btn-p btn-lg" onClick={handleSave} disabled={saving} style={{ flex:1 }}>{saving ? '⏳ Salvando...' : '💾 Salvar NPC'}</button>
        {npc && <button className="btn btn-danger" onClick={async () => { if (!confirm('Remover NPC?')) return; await deleteNpc(npc.id); notify('🗑️ Removido'); onSaved() }}>🗑️</button>}
        <button className="btn btn-g" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  )
}

function NpcDetailModal({ npc, onClose, onEdit }) {
  const rs = ROLE_STYLE[npc.role] || ROLE_STYLE.npc
  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:440 }}>
        <div className="modal-hdr">
          <div className="modal-title">🎭 {npc.name}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ textAlign:'center', marginBottom:16 }}>
          <div style={{ width:90, height:90, borderRadius:'50%', background:avatarBg(npc.avatar_color||'gray'), margin:'0 auto 10px', overflow:'hidden', border:`3px solid ${rs.c}`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Bangers,cursive', fontSize:36, color:'#fff' }}>
            {npc.avatar_url
              ? <img src={npc.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : npc.name[0]
            }
          </div>
          <div style={{ fontFamily:'Bangers,cursive', fontSize:22, letterSpacing:2 }}>{npc.name}</div>
          {npc.alias && <div style={{ fontSize:11, color:'var(--gold)', letterSpacing:2, marginTop:2 }}>"{npc.alias}"</div>}
          <span style={{ fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:3, background:rs.bg, color:rs.c, display:'inline-block', marginTop:6, textTransform:'uppercase', letterSpacing:1 }}>{rs.label}</span>
        </div>

        {npc.quirk_name && (
          <div style={{ background:'rgba(124,58,237,.08)', border:'1px solid rgba(124,58,237,.3)', borderRadius:6, padding:'8px 12px', marginBottom:10, textAlign:'center' }}>
            <div style={{ fontSize:9, color:'var(--purple-l)', letterSpacing:2, textTransform:'uppercase', marginBottom:2 }}>✨ Quirk</div>
            <div style={{ fontFamily:'Bangers,cursive', fontSize:16, color:'var(--purple-l)', letterSpacing:1 }}>{npc.quirk_name}</div>
          </div>
        )}

        {npc.description && (
          <div style={{ fontSize:12, color:'var(--muted)', lineHeight:1.7, marginBottom:14 }}>{npc.description}</div>
        )}

        <div style={{ display:'flex', gap:6 }}>
          <button className="btn btn-p btn-sm" style={{ flex:1 }} onClick={onEdit}>✏️ Editar</button>
          <button className="btn btn-g btn-sm" style={{ flex:1 }} onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

export default function NpcsView() {
  const [npcs, setNpcs]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editNpc, setEditNpc]     = useState(null)
  const [detailNpc, setDetailNpc] = useState(null)
  const [filter, setFilter]       = useState('all')

  async function load() {
    setLoading(true)
    const { data } = await getNpcs()
    if (data) setNpcs(data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = filter === 'all' ? npcs : npcs.filter(n => n.role === filter)

  return (
    <div style={{ flex:1, overflowY:'auto', padding:14 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, flexWrap:'wrap' }}>
        <div style={{ fontFamily:'Bangers,cursive', fontSize:20, letterSpacing:3, color:'var(--text)' }}>🎭 NPCs</div>
        <div style={{ fontSize:11, color:'var(--muted)' }}>{npcs.length} personagens</div>
        <div style={{ display:'flex', gap:4, marginLeft:8 }}>
          {[{k:'all',l:'Todos'},{k:'npc',l:'NPCs'},{k:'villain',l:'Vilões'},{k:'hero_npc',l:'Heróis'},{k:'neutral',l:'Neutros'}].map(f => (
            <button key={f.k} className={`btn btn-sm ${filter===f.k?'btn-p':'btn-g'}`} onClick={() => setFilter(f.k)}>{f.l}</button>
          ))}
        </div>
        <button className="btn btn-p btn-sm" style={{ marginLeft:'auto' }} onClick={() => { setEditNpc(null); setShowModal(true) }}>+ Novo NPC</button>
      </div>

      {loading && <div style={{ textAlign:'center', padding:40 }}><div className="spinner" style={{ margin:'0 auto' }} /></div>}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign:'center', padding:40, color:'var(--muted)' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>🎭</div>
          <div style={{ fontFamily:'Bangers,cursive', fontSize:18, letterSpacing:2, color:'var(--blue-l)', marginBottom:8 }}>
            {filter==='all' ? 'NENHUM NPC CRIADO' : 'NENHUM NPC NESTA CATEGORIA'}
          </div>
          {filter==='all' && <>Crie NPCs para dar vida ao servidor. Narradores podem vestir um NPC e enviar mensagens como ele no chat dos locais.<br/><button className="btn btn-p btn-lg" style={{ marginTop:16 }} onClick={() => { setEditNpc(null); setShowModal(true) }}>+ Criar Primeiro NPC</button></>}
        </div>
      )}

      <div className="npc-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {filtered.map(npc => {
          const rs = ROLE_STYLE[npc.role] || ROLE_STYLE.npc
          return (
            <div key={npc.id} className="npc-card" onClick={() => setDetailNpc(npc)}>
              {npc.avatar_url
                ? <img src={npc.avatar_url} alt="" className="npc-cover" />
                : <div className="npc-cover-placeholder" style={{ background:avatarBg(npc.avatar_color||'gray') }}>{npc.name[0]}</div>
              }
              <div className="npc-body">
                <div className="npc-name">{npc.name}</div>
                <span className="npc-role-badge" style={{ background:rs.bg, color:rs.c }}>{rs.label}</span>
                {npc.alias && <div style={{ fontSize:9, color:'var(--gold)', marginBottom:4 }}>"{npc.alias}"</div>}
                {npc.quirk_name && <div style={{ fontSize:10, color:'var(--purple-l)', marginBottom:4 }}>✨ {npc.quirk_name}</div>}
                {npc.description && <div className="npc-desc">{npc.description.slice(0, 80)}{npc.description.length > 80 ? '...' : ''}</div>}
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <NpcModal
          npc={editNpc}
          onClose={() => { setShowModal(false); setEditNpc(null) }}
          onSaved={() => { load(); setShowModal(false); setEditNpc(null) }}
        />
      )}

      {detailNpc && (
        <NpcDetailModal
          npc={detailNpc}
          onClose={() => setDetailNpc(null)}
          onEdit={() => { setEditNpc(detailNpc); setDetailNpc(null); setShowModal(true) }}
        />
      )}
    </div>
  )
}
