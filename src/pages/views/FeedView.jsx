import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getFeedPosts, createPost, deletePost, likePost, getNews, createNews, deleteNews, getEvents, createEvent, deleteEvent, getAllProfiles, supabase } from '../../lib/supabase'
import { notify } from '../../components/Toast'
import Modal from '../../components/Modal'
import Avatar from '../../components/Avatar'

const NEWS_COLORS = {
  URGENTE:  { bg:'rgba(220,38,38,.2)',  c:'var(--red-l)' },
  EVENTO:   { bg:'rgba(242,183,5,.2)',  c:'var(--gold)' },
  UPDATE:   { bg:'rgba(37,99,235,.2)',  c:'var(--blue-l)' },
  CONQUISTA:{ bg:'rgba(22,163,74,.2)',  c:'var(--green-l)' },
  ESPECIAL: { bg:'rgba(124,58,237,.2)', c:'var(--purple-l)' },
}

export default function FeedView() {
  const { user, profile, character } = useAuth()
  const [posts, setPosts] = useState([])
  const [news, setNews] = useState([])
  const [events, setEvents] = useState([])
  const [online, setOnline] = useState([])
  const [text, setText] = useState('')
  const [showNews, setShowNews] = useState(false)
  const [showEvent, setShowEvent] = useState(false)

  async function load() {
    const [{ data: p }, { data: n }, { data: e }, { data: pr }] = await Promise.all([
      getFeedPosts(), getNews(), getEvents(), getAllProfiles()
    ])
    if (p) setPosts(p)
    if (n) setNews(n)
    if (e) setEvents(e)
    if (pr) setOnline(pr.filter(x=>x.is_online))
  }

  useEffect(() => {
    load()
    const ch = supabase.channel('feed-rt')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'feed_posts' }, () => load())
      .subscribe()
    return () => ch.unsubscribe()
  }, [])

  async function handlePost() {
    if (!text.trim()) return
    const char = character
    const { error } = await createPost({
      user_id: user.id,
      author_name: char?.name || profile?.username || 'Herói',
      author_alias: char?.alias || '',
      author_color: char?.avatar_color || 'purple',
      content: text.trim()
    })
    if (error) { notify('❌ Erro ao publicar','error'); return }
    setText(''); load()
  }

  return (
    <div style={{ flex:1, overflowY:'auto', padding:14 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 265px', gap:14 }}>
        <div>
          {/* Compose */}
          <div className="card" style={{ marginBottom:10 }}>
            <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
              <Avatar name={character?.name||profile?.username} color={character?.avatar_color} url={character?.avatar_url} size={34} />
              <div style={{ flex:1 }}>
                <textarea className="input" rows={2} value={text} onChange={e=>setText(e.target.value)} placeholder="Compartilhe algo com a guilda..." style={{ marginBottom:5 }} />
                <button className="btn btn-p btn-sm" onClick={handlePost}>📝 Publicar</button>
              </div>
            </div>
          </div>

          {posts.length === 0 && <div style={{ textAlign:'center', padding:24, color:'var(--muted)', fontSize:12 }}>Sem posts. Escreva algo!</div>}

          {posts.map(p => (
            <div key={p.id} className="card" style={{ marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:9 }}>
                <Avatar name={p.author_name} color={p.author_color} size={34} />
                <div>
                  <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:13 }}>{p.author_name}{p.author_alias?` (${p.author_alias})`:''}</div>
                  <div style={{ fontSize:10, color:'var(--dim)' }}>{new Date(p.created_at).toLocaleString('pt-BR')}</div>
                </div>
                {p.user_id===user.id && (
                  <button onClick={async()=>{if(!confirm('Remover post?'))return;await deletePost(p.id);load()}} style={{ marginLeft:'auto', background:'transparent', border:'none', color:'var(--dim)', cursor:'pointer' }}>🗑️</button>
                )}
              </div>
              <div style={{ fontSize:12, color:'var(--muted)', lineHeight:1.65, marginBottom:9, whiteSpace:'pre-wrap' }}>{p.content}</div>
              <div style={{ display:'flex', gap:5, borderTop:'1px solid var(--border)', paddingTop:7 }}>
                <button className="btn btn-g btn-sm" onClick={async()=>{await likePost(p.id,p.likes);load()}}>👍 {p.likes||0}</button>
              </div>
            </div>
          ))}
        </div>

        <div>
          <div className="card" style={{ marginBottom:10 }}>
            <div className="card-title">📰 Notícias <button className="btn btn-g btn-sm" onClick={()=>setShowNews(true)}>+ Add</button></div>
            {news.length===0 && <div style={{ fontSize:10, color:'var(--dim)' }}>Sem notícias.</div>}
            {news.map(n=>{
              const c = NEWS_COLORS[n.type]||NEWS_COLORS.UPDATE
              return (
                <div key={n.id} style={{ padding:'6px 0', borderBottom:'1px solid rgba(42,42,106,.4)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div>
                      <span style={{ fontSize:7, fontWeight:700, padding:'1px 5px', borderRadius:3, textTransform:'uppercase', background:c.bg, color:c.c, display:'inline-block', marginBottom:3 }}>{n.type}</span>
                      <div style={{ fontSize:11, fontWeight:600, color:'var(--text)', lineHeight:1.3 }}>{n.title}</div>
                      <div style={{ fontSize:9, color:'var(--dim)' }}>{n.time_label}</div>
                    </div>
                    <button onClick={async()=>{await deleteNews(n.id);load()}} style={{ background:'transparent', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:11 }}>✕</button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="card" style={{ marginBottom:10 }}>
            <div className="card-title">🌟 Eventos <button className="btn btn-g btn-sm" onClick={()=>setShowEvent(true)}>+ Add</button></div>
            {events.length===0 && <div style={{ fontSize:10, color:'var(--dim)' }}>Sem eventos.</div>}
            {events.map(ev=>(
              <div key={ev.id} style={{ background:'var(--panel)', border:'1px solid rgba(242,183,5,.25)', borderRadius:5, padding:8, marginBottom:6 }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:12, color:'var(--gold)' }}>{ev.name}</div>
                  <button onClick={async()=>{await deleteEvent(ev.id);load()}} style={{ background:'transparent', border:'none', color:'var(--dim)', cursor:'pointer' }}>✕</button>
                </div>
                {ev.description && <div style={{ fontSize:10, color:'var(--muted)', marginBottom:4 }}>{ev.description}</div>}
                <div style={{ height:4, background:'var(--border)', borderRadius:2, overflow:'hidden' }}><div style={{ height:'100%', width:`${ev.progress||0}%`, background:'var(--gold)', borderRadius:2 }}/></div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-title">👥 Online ({online.length})</div>
            {online.map(p=>(
              <div key={p.id} className="player-row">
                <Avatar name={p.characters?.[0]?.name||p.username} color={p.characters?.[0]?.avatar_color} url={p.characters?.[0]?.avatar_url||p.avatar_url} size={26} ring="online" />
                <div className="p-info"><div className="p-name">{p.username}</div><div className="p-char">{p.characters?.[0]?.name||'—'}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showNews && <NewsModal onClose={()=>setShowNews(false)} onSaved={()=>{load();setShowNews(false)}} userId={user.id} />}
      {showEvent && <EventModal onClose={()=>setShowEvent(false)} onSaved={()=>{load();setShowEvent(false)}} userId={user.id} />}
    </div>
  )
}

function NewsModal({ onClose, onSaved, userId }) {
  const [form, setForm] = useState({ type:'UPDATE', title:'', time_label: new Date().toLocaleString('pt-BR') })
  async function handle(){
    if(!form.title.trim()){notify('❌ Título obrigatório','error');return}
    const { error } = await createNews({ ...form, created_by:userId })
    if(error){notify('❌ '+error.message,'error');return}
    notify('✅ Notícia adicionada!','success'); onSaved()
  }
  return (
    <Modal title="+ Notícia" onClose={onClose} maxWidth={420}>
      <div className="field"><label>Tipo</label>
        <select className="input" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
          {['URGENTE','EVENTO','UPDATE','CONQUISTA','ESPECIAL'].map(t=><option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="field"><label>Título</label><input className="input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} /></div>
      <div className="field"><label>Data/Horário</label><input className="input" value={form.time_label} onChange={e=>setForm(f=>({...f,time_label:e.target.value}))} /></div>
      <div style={{ display:'flex', gap:6 }}>
        <button className="btn btn-p btn-lg" onClick={handle} style={{ flex:1 }}>💾 Adicionar</button>
        <button className="btn btn-g" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  )
}

function EventModal({ onClose, onSaved, userId }) {
  const [form, setForm] = useState({ name:'', description:'', progress:50 })
  async function handle(){
    if(!form.name.trim()){notify('❌ Nome obrigatório','error');return}
    const { error } = await createEvent({ ...form, progress:Number(form.progress), created_by:userId })
    if(error){notify('❌ '+error.message,'error');return}
    notify('✅ Evento adicionado!','success'); onSaved()
  }
  return (
    <Modal title="+ Evento" onClose={onClose} maxWidth={420}>
      <div className="field"><label>Nome</label><input className="input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} /></div>
      <div className="field"><label>Descrição</label><textarea className="input" rows={2} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} /></div>
      <div className="field"><label>% Progresso</label><input className="input" type="number" min={0} max={100} value={form.progress} onChange={e=>setForm(f=>({...f,progress:e.target.value}))} /></div>
      <div style={{ display:'flex', gap:6 }}>
        <button className="btn btn-p btn-lg" onClick={handle} style={{ flex:1 }}>💾 Adicionar</button>
        <button className="btn btn-g" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  )
}
