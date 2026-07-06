import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getRanking, upsertRankEntry, deleteRankEntry, supabase } from '../../lib/supabase'
import { notify } from '../../components/Toast'
import Modal from '../../components/Modal'
import Avatar from '../../components/Avatar'
import { calcLevel } from '../../lib/gameSystem'

const RANK_COLORS = { S:'#ff79c6','S+':'#ff40ff','SS':'#FF79C6','SS+':'#FF69B4','SSS':'#FF40FF','SSS+':'#FF00FF',A:'#A78BFA','A+':'#9B59B6',B:'#7289DA','B+':'#5865F2',C:'#57F287','C+':'#3BA55D',D:'#FFA500','D+':'#FF8C00',E:'#96989D',F:'#72767D' }

function RankModal({ entry, onClose, onSaved, userId }) {
  const [form,setForm]=useState({ player_name:entry?.player_name||'', char_name:entry?.char_name||'', quirk_name:entry?.quirk_name||'', points:entry?.points||0, rank_badge:entry?.rank_badge||'', color:entry?.color||'blue' })
  const [saving,setSaving]=useState(false)
  const colors=['red','blue','green','purple','gold','pink','teal','gray']
  function set(k,v){setForm(f=>({...f,[k]:v}))}
  async function handle(){
    if(!form.player_name.trim()){notify('❌ Nome obrigatório','error');return}
    setSaving(true)
    const payload={...form,points:Number(form.points),user_id:userId}
    if(entry?.id) payload.id=entry.id
    const{error}=await upsertRankEntry(payload)
    setSaving(false)
    if(error){notify('❌ '+error.message,'error');return}
    notify('✅ Salvo!','success'); onSaved()
  }
  return (
    <Modal title={entry?'✏️ Editar Entrada':'+ Ranking'} onClose={onClose}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        <div className="field"><label>Jogador *</label><input className="input" value={form.player_name} onChange={e=>set('player_name',e.target.value)}/></div>
        <div className="field"><label>Personagem</label><input className="input" value={form.char_name} onChange={e=>set('char_name',e.target.value)}/></div>
        <div className="field"><label>Quirk</label><input className="input" value={form.quirk_name} onChange={e=>set('quirk_name',e.target.value)}/></div>
        <div className="field"><label>Pontuação (XP)</label><input className="input" type="number" value={form.points} onChange={e=>set('points',e.target.value)}/></div>
        <div className="field"><label>Rank / Badge</label><input className="input" value={form.rank_badge} onChange={e=>set('rank_badge',e.target.value)} placeholder="Ex: Rank B"/></div>
        <div className="field"><label>Cor</label>
          <select className="input" value={form.color} onChange={e=>set('color',e.target.value)}>
            {colors.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div style={{display:'flex',gap:6}}>
        <button className="btn btn-p btn-lg" onClick={handle} disabled={saving} style={{flex:1}}>{saving?'⏳...':'💾 Salvar'}</button>
        {entry&&<button className="btn btn-danger" onClick={async()=>{if(!confirm('Remover?'))return;await deleteRankEntry(entry.id);notify('🗑️ Removido');onSaved()}}>🗑️</button>}
        <button className="btn btn-g" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  )
}

export default function RankingView() {
  const {user} = useAuth()
  const [ranking,setRanking]=useState([])
  const [showAdd,setShowAdd]=useState(false)
  const [editEntry,setEditEntry]=useState(null)
  const [liveCount,setLiveCount]=useState(0) // contador de updates em tempo real

  async function load(){
    const{data}=await getRanking()
    if(data) setRanking(data)
  }

  useEffect(()=>{
    load()
    // Realtime subscription
    const ch=supabase.channel('ranking-rt')
      .on('postgres_changes',{event:'*',schema:'public',table:'ranking'},()=>{
        load()
        setLiveCount(n=>n+1)
      })
      .subscribe()
    return ()=>ch.unsubscribe()
  },[])

  const top3 = ranking.slice(0,3)
  const rest  = ranking.slice(3)
  // Podium order: 2º, 1º, 3º
  const podiumOrder = top3.length>=3 ? [top3[1],top3[0],top3[2]] : top3
  const medals = ['🥈','🥇','🥉']

  return (
    <div style={{flex:1,overflowY:'auto',padding:14}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4,flexWrap:'wrap'}}>
        <div style={{fontFamily:'Bangers,cursive',fontSize:20,letterSpacing:3,color:'var(--gold)'}}>🏆 RANKING</div>
        <div style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color:'var(--green-l)'}}>
          <span className="live"/>Tempo real
          {liveCount>0&&<span style={{color:'var(--dim)'}}>(+{liveCount} atualiz.)</span>}
        </div>
        <button className="btn btn-p btn-sm" style={{marginLeft:'auto'}} onClick={()=>{setEditEntry(null);setShowAdd(true)}}>+ Adicionar</button>
      </div>
      <div style={{fontSize:11,color:'var(--muted)',marginBottom:14}}>Atualizado automaticamente quando XP é ganho via missões e combate.</div>

      {ranking.length===0&&(
        <div style={{textAlign:'center',padding:32,color:'var(--muted)',fontSize:12}}>
          <div style={{fontSize:36,marginBottom:8}}>🏆</div>
          Sem entradas. Clique em "+ Adicionar".
        </div>
      )}

      {top3.length>0&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1.1fr 1fr',gap:10,marginBottom:14,alignItems:'end'}}>
          {podiumOrder.map((e,pi)=>{
            if(!e) return <div key={pi}/>
            const isFirst=top3.indexOf(e)===0
            const level=e.level ?? calcLevel(e.xp_total ?? e.points ?? 0)
            return(
              <div key={e.id} onDoubleClick={()=>{setEditEntry(e);setShowAdd(true)}}
                style={{background:'var(--card)',border:`1px solid ${isFirst?'rgba(255,179,0,.4)':'var(--border)'}`,borderRadius:9,padding:isFirst?'18px 12px':'14px 10px',textAlign:'center',cursor:'pointer',transition:'all .2s'}}
                onMouseEnter={e=>e.currentTarget.style.borderColor='var(--glow)'}
                onMouseLeave={ev=>ev.currentTarget.style.borderColor=isFirst?'rgba(255,179,0,.4)':'var(--border)'}>
                <span style={{fontSize:isFirst?32:26,display:'block',marginBottom:7}}>{medals[pi]}</span>
                <Avatar name={e.player_name} color={e.color} size={isFirst?58:44} style={{margin:'0 auto 7px'}}/>
                <div style={{fontFamily:'Bangers,cursive',fontSize:isFirst?17:14,letterSpacing:1,color:'var(--text-h)'}}>{e.player_name}</div>
                <div style={{fontSize:9,color:'var(--muted)',marginBottom:3}}>{e.char_name}</div>
                <div style={{fontFamily:'Orbitron,monospace',fontSize:10,color:'var(--dim)',marginBottom:4}}>Nv. {level}</div>
                <div style={{fontFamily:'Orbitron,monospace',fontSize:isFirst?16:13,fontWeight:700,color:'var(--gold)'}}>{e.points?.toLocaleString()} XP</div>
                {e.rank_badge&&<div style={{fontSize:8,fontWeight:700,padding:'2px 6px',borderRadius:3,background:`${RANK_COLORS[e.rank_badge]||'var(--blue-l)'}22`,color:RANK_COLORS[e.rank_badge]||'var(--blue-l)',border:`1px solid ${RANK_COLORS[e.rank_badge]||'var(--blue-l)'}44`,display:'inline-block',marginTop:4}}>{e.rank_badge}</div>}
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
                  <div style={{fontFamily:'Rajdhani,sans-serif',fontWeight:700,fontSize:13,color:'var(--text-h)'}}>{e.player_name}</div>
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

      {showAdd&&<RankModal entry={editEntry} onClose={()=>{setShowAdd(false);setEditEntry(null)}} onSaved={()=>{load();setShowAdd(false);setEditEntry(null)}} userId={user.id}/>}
    </div>
  )
}
