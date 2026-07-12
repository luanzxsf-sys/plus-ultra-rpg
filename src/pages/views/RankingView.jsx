import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getRanking, upsertRankEntry, deleteRankEntry, getNpcs, getAllProfiles, supabase } from '../../lib/supabase'
import { notify } from '../../components/Toast'
import Modal from '../../components/Modal'
import Avatar from '../../components/Avatar'
import { calcLevel } from '../../lib/gameSystem'

const RANK_COLORS = { S:'#ff79c6','S+':'#ff40ff','SS':'#FF79C6','SS+':'#FF69B4','SSS':'#FF40FF','SSS+':'#FF00FF',A:'#A78BFA','A+':'#9B59B6',B:'#7289DA','B+':'#5865F2',C:'#57F287','C+':'#3BA55D',D:'#FFA500','D+':'#FF8C00',E:'#96989D',F:'#72767D' }
const DEPARTMENTS = { heroes:{ label:'🦸 Heróis', color:'var(--gold)' }, investigative:{ label:'🔎 Depto. Investigativo', color:'var(--blue-l)' } }

function RankModal({ entry, onClose, onSaved, userId }) {
  const [profiles,setProfiles]=useState([])
  const [selectedUserId,setSelectedUserId]=useState(entry?.user_id||'')
  const [form,setForm]=useState({ rank_badge:entry?.rank_badge||'', department:entry?.department||'heroes' })
  const [saving,setSaving]=useState(false)
  function set(k,v){setForm(f=>({...f,[k]:v}))}

  useEffect(()=>{
    getAllProfiles().then(({data})=>{ if(data) setProfiles(data.filter(p=>p.name)) })
  },[])

  const selected = profiles.find(p=>p.user_id===selectedUserId)

  async function handle(){
    if(!selectedUserId && !entry){ notify('❌ Selecione um herói','error'); return }
    setSaving(true)
    const payload={
      rank_badge:  form.rank_badge,
      department:  form.department,
      user_id:     selectedUserId || entry?.user_id,
      player_name: selected?.name || entry?.player_name,
      char_name:   selected?.alias || selected?.name || entry?.char_name,
      quirk_name:  selected?.quirk_data?.name || entry?.quirk_name || '',
      color:       selected?.avatar_color || entry?.color || 'blue',
      points:      entry?.points || 0,
    }
    if(entry?.id) payload.id=entry.id
    const{error}=await upsertRankEntry(payload)
    setSaving(false)
    if(error){notify('❌ '+error.message,'error');return}
    notify('✅ Salvo!','success'); onSaved()
  }
  return (
    <Modal title={entry?'✏️ Editar Entrada':'+ Ranking'} onClose={onClose}>
      <div className="field">
        <label>Herói *</label>
        <select className="input" value={selectedUserId} onChange={e=>setSelectedUserId(e.target.value)}>
          <option value="">— Selecionar personagem —</option>
          {profiles.map(p=>(
            <option key={p.user_id} value={p.user_id}>{p.name}{p.alias?` "${p.alias}"`:''}{p.quirk_data?.name?` — ${p.quirk_data.name}`:''}</option>
          ))}
        </select>
        {entry && !selectedUserId && <div style={{fontSize:9,color:'var(--dim)',marginTop:4}}>Mantendo ficha atual: {entry.player_name}</div>}
      </div>
      <div className="field">
        <label>Rank <span style={{color:'var(--dim)',fontWeight:400}}>(livre — conforme a lore)</span></label>
        <input className="input" value={form.rank_badge} onChange={e=>set('rank_badge',e.target.value)} placeholder="Ex: Rank B"/>
      </div>
      <div className="field">
        <label>Faz parte do Departamento Investigativo?</label>
        <div style={{display:'flex',gap:6}}>
          <button type="button" onClick={()=>set('department','heroes')}
            style={{flex:1,padding:'9px',borderRadius:6,fontSize:12,fontWeight:700,cursor:'pointer',
              background:form.department==='heroes'?'var(--gold)':'var(--panel)',
              color:form.department==='heroes'?'#000':'var(--muted)',
              border:`1px solid ${form.department==='heroes'?'var(--gold)':'var(--border)'}`}}>
            🦸 Não — Herói comum
          </button>
          <button type="button" onClick={()=>set('department','investigative')}
            style={{flex:1,padding:'9px',borderRadius:6,fontSize:12,fontWeight:700,cursor:'pointer',
              background:form.department==='investigative'?'var(--blue)':'var(--panel)',
              color:form.department==='investigative'?'#fff':'var(--muted)',
              border:`1px solid ${form.department==='investigative'?'var(--blue)':'var(--border)'}`}}>
            🔎 Sim — Investigativo
          </button>
        </div>
      </div>
      <div style={{display:'flex',gap:6,marginTop:14}}>
        <button className="btn btn-p btn-lg" onClick={handle} disabled={saving} style={{flex:1}}>{saving?'⏳...':'💾 Salvar'}</button>
        {entry&&<button className="btn btn-danger" onClick={async()=>{if(!confirm('Remover?'))return;await deleteRankEntry(entry.id);notify('🗑️ Removido');onSaved()}}>🗑️</button>}
        <button className="btn btn-g" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  )
}

