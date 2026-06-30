import { useState, useEffect } from 'react'
import { getAllProfiles, supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import Avatar from '../../components/Avatar'

function gradeLabel(v) {
  if (v >= 90) return 'S'; if (v >= 75) return 'A'; if (v >= 60) return 'B'
  if (v >= 45) return 'C'; if (v >= 30) return 'D'; return 'E'
}

export default function PlayersView() {
  const { user } = useAuth()
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  async function load() {
    setLoading(true)
    const { data } = await getAllProfiles()
    if (data) setPlayers(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
    const ch = supabase
      .channel('players-view')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, load)
      .subscribe()
    return () => ch.unsubscribe()
  }, [])

  const filtered = players.filter(p =>
    !search ||
    p.username?.toLowerCase().includes(search.toLowerCase()) ||
    p.characters?.[0]?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const online = filtered.filter(p => p.is_online)
  const offline = filtered.filter(p => !p.is_online)

  return (
    <div style={{ flex:1, overflowY:'auto', padding:14 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
        <div style={{ fontFamily:'Bangers,cursive', fontSize:20, letterSpacing:3, color:'var(--text)' }}>JOGADORES</div>
        <div style={{ fontSize:10, color:'var(--muted)' }}>{players.length} membros · {players.filter(p=>p.is_online).length} online</div>
        <input className="input" style={{ marginLeft:'auto', width:180 }} placeholder="🔍 Buscar..." value={search} onChange={e=>setSearch(e.target.value)} />
        <button className="btn btn-g btn-sm" onClick={load}>↻</button>
      </div>

      {loading && <div style={{ textAlign:'center', padding:40, color:'var(--muted)' }}><div className="spinner" style={{ margin:'0 auto 12px' }}/> Carregando...</div>}

      {online.length > 0 && <>
        <div style={{ fontFamily:'Bangers,cursive', fontSize:12, letterSpacing:2, color:'var(--green-l)', marginBottom:8 }}>🟢 ONLINE ({online.length})</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
          {online.map(p => <PlayerCard key={p.id} p={p} isMe={p.id===user?.id} onSelect={()=>setSelected(p)} />)}
        </div>
      </>}
      {offline.length > 0 && <>
        <div style={{ fontFamily:'Bangers,cursive', fontSize:12, letterSpacing:2, color:'var(--dim)', marginBottom:8 }}>⚫ OFFLINE ({offline.length})</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
          {offline.map(p => <PlayerCard key={p.id} p={p} isMe={p.id===user?.id} onSelect={()=>setSelected(p)} />)}
        </div>
      </>}

      {selected && <PlayerDetailModal p={selected} onClose={()=>setSelected(null)} isMe={selected.id===user?.id} />}
    </div>
  )
}

function PlayerCard({ p, isMe, onSelect }) {
  const char = p.characters?.[0]
  return (
    <div onClick={onSelect} style={{ background:'var(--card)', border:`1px solid ${isMe?'rgba(124,58,237,.4)':'var(--border)'}`, borderRadius:9, padding:13, cursor:'pointer', transition:'all .2s' }}
      onMouseEnter={e=>e.currentTarget.style.borderColor='var(--glow)'}
      onMouseLeave={e=>e.currentTarget.style.borderColor=isMe?'rgba(124,58,237,.4)':'var(--border)'}
    >
      <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:9 }}>
        <div style={{ position:'relative' }}>
          <Avatar name={char?.name||p.username} color={char?.avatar_color||'purple'} url={char?.avatar_url||p.avatar_url} size={44} />
          <div style={{ position:'absolute', bottom:1, right:1, width:10, height:10, borderRadius:'50%', background:p.is_online?'var(--green)':'var(--dim)', border:'1.5px solid var(--card)' }}/>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            @{p.username} {isMe && <span style={{ fontSize:9, color:'var(--purple-l)' }}>(você)</span>}
          </div>
          <div style={{ fontSize:10, color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{char?.name||'Sem personagem'}</div>
          {char?.rank && <div style={{ fontSize:9, color:'var(--gold)', marginTop:2 }}>{char.alias?`"${char.alias}" · `:''}{char.rank}</div>}
        </div>
      </div>
      {char && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:4, marginBottom:7 }}>
          {[{l:'HP',v:`${char.hp}/${char.hp_max}`,c:'var(--green-l)'},{l:'QK',v:`${char.quirk_charge}%`,c:'var(--purple-l)'},{l:'EXP',v:char.xp,c:'var(--gold)'}].map(s=>(
            <div key={s.l} style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:4, padding:5, textAlign:'center' }}>
              <div style={{ fontSize:7, letterSpacing:1, color:'var(--dim)', textTransform:'uppercase', marginBottom:2 }}>{s.l}</div>
              <div style={{ fontFamily:'Orbitron,monospace', fontSize:10, fontWeight:700, color:s.c }}>{s.v}</div>
            </div>
          ))}
        </div>
      )}
      {char?.quirk_data?.name && (
        <div style={{ fontSize:10, color:'var(--purple-l)', fontStyle:'italic', borderTop:'1px solid var(--border)', paddingTop:6 }}>
          ✨ {char.quirk_data.name}{char.quirk_data.type?` — ${char.quirk_data.type}`:''}
        </div>
      )}
    </div>
  )
}

