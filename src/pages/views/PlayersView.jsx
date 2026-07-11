import { useState, useEffect } from 'react'
import { getAllProfiles, supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import Avatar from '../../components/Avatar'
import { gradeLabel, gradeColor, calcLevel, ATTR_META, ATTR_KEYS, QUIRK_TYPE_BONUSES, getSpecialty, calcAttrsWithSpecialty } from '../../lib/gameSystem'

// ── PROFILE DETAIL MODAL ──────────────────────────────────────
function PlayerDetailModal({ p, onClose, isMe }) {
  const char  = p.characters?.[0]
  const level = char?.level ?? calcLevel(char?.xp_total ?? char?.xp ?? 0)
  const xpPct = (char?.xp_max > 0) ? Math.min(100, Math.round((char.xp / char.xp_max) * 100)) : 0
  const specObj = getSpecialty(char?.specialty)
  const effectiveAttrs = char?.attrs ? calcAttrsWithSpecialty(char.attrs, char?.specialty) : {}

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:500 }}>
        <div className="modal-hdr">
          <div className="modal-title">👤 @{p.username}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16, padding:'12px 14px', background:'var(--panel)', borderRadius:8, border:'1px solid var(--border)' }}>
          <div style={{ position:'relative' }}>
            <Avatar name={char?.name || p.username} color={char?.avatar_color || 'purple'} url={char?.avatar_url || p.avatar_url} size={64} />
            <div style={{ position:'absolute', bottom:2, right:2, width:12, height:12, borderRadius:'50%', background:p.is_online?'var(--green)':'var(--dim)', border:'2px solid var(--panel)' }} />
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:'Bangers,cursive', fontSize:22, letterSpacing:1, color:'var(--text-h)' }}>{char?.name || p.username}</div>
            {char?.alias && <div style={{ fontSize:10, color:'var(--gold)', letterSpacing:2 }}>"{char.alias}"</div>}
            <div style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>
              @{p.username} {isMe && <span style={{ color:'var(--purple-l)' }}>· (você)</span>}
            </div>
            <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:4, flexWrap:'wrap' }}>
              <div style={{ fontFamily:'Orbitron,monospace', fontSize:11, fontWeight:700, color:'var(--gold)', background:'rgba(255,179,0,.1)', padding:'2px 8px', borderRadius:3 }}>
                Nv. {level}
              </div>
              <div style={{ fontSize:9, color:p.is_online?'var(--green-l)':'var(--dim)' }}>
                {p.is_online ? '🟢 Online' : '⚫ Offline'}
              </div>
            </div>
          </div>
        </div>

        {char?.name ? (
          <>
            {/* XP bar */}
            <div style={{ marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--dim)', marginBottom:4 }}>
                <span>EXP</span><span>{char.xp||0} / {char.xp_max||1000}</span>
              </div>
              <div className="pbar" style={{ height:6, borderRadius:3 }}>
                <div className="pbar-fill" style={{ width:`${xpPct}%`, background:'linear-gradient(90deg,var(--blue),var(--purple))', borderRadius:3 }} />
              </div>
            </div>

            {/* Vitals */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:12 }}>
              {[
                { l:'HP',     v:char.hp,           m:char.hp_max,      c:'var(--red-l)' },
                { l:'Quirk',  v:char.quirk_charge,  m:char.quirk_max,   c:'var(--purple-l)' },
                { l:'Stamina',v:char.stamina,        m:char.stamina_max, c:'var(--blue-l)' },
              ].map(b => {
                const pp = b.m > 0 ? Math.min(100, Math.round(b.v / b.m * 100)) : 100
                return (
                  <div key={b.l} style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:5, padding:'6px 8px' }}>
                    <div style={{ fontSize:8, color:'var(--dim)', textTransform:'uppercase', letterSpacing:1, marginBottom:3 }}>{b.l}</div>
                    <div className="pbar" style={{ height:3, marginBottom:3 }}>
                      <div className="pbar-fill" style={{ width:`${pp}%`, background:b.c }} />
                    </div>
                    <div style={{ fontFamily:'Orbitron,monospace', fontSize:9, color:b.c }}>{b.v||0}/{b.m||100}</div>
                  </div>
                )
              })}
            </div>

            {/* Info grid */}
            {[
              { l:'Afiliação',    v:char.affiliation,        c:'var(--blue-l)' },
              { l:'Especialidade',v:specObj?.label,          c:'var(--purple-l)' },
              { l:'Idade',        v:char.age },
              { l:'Altura',       v:char.height },
            ].filter(r => r.v).length > 0 && (
              <div style={{ marginBottom:12, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {[
                  { l:'Afiliação',    v:char.affiliation,        c:'var(--blue-l)' },
                  { l:'Especialidade',v:specObj?.label,          c:'var(--purple-l)' },
                  { l:'Idade',        v:char.age },
                  { l:'Altura',       v:char.height },
                ].filter(r => r.v).map(r => (
                  <div key={r.l} style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:5, padding:'5px 8px' }}>
                    <div style={{ fontSize:8, color:'var(--dim)', textTransform:'uppercase', letterSpacing:1, marginBottom:2 }}>{r.l}</div>
                    <div style={{ fontSize:11, color:r.c||'var(--text)', fontWeight:600 }}>{r.v}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Attributes */}
            {char.attrs && Object.keys(char.attrs).length > 0 && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:10, color:'var(--muted)', fontWeight:700, letterSpacing:1, marginBottom:8, textTransform:'uppercase' }}>Atributos</div>
                {ATTR_KEYS.map(k => {
                  const v = effectiveAttrs[k] || 0
                  return (
                    <div key={k} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                      <span style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:10, color:'var(--muted)', width:80, textTransform:'uppercase' }}>
                        {ATTR_META[k].label}
                      </span>
                      <div style={{ flex:1, height:4, background:'var(--border)', borderRadius:2, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${Math.min(100,(v/30)*100)}%`, background:ATTR_META[k].color, borderRadius:2 }} />
                      </div>
                      <span style={{ fontFamily:'Orbitron,monospace', fontSize:9, color:'var(--text)', width:22, textAlign:'right' }}>{v}</span>
                      <span style={{ fontFamily:'Orbitron,monospace', fontSize:9, color:gradeColor(v), width:26, textAlign:'right' }}>{gradeLabel(v)}</span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Quirk */}
            {char.quirk_data?.name && (
              <div style={{ background:'var(--panel)', border:'1px solid rgba(155,89,182,.4)', borderRadius:7, padding:10, marginBottom:10 }}>
                <div style={{ fontFamily:'Bangers,cursive', fontSize:16, letterSpacing:1, color:'var(--purple-l)', marginBottom:2 }}>
                  {char.quirk_data.name}
                </div>
                {char.quirk_data.type && (
                  <div style={{ fontSize:9, color:'var(--purple-l)', opacity:.7, letterSpacing:2, textTransform:'uppercase', marginBottom:6 }}>
                    {char.quirk_data.type}
                    {QUIRK_TYPE_BONUSES[char.quirk_data.type]?.label &&
                      <span style={{ color:QUIRK_TYPE_BONUSES[char.quirk_data.type].color, marginLeft:6 }}>
                        · {QUIRK_TYPE_BONUSES[char.quirk_data.type].label}
                      </span>
                    }
                  </div>
                )}
                {char.quirk_data.description && (
                  <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.5 }}>{char.quirk_data.description}</div>
                )}
              </div>
            )}

            {char.bio && (
              <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.6 }}>{char.bio}</div>
            )}
          </>
        ) : (
          <div style={{ textAlign:'center', padding:20, color:'var(--muted)', fontSize:12 }}>
            Este jogador ainda não criou um personagem.
          </div>
        )}

        <button className="btn btn-g btn-full" style={{ marginTop:14 }} onClick={onClose}>Fechar</button>
      </div>
    </div>
  )
}

// ── PLAYER CARD ───────────────────────────────────────────────
function PlayerCard({ p, isMe, onSelect }) {
  const char  = p.characters?.[0]
  const level = char?.level ?? calcLevel(char?.xp_total ?? char?.xp ?? 0)

  return (
    <div onClick={onSelect}
      style={{ background:'var(--card)', border:`1px solid ${isMe?'rgba(155,89,182,.4)':'var(--border)'}`, borderRadius:9, padding:13, cursor:'pointer', transition:'all .2s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor='var(--glow)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = isMe?'rgba(155,89,182,.4)':'var(--border)'}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:9 }}>
        <div style={{ position:'relative', flexShrink:0 }}>
          <Avatar
            name={char?.name || p.username}
            color={char?.avatar_color || 'purple'}
            url={char?.avatar_url || p.avatar_url}
            size={44}
          />
          <div style={{ position:'absolute', bottom:1, right:1, width:10, height:10, borderRadius:'50%', background:p.is_online?'var(--green)':'var(--dim)', border:'1.5px solid var(--card)' }} />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--text-h)' }}>
            {char?.name || p.username}
            {isMe && <span style={{ fontSize:9, color:'var(--purple-l)', marginLeft:4 }}>(você)</span>}
          </div>
          <div style={{ fontSize:10, color:'var(--dim)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            @{p.username}
          </div>
          <div style={{ display:'flex', gap:5, alignItems:'center', marginTop:2 }}>
            <div style={{ fontFamily:'Orbitron,monospace', fontSize:9, color:'var(--gold)', fontWeight:700 }}>Nv.{level}</div>
            <span style={{ fontSize:8, color:p.is_online?'var(--green-l)':'var(--dim)', marginLeft:'auto' }}>
              {p.is_online?'🟢':'⚫'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      {char?.name ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:4, marginBottom:7 }}>
          {[
            { l:'HP',  v:char.hp||0,     m:char.hp_max||100,  c:'var(--red-l)' },
            { l:'QK',  v:char.quirk_charge||0, m:char.quirk_max||100, c:'var(--purple-l)' },
            { l:'XP',  v:(char.xp||0).toLocaleString(), m:null, c:'var(--gold)' },
          ].map(s => (
            <div key={s.l} style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:4, padding:'4px 5px', textAlign:'center' }}>
              <div style={{ fontSize:7, letterSpacing:1, color:'var(--dim)', textTransform:'uppercase', marginBottom:2 }}>{s.l}</div>
              <div style={{ fontFamily:'Orbitron,monospace', fontSize:9, fontWeight:700, color:s.c }}>
                {s.m !== null ? `${s.v}/${s.m}` : s.v}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize:10, color:'var(--dim)', textAlign:'center', padding:'6px 0' }}>Sem personagem criado</div>
      )}

      {/* Quirk */}
      {char?.quirk_data?.name && (
        <div style={{ fontSize:10, color:'var(--purple-l)', fontStyle:'italic', borderTop:'1px solid var(--border)', paddingTop:6, lineHeight:1.4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          ✨ {char.quirk_data.name}{char.quirk_data.type ? ` — ${char.quirk_data.type}` : ''}
        </div>
      )}
    </div>
  )
}

// ── MAIN VIEW ─────────────────────────────────────────────────
export default function PlayersView() {
  const { user }  = useAuth()
  const [players,  setPlayers]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await getAllProfiles()
      if (err) {
        setError(`Erro: ${err.message}`)
      } else {
        setPlayers(data || [])
      }
    } catch (e) {
      setError(`Erro inesperado: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // Realtime: refresh on any profile or character change
    const ch = supabase.channel('players-realtime')
      .on('postgres_changes', { event:'*', schema:'public', table:'profiles' }, load)
      .on('postgres_changes', { event:'*', schema:'public', table:'characters' }, load)
      .subscribe()
    return () => ch.unsubscribe()
  }, [])

  const filtered = players.filter(p =>
    !search ||
    p.username?.toLowerCase().includes(search.toLowerCase()) ||
    p.characters?.[0]?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const online  = filtered.filter(p => p.is_online)
  const offline = filtered.filter(p => !p.is_online)

  return (
    <div style={{ flex:1, overflowY:'auto', padding:14 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14, flexWrap:'wrap' }}>
        <div style={{ fontFamily:'Bangers,cursive', fontSize:20, letterSpacing:3, color:'var(--text-h)' }}>JOGADORES</div>
        <div style={{ fontSize:10, color:'var(--muted)' }}>
          {players.length} membros
          {players.filter(p=>p.is_online).length > 0 && (
            <span style={{ color:'var(--green-l)', marginLeft:6 }}>· {players.filter(p=>p.is_online).length} online</span>
          )}
        </div>
        <input
          className="input"
          style={{ marginLeft:'auto', width:200 }}
          placeholder="🔍 Buscar por nome..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="btn btn-g btn-sm" onClick={load}>↻ Atualizar</button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign:'center', padding:40 }}>
          <div className="spinner" style={{ margin:'0 auto 12px' }} />
          <div style={{ color:'var(--dim)', fontSize:11 }}>Carregando jogadores...</div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div style={{ background:'rgba(237,66,69,.1)', border:'1px solid rgba(237,66,69,.3)', borderRadius:8, padding:16, marginBottom:14 }}>
          <div style={{ color:'var(--red-l)', fontWeight:700, marginBottom:6 }}>❌ Erro ao carregar</div>
          <div style={{ color:'var(--muted)', fontSize:11 }}>{error}</div>
          <button className="btn btn-p btn-sm" style={{ marginTop:8 }} onClick={load}>Tentar novamente</button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && players.length === 0 && (
        <div style={{ textAlign:'center', padding:40, color:'var(--muted)' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>👥</div>
          <div style={{ fontFamily:'Bangers,cursive', fontSize:18, letterSpacing:2, color:'var(--blue-l)', marginBottom:8 }}>NENHUM JOGADOR</div>
          <div style={{ fontSize:12 }}>Nenhum usuário cadastrado ainda.</div>
        </div>
      )}

      {/* Online section */}
      {!loading && !error && online.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontFamily:'Bangers,cursive', fontSize:12, letterSpacing:2, color:'var(--green-l)', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
            <span className="live" /> ONLINE ({online.length})
          </div>
          <div className="players-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
            {online.map(p => (
              <PlayerCard key={p.id} p={p} isMe={p.id===user?.id} onSelect={()=>setSelected(p)} />
            ))}
          </div>
        </div>
      )}

      {/* Offline section */}
      {!loading && !error && offline.length > 0 && (
        <div>
          <div style={{ fontFamily:'Bangers,cursive', fontSize:12, letterSpacing:2, color:'var(--dim)', marginBottom:8 }}>
            ⚫ OFFLINE ({offline.length})
          </div>
          <div className="players-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
            {offline.map(p => (
              <PlayerCard key={p.id} p={p} isMe={p.id===user?.id} onSelect={()=>setSelected(p)} />
            ))}
          </div>
        </div>
      )}

      {/* All players if no separation needed */}
      {!loading && !error && players.length > 0 && online.length === 0 && offline.length === 0 && (
        <div className="players-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
          {filtered.map(p => (
            <PlayerCard key={p.id} p={p} isMe={p.id===user?.id} onSelect={()=>setSelected(p)} />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <PlayerDetailModal
          p={selected}
          onClose={() => setSelected(null)}
          isMe={selected.id === user?.id}
        />
      )}
    </div>
  )
}