export default function RankingView() {
  const {user} = useAuth()
  const [tab,setTab]=useState('players') // 'players' | 'heroes'
  const [deptFilter,setDeptFilter]=useState('all') // 'all' | 'heroes' | 'investigative'
  const [ranking,setRanking]=useState([])
  const [heroes,setHeroes]=useState([])
  const [showAdd,setShowAdd]=useState(false)
  const [editEntry,setEditEntry]=useState(null)
  const [liveCount,setLiveCount]=useState(0) // contador de updates em tempo real

  async function load(){
    const{data}=await getRanking()
    if(data) setRanking(data)
  }

  async function loadHeroes(){
    const{data}=await getNpcs()
    if(data){
      const heroNpcs = data
        .filter(n=>n.role==='hero_npc')
        .sort((a,b)=>(b.level||1)-(a.level||1) || (a.name||'').localeCompare(b.name||''))
      setHeroes(heroNpcs)
    }
  }

  useEffect(()=>{
    load()
    loadHeroes()
    // Realtime subscription
    const ch=supabase.channel('ranking-rt')
      .on('postgres_changes',{event:'*',schema:'public',table:'ranking'},()=>{
        load()
        setLiveCount(n=>n+1)
      })
      .subscribe()
    const chNpc=supabase.channel('ranking-npcs-rt')
      .on('postgres_changes',{event:'*',schema:'public',table:'npcs'},()=>{
        loadHeroes()
        setLiveCount(n=>n+1)
      })
      .subscribe()
    return ()=>{ch.unsubscribe();chNpc.unsubscribe()}
  },[])

  const filteredRanking = deptFilter==='all' ? ranking : ranking.filter(e=>(e.department||'heroes')===deptFilter)
  const top3 = filteredRanking.slice(0,3)
  const rest  = filteredRanking.slice(3)
  // Podium order: 2º, 1º, 3º
  const podiumOrder = top3.length>=3 ? [top3[1],top3[0],top3[2]] : top3
  const medals = ['🥈','🥇','🥉']

  const heroesTop3 = heroes.slice(0,3)
  const heroesRest = heroes.slice(3)
  const heroesPodiumOrder = heroesTop3.length>=3 ? [heroesTop3[1],heroesTop3[0],heroesTop3[2]] : heroesTop3

  return (
    <div style={{flex:1,overflowY:'auto',padding:14}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4,flexWrap:'wrap'}}>
        <div style={{fontFamily:'Bangers,cursive',fontSize:20,letterSpacing:3,color:'var(--gold)'}}>🏆 RANKING</div>
        <div style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color:'var(--green-l)'}}>
          <span className="live"/>Tempo real
          {liveCount>0&&<span style={{color:'var(--dim)'}}>(+{liveCount} atualiz.)</span>}
        </div>
        {tab==='players'&&<button className="btn btn-p btn-sm" style={{marginLeft:'auto'}} onClick={()=>{setEditEntry(null);setShowAdd(true)}}>+ Adicionar</button>}
      </div>

      <div style={{display:'flex',gap:6,marginBottom:10,borderBottom:'1px solid var(--border)'}}>
        <button onClick={()=>setTab('players')}
          style={{padding:'8px 14px',background:'transparent',border:'none',borderBottom:tab==='players'?'2px solid var(--gold)':'2px solid transparent',color:tab==='players'?'var(--gold)':'var(--muted)',fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:12,letterSpacing:1,textTransform:'uppercase',cursor:'pointer'}}>
          🏆 Jogadores
        </button>
        <button onClick={()=>setTab('heroes')}
          style={{padding:'8px 14px',background:'transparent',border:'none',borderBottom:tab==='heroes'?'2px solid var(--green-l)':'2px solid transparent',color:tab==='heroes'?'var(--green-l)':'var(--muted)',fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:12,letterSpacing:1,textTransform:'uppercase',cursor:'pointer'}}>
          🦸 Heróis (NPCs)
        </button>
      </div>

      {tab==='players' && (
      <>
      <div style={{fontSize:11,color:'var(--muted)',marginBottom:10}}>Atualizado automaticamente quando XP é ganho via missões e combate.</div>

      <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap'}}>
        {[{k:'all',l:'Todos'},{k:'heroes',l:DEPARTMENTS.heroes.label},{k:'investigative',l:DEPARTMENTS.investigative.label}].map(f=>(
          <button key={f.k} onClick={()=>setDeptFilter(f.k)}
            style={{padding:'5px 11px',borderRadius:14,fontSize:10,fontWeight:700,cursor:'pointer',
              background:deptFilter===f.k?'var(--gold)':'var(--panel)',
              color:deptFilter===f.k?'#000':'var(--muted)',
              border:`1px solid ${deptFilter===f.k?'var(--gold)':'var(--border)'}`}}>
            {f.l}
          </button>
        ))}
      </div>

      {filteredRanking.length===0&&(
        <div style={{textAlign:'center',padding:32,color:'var(--muted)',fontSize:12}}>
          <div style={{fontSize:36,marginBottom:8}}>🏆</div>
          {ranking.length===0 ? 'Sem entradas. Clique em "+ Adicionar".' : 'Nenhuma entrada nesse departamento.'}
        </div>
      )}

      {top3.length>0&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1.1fr 1fr',gap:10,marginBottom:14,alignItems:'end'}}>
          {podiumOrder.map((e,pi)=>{
            if(!e) return <div key={pi}/>
            const isFirst=top3.indexOf(e)===0
            const level=e.level ?? calcLevel(e.xp_total ?? e.points ?? 0)
            const dept = DEPARTMENTS[e.department||'heroes']
            return(
              <div key={e.id} onDoubleClick={()=>{setEditEntry(e);setShowAdd(true)}}
                style={{background:'var(--card)',border:`1px solid ${isFirst?'rgba(242,183,5,.4)':'var(--border)'}`,borderRadius:9,padding:isFirst?'18px 12px':'14px 10px',textAlign:'center',cursor:'pointer',transition:'all .2s'}}
                onMouseEnter={e=>e.currentTarget.style.borderColor='var(--glow)'}
                onMouseLeave={ev=>ev.currentTarget.style.borderColor=isFirst?'rgba(242,183,5,.4)':'var(--border)'}>
                <span style={{fontSize:isFirst?32:26,display:'block',marginBottom:7}}>{medals[pi]}</span>
                <Avatar name={e.player_name} color={e.color} size={isFirst?58:44} style={{margin:'0 auto 7px'}}/>
                <div style={{fontFamily:'Bangers,cursive',fontSize:isFirst?17:14,letterSpacing:1,color:'var(--text-h)'}}>{e.player_name}</div>
                <div style={{fontSize:9,color:'var(--muted)',marginBottom:3}}>{e.char_name}</div>
                <div style={{fontFamily:'Orbitron,monospace',fontSize:10,color:'var(--dim)',marginBottom:4}}>Nv. {level}</div>
                <div style={{fontFamily:'Orbitron,monospace',fontSize:isFirst?16:13,fontWeight:700,color:'var(--gold)'}}>{e.points?.toLocaleString()} XP</div>
                <div style={{display:'flex',gap:3,justifyContent:'center',flexWrap:'wrap',marginTop:4}}>
                  {e.rank_badge&&<div style={{fontSize:8,fontWeight:700,padding:'2px 6px',borderRadius:3,background:`${RANK_COLORS[e.rank_badge]||'var(--blue-l)'}22`,color:RANK_COLORS[e.rank_badge]||'var(--blue-l)',border:`1px solid ${RANK_COLORS[e.rank_badge]||'var(--blue-l)'}44`,display:'inline-block'}}>{e.rank_badge}</div>}
                  {e.department==='investigative'&&<div style={{fontSize:8,fontWeight:700,padding:'2px 6px',borderRadius:3,background:'rgba(59,111,240,.15)',color:'var(--blue-l)',border:'1px solid rgba(59,111,240,.3)',display:'inline-block'}}>{dept.label}</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {rest.length>0&&(
        <div style={{display:'flex',flexDirection:'column',gap:5}}>
          {rest.map((e,i)=>{
            const level=e.level ?? calcLevel(e.xp_total ?? e.points ?? 0)
            return(
              <div key={e.id} onDoubleClick={()=>{setEditEntry(e);setShowAdd(true)}}
                style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:7,padding:'9px 12px',display:'flex',alignItems:'center',gap:10,cursor:'pointer',transition:'all .2s'}}
                onMouseEnter={ev=>ev.currentTarget.style.borderColor='var(--glow)'}
                onMouseLeave={ev=>ev.currentTarget.style.borderColor='var(--border)'}>
                <div style={{fontFamily:'Orbitron,monospace',fontSize:12,fontWeight:700,color:'var(--dim)',width:24,textAlign:'center'}}>{i+4}</div>
                <Avatar name={e.player_name} color={e.color} size={34}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:13,color:'var(--text-h)',display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
                    {e.player_name}
                    {e.department==='investigative'&&<span style={{fontSize:8,fontWeight:700,padding:'1px 5px',borderRadius:3,background:'rgba(59,111,240,.15)',color:'var(--blue-l)',border:'1px solid rgba(59,111,240,.3)'}}>🔎 Investigativo</span>}
                  </div>
                  <div style={{fontSize:10,color:'var(--muted)'}}>{e.char_name}{e.quirk_name?' · '+e.quirk_name:''}</div>
                </div>
                <div style={{fontFamily:'Orbitron,monospace',fontSize:10,color:'var(--dim)'}}>Nv.{level}</div>
                {e.rank_badge&&<div style={{fontSize:8,fontWeight:700,padding:'2px 5px',borderRadius:3,background:`${RANK_COLORS[e.rank_badge]||'var(--blue-l)'}22`,color:RANK_COLORS[e.rank_badge]||'var(--blue-l)',border:`1px solid ${RANK_COLORS[e.rank_badge]||'var(--blue-l)'}44`}}>{e.rank_badge}</div>}
                <div style={{fontFamily:'Orbitron,monospace',fontSize:12,color:'var(--gold)'}}>{e.points?.toLocaleString()}</div>
              </div>
            )
          })}
        </div>
      )}
      {ranking.length>0&&<div style={{fontSize:9,color:'var(--dim)',marginTop:8}}>Clique duplo para editar</div>}
      </>
      )}

      {tab==='heroes' && (
      <>
      <div style={{fontSize:11,color:'var(--muted)',marginBottom:14}}>Automático — puxa todos os NPCs marcados como "Herói" e ordena pelo nível. Edite o NPC na aba de NPCs para mudar a posição.</div>

      {heroes.length===0&&(
        <div style={{textAlign:'center',padding:32,color:'var(--muted)',fontSize:12}}>
          <div style={{fontSize:36,marginBottom:8}}>🦸</div>
          Nenhum NPC marcado como "Herói" ainda.
        </div>
      )}

      {heroesTop3.length>0&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1.1fr 1fr',gap:10,marginBottom:14,alignItems:'end'}}>
          {heroesPodiumOrder.map((h,pi)=>{
            if(!h) return <div key={pi}/>
            const isFirst=heroesTop3.indexOf(h)===0
            return(
              <div key={h.id}
                style={{background:'var(--card)',border:`1px solid ${isFirst?'rgba(47,191,113,.4)':'var(--border)'}`,borderRadius:9,padding:isFirst?'18px 12px':'14px 10px',textAlign:'center',transition:'all .2s'}}>
                <span style={{fontSize:isFirst?32:26,display:'block',marginBottom:7}}>{medals[pi]}</span>
                <Avatar name={h.name} url={h.avatar_url} color={h.avatar_color||'gray'} size={isFirst?58:44} style={{margin:'0 auto 7px'}}/>
                <div style={{fontFamily:'Bangers,cursive',fontSize:isFirst?17:14,letterSpacing:1,color:'var(--text-h)'}}>{h.name}</div>
                {h.alias&&<div style={{fontSize:9,color:'var(--gold)',marginBottom:3}}>"{h.alias}"</div>}
                {h.quirk_name&&<div style={{fontSize:9,color:'var(--purple-l)',marginBottom:3}}>✨ {h.quirk_name}</div>}
                <div style={{fontFamily:'Orbitron,monospace',fontSize:isFirst?16:13,fontWeight:700,color:'var(--green-l)'}}>Nv. {h.level||1}</div>
              </div>
            )
          })}
        </div>
      )}

      {heroesRest.length>0&&(
        <div style={{display:'flex',flexDirection:'column',gap:5}}>
          {heroesRest.map((h,i)=>(
            <div key={h.id}
              style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:7,padding:'9px 12px',display:'flex',alignItems:'center',gap:10,transition:'all .2s'}}>
              <div style={{fontFamily:'Orbitron,monospace',fontSize:12,fontWeight:700,color:'var(--dim)',width:24,textAlign:'center'}}>{i+4}</div>
              <Avatar name={h.name} url={h.avatar_url} color={h.avatar_color||'gray'} size={34}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:13,color:'var(--text-h)'}}>{h.name}</div>
                <div style={{fontSize:10,color:'var(--muted)'}}>{h.alias?`"${h.alias}"`:''}{h.quirk_name?' · '+h.quirk_name:''}</div>
              </div>
              <div style={{fontFamily:'Orbitron,monospace',fontSize:12,fontWeight:700,color:'var(--green-l)'}}>Nv.{h.level||1}</div>
            </div>
          ))}
        </div>
      )}
      </>
      )}

      {tab==='players' && showAdd&&<RankModal entry={editEntry} onClose={()=>{setShowAdd(false);setEditEntry(null)}} onSaved={()=>{load();setShowAdd(false);setEditEntry(null)}} userId={user.id}/>}
    </div>
  )
}