function PlayerDetailModal({ p, onClose, isMe }) {
  const char = p.characters?.[0]
  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:500 }}>
        <div className="modal-hdr">
          <div className="modal-title">👤 Perfil de @{p.username}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16, padding:'12px 14px', background:'var(--panel)', borderRadius:8, border:'1px solid var(--border)' }}>
          <div style={{ position:'relative' }}>
            <Avatar name={char?.name||p.username} color={char?.avatar_color} url={char?.avatar_url||p.avatar_url} size={60} />
            <div style={{ position:'absolute', bottom:2, right:2, width:12, height:12, borderRadius:'50%', background:p.is_online?'var(--green)':'var(--dim)', border:'2px solid var(--panel)' }}/>
          </div>
          <div>
            <div style={{ fontFamily:'Bangers,cursive', fontSize:20, letterSpacing:1 }}>{char?.name||p.username}</div>
            {char?.alias && <div style={{ fontSize:10, color:'var(--gold)', letterSpacing:2 }}>"{char.alias}"</div>}
            <div style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>@{p.username}</div>
            <div style={{ fontSize:9, color:p.is_online?'var(--green-l)':'var(--dim)', marginTop:2 }}>
              {p.is_online ? '🟢 Online agora' : `⚫ Visto: ${new Date(p.last_seen).toLocaleDateString('pt-BR')}`}
            </div>
          </div>
        </div>
        {char ? <>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
            {[{l:'Afiliação',v:char.affiliation},{l:'Rank',v:char.rank},{l:'Especialidade',v:char.specialty},{l:'Idade',v:char.age}].filter(r=>r.v).map(r=>(
              <div key={r.l} style={{ background:'var(--panel)', borderRadius:5, padding:'6px 9px', border:'1px solid var(--border)' }}>
                <div style={{ fontSize:8, color:'var(--dim)', letterSpacing:1, textTransform:'uppercase', marginBottom:2 }}>{r.l}</div>
                <div style={{ fontSize:12, color:'var(--text)', fontWeight:600 }}>{r.v}</div>
              </div>
            ))}
          </div>
          {char.attrs && (
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, color:'var(--muted)', fontWeight:700, letterSpacing:1, marginBottom:6, textTransform:'uppercase' }}>Atributos</div>
              {Object.entries(char.attrs).map(([a,v])=>(
                <div key={a} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                  <span style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:10, color:'var(--muted)', width:80, textTransform:'uppercase' }}>{a}</span>
                  <div style={{ flex:1, height:4, background:'var(--border)', borderRadius:2, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${v}%`, background:'var(--blue)', borderRadius:2 }}/>
                  </div>
                  <span style={{ fontFamily:'Orbitron,monospace', fontSize:9, color:'var(--text)', width:16, textAlign:'right' }}>{gradeLabel(v)}</span>
                </div>
              ))}
            </div>
          )}
          {char.quirk_data?.name && (
            <div style={{ background:'var(--panel)', border:'1px solid rgba(124,58,237,.4)', borderRadius:7, padding:10, marginBottom:10 }}>
              <div style={{ fontFamily:'Bangers,cursive', fontSize:16, letterSpacing:1, color:'var(--purple-l)', marginBottom:2 }}>{char.quirk_data.name}</div>
              <div style={{ fontSize:8, color:'var(--purple-l)', opacity:.6, letterSpacing:2, textTransform:'uppercase', marginBottom:6 }}>{char.quirk_data.type}{char.quirk_data.subtype?' · '+char.quirk_data.subtype:''}</div>
              {char.quirk_data.description && <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.5 }}>{char.quirk_data.description}</div>}
            </div>
          )}
          {char.bio && <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.6 }}>{char.bio}</div>}
        </> : (
          <div style={{ textAlign:'center', padding:20, color:'var(--muted)', fontSize:12 }}>Jogador ainda não criou um personagem.</div>
        )}
        <button className="btn btn-g btn-full" style={{ marginTop:14 }} onClick={onClose}>Fechar</button>
      </div>
    </div>
  )
}
