import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getLocations, upsertLocation, deleteLocation, getMessages, sendMessage, supabase, updateServerConfig, getServerConfig } from '../../lib/supabase'
import { notify } from '../../components/Toast'
import Avatar, { TEXT_COLOR } from '../../components/Avatar'
import Modal from '../../components/Modal'

export default function ExploreView() {
  const { user, profile, character } = useAuth()
  const [locations, setLocations] = useState([])
  const [currentLoc, setCurrentLoc] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [showAddLoc, setShowAddLoc] = useState(false)
  const [editLoc, setEditLoc] = useState(null)
  const [serverConfig, setServerConfig] = useState(null)
  const subRef = useRef(null)
  const endRef = useRef(null)

  async function loadLocs() {
    const { data } = await getLocations()
    if (data) setLocations(data)
  }

  useEffect(() => {
    loadLocs()
    getServerConfig().then(({ data }) => setServerConfig(data))
  }, [])

  useEffect(() => {
    if (!currentLoc) return
    getMessages(currentLoc.id, 60).then(({ data }) => setMessages(data || []))
    if (subRef.current) subRef.current.unsubscribe()
    subRef.current = supabase
      .channel(`explore-msgs-${currentLoc.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `location_id=eq.${currentLoc.id}` }, ({ new: msg }) => {
        setMessages(prev => [...prev, msg])
      })
      .subscribe()
    return () => { if (subRef.current) subRef.current.unsubscribe() }
  }, [currentLoc?.id])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function handleSend() {
    if (!text.trim() || !currentLoc || !user) return
    const char = character
    await sendMessage({
      location_id: currentLoc.id,
      user_id: user.id,
      author_name: char?.name || profile?.username || 'Herói',
      author_alias: char?.alias || '',
      author_color: char?.avatar_color || 'purple',
      content: text.trim(),
      mode: 'rp'
    })
    setText('')
  }

  async function handleEnterScene() {
    if (!currentLoc || !serverConfig) return
    const { error } = await updateServerConfig(serverConfig.id, {
      scene_name: currentLoc.name,
      scene_desc: currentLoc.description || '',
      scene_tags: [currentLoc.status || 'Livre']
    })
    if (!error) notify(`🎭 Cena definida: ${currentLoc.name}`, 'success')
    else notify('❌ Erro ao atualizar cena', 'error')
  }

  const cats = {}
  locations.forEach(loc => {
    const c = loc.category || 'Geral'
    if (!cats[c]) cats[c] = []
    cats[c].push(loc)
  })

  return (
    <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', height:'calc(100vh - 46px)', overflow:'hidden' }}>
      {/* Sidebar */}
      <div style={{ background:'var(--card)', borderRight:'1px solid var(--border)', overflowY:'auto' }}>
        <div style={{ padding:'8px 11px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontFamily:'Bangers,cursive', fontSize:11, letterSpacing:1, color:'var(--muted)', textTransform:'uppercase' }}>Locais</span>
          <button className="btn btn-g btn-sm" onClick={() => setShowAddLoc(true)}>+ Add</button>
        </div>
        {Object.keys(cats).length === 0 && (
          <div style={{ padding:12, fontSize:10, color:'var(--dim)' }}>Sem locais. Clique em "+ Add".</div>
        )}
        {Object.keys(cats).map(cat => (
          <div key={cat}>
            <div style={{ padding:'8px 11px 3px', fontFamily:'Bangers,cursive', fontSize:10, letterSpacing:2, color:'var(--dim)', textTransform:'uppercase' }}>{cat}</div>
            {cats[cat].map(loc => (
              <div key={loc.id}
                onClick={() => setCurrentLoc(loc)}
                style={{ padding:'8px 11px', borderBottom:'1px solid rgba(42,42,106,.4)', cursor:'pointer', transition:'all .2s', borderLeft:`2px solid ${currentLoc?.id===loc.id?'var(--blue)':'transparent'}`, background: currentLoc?.id===loc.id?'rgba(37,99,235,.09)':'transparent' }}>
                <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:12, color:'var(--text)', marginBottom:1 }}>{loc.icon||'🗺️'} {loc.name}</div>
                <div style={{ fontSize:9, color:'var(--muted)' }}>{loc.status||'Livre'}</div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Main area */}
      <div style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Banner */}
        <div style={{ height:130, background:'linear-gradient(135deg,#080822,#101040)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:4, position:'relative', overflow:'hidden', flexShrink:0 }}>
          <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 50% 110%,rgba(37,99,235,.18),transparent 65%)' }}/>
          <div style={{ fontSize:38, position:'relative', zIndex:1 }}>{currentLoc?.icon||'🗺️'}</div>
          <div style={{ fontFamily:'Bangers,cursive', fontSize:24, letterSpacing:3, position:'relative', zIndex:1 }}>{currentLoc?.name||'Selecione um local'}</div>
          <div style={{ fontSize:9, color:'var(--muted)', letterSpacing:2, textTransform:'uppercase', position:'relative', zIndex:1 }}>{currentLoc?.description||'Clique em um local à esquerda'}</div>
        </div>

        {/* Toolbar */}
        <div style={{ padding:'6px 11px', borderBottom:'1px solid var(--border)', background:'var(--card)', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <span style={{ fontSize:9, color:'var(--muted)' }}>
            {currentLoc ? `${currentLoc.meta||''} · ${currentLoc.status||'Livre'}` : '—'}
          </span>
          <div style={{ display:'flex', gap:5 }}>
            {currentLoc && <>
              <button className="btn btn-g btn-sm" onClick={() => setEditLoc(currentLoc)}>✏️</button>
              <button className="btn btn-g btn-sm" style={{ color:'var(--red-l)' }} onClick={async () => {
                if (!confirm('Remover este local?')) return
                await deleteLocation(currentLoc.id); setCurrentLoc(null); loadLocs(); notify('🗑️ Local removido')
              }}>🗑️</button>
              <button className="btn btn-p btn-sm" onClick={handleEnterScene}>Usar como Cena</button>
            </>}
          </div>
        </div>

        {/* Messages */}
        <div className="msgs" style={{ flex:1 }}>
          {!currentLoc && <div style={{ textAlign:'center', padding:20, color:'var(--dim)', fontSize:12 }}>Selecione um local para ver as mensagens.</div>}
          {currentLoc && messages.length === 0 && <div style={{ textAlign:'center', padding:20, color:'var(--dim)', fontSize:12 }}>Sem mensagens aqui ainda. Comece o RP!</div>}
          {messages.map((msg, i) => {
            const isMe = msg.user_id === user?.id
            return (
              <div key={msg.id||i} className="msg">
                <Avatar name={msg.author_name} color={msg.author_color||'purple'} size={28} />
                <div className="msg-body">
                  <div className="msg-head">
                    <span className="msg-name" style={{ color: TEXT_COLOR[msg.author_color]||'var(--text)' }}>{msg.author_name}</span>
                    {msg.author_alias && <span className="tag" style={{ background:'rgba(124,58,237,.15)', color:'var(--purple-l)', border:'1px solid rgba(124,58,237,.3)', fontSize:7 }}>{msg.author_alias}</span>}
                    {isMe && <span className="tag" style={{ background:'rgba(37,99,235,.15)', color:'var(--blue-l)', border:'1px solid rgba(37,99,235,.25)', fontSize:7 }}>VOCÊ</span>}
                    <span className="msg-time">{new Date(msg.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>
                  </div>
                  <div className="msg-text msg-rp">{msg.content}</div>
                </div>
              </div>
            )
          })}
          <div ref={endRef}/>
        </div>

        {/* Input */}
        <div className="inp-wrap" style={{ flexShrink:0 }}>
          <div className="inp-row">
            <textarea className="tinp" rows={2} value={text} onChange={e=>setText(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend()}}}
              placeholder={currentLoc?`Interaja em ${currentLoc.name}...`:'Selecione um local para interagir'}
              disabled={!currentLoc} />
            <button className="send-btn" onClick={handleSend} disabled={!currentLoc}>↑</button>
          </div>
        </div>
      </div>

      {/* Add/Edit modal */}
      {(showAddLoc || editLoc) && (
        <LocationModal
          loc={editLoc}
          onClose={() => { setShowAddLoc(false); setEditLoc(null) }}
          onSaved={() => { loadLocs(); setShowAddLoc(false); setEditLoc(null) }}
        />
      )}
    </div>
  )
}

function LocationModal({ loc, onClose, onSaved }) {
  const { user } = useAuth()
  const [form, setForm] = useState({
    name: loc?.name||'', icon: loc?.icon||'🗺️', category: loc?.category||'',
    status: loc?.status||'Livre', description: loc?.description||'', meta: loc?.meta||''
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.name.trim()) { notify('❌ Nome obrigatório','error'); return }
    setSaving(true)
    const payload = { ...form, created_by: user.id }
    if (loc?.id) payload.id = loc.id
    const { error } = await upsertLocation(payload)
    setSaving(false)
    if (error) { notify('❌ Erro: '+error.message,'error'); return }
    notify('✅ Local salvo!','success'); onSaved()
  }

  return (
    <Modal title={loc ? '✏️ Editar Local' : '+ Novo Local'} onClose={onClose}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div className="field"><label>Nome *</label><input className="input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Ex: Sala 2-A" /></div>
        <div className="field"><label>Ícone (emoji)</label><input className="input" value={form.icon} onChange={e=>setForm(f=>({...f,icon:e.target.value}))} placeholder="🏫" /></div>
        <div className="field"><label>Categoria</label><input className="input" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} placeholder="Ex: U.A. High" /></div>
        <div className="field"><label>Status</label><input className="input" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} placeholder="Livre, Restrito, Em uso..." /></div>
      </div>
      <div className="field"><label>Descrição</label><textarea className="input" rows={2} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Descreva o local..." /></div>
      <div className="field"><label>Info extra (ex: 3 online · RP Livre)</label><input className="input" value={form.meta} onChange={e=>setForm(f=>({...f,meta:e.target.value}))} /></div>
      <div style={{ display:'flex', gap:6 }}>
        <button className="btn btn-p btn-lg" onClick={handleSave} disabled={saving} style={{ flex:1 }}>{saving?'⏳ Salvando...':'💾 Salvar'}</button>
        <button className="btn btn-g" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  )
}
