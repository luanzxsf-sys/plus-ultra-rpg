import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getFighters, upsertFighter, deleteFighter, getBattleLog, addBattleLog, clearBattleLog, supabase } from '../../lib/supabase'
import { notify } from '../../components/Toast'
import Modal from '../../components/Modal'
import Avatar, { avatarBg, TEXT_COLOR } from '../../components/Avatar'

const SESSION_ID = 'default-arena' // single shared arena; could be made dynamic per scene

function d(sides) { return Math.floor(Math.random()*sides)+1 }
function ts() { const n=new Date(); return `${n.getHours()}:${String(n.getMinutes()).padStart(2,'0')}` }

const ROLE_LABEL = { hero:'⚡ HERÓI', villain:'💀 VILÃO', ally:'🤝 ALIADO' }
const ROLE_COLOR = { hero:'var(--green-l)', villain:'var(--red-l)', ally:'var(--blue-l)' }

export default function ArenaView() {
  const { user } = useAuth()
  const [fighters, setFighters] = useState([])
  const [log, setLog] = useState([])
  const [text, setText] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editFighter, setEditFighter] = useState(null)
  const logEndRef = useRef(null)

  async function load() {
    const { data: f } = await getFighters(SESSION_ID)
    if (f) setFighters(f)
    const { data: l } = await getBattleLog(SESSION_ID)
    if (l) setLog(l)
  }

  useEffect(() => {
    load()
    const ch = supabase.channel('arena-rt')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'battle_log', filter:`session_id=eq.${SESSION_ID}` }, ({ new: entry }) => setLog(prev=>[...prev, entry]))
      .on('postgres_changes', { event:'*', schema:'public', table:'fighters', filter:`session_id=eq.${SESSION_ID}` }, load)
      .subscribe()
    return () => ch.unsubscribe()
  }, [])

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior:'smooth' }) }, [log])

  async function pushLog(html) {
    await addBattleLog({ html, session_id: SESSION_ID, created_by: user.id })
  }

  async function rollBattle() {
    const r = d(20)
    const color = r>=15?'#4ade80':r>=8?'#fbbf24':'#f87171'
    const lbl = r===20?'CRÍTICO! 🌟':r===1?'FALHA CRÍTICA! 💀':r>=15?'Sucesso!':r>=8?'Parcial':'Falha!'
    await pushLog(`<span style="color:var(--purple-l);font-style:italic">🎲 D20: <strong style="color:${color};font-family:Orbitron,monospace">${r}</strong> — ${lbl}</span>`)
  }

  async function addAction() {
    if (!text.trim()) { notify('Escreva a ação primeiro', 'error'); return }
    const r = d(20); const dmg = Math.floor(Math.random()*20)+5
    await pushLog(`<span style="color:var(--red-l);font-weight:600">⚔️ Ação:</span> ${escapeHtml(text.trim())} — <span style="color:var(--gold);font-family:Orbitron,monospace;font-size:10px">[D20=${r} · ${dmg} dano]</span>`)
    setText('')
  }

  function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

  async function useMove(fighter, move) {
    await pushLog(`<span style="color:${ROLE_COLOR[fighter.role]}">${fighter.name}</span> usa <strong>${move.name}</strong>! <span style="color:var(--gold);font-family:Orbitron,monospace;font-size:10px">[${move.cost||''}]</span>`)
  }

  async function clearAll() {
    if (!confirm('Limpar arena (log + combatentes)?')) return
    await clearBattleLog(SESSION_ID)
    setFighters([]); setLog([])
    notify('🗑️ Arena limpa!')
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 265px', height:'calc(100vh - 46px)', overflow:'hidden' }}>
      {/* Battle log */}
      <div style={{ display:'flex', flexDirection:'column', borderRight:'1px solid var(--border)' }}>
        <div style={{ padding:'9px 13px', borderBottom:'1px solid var(--border)', background:'var(--card)', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div><span className="live"/><span style={{ fontFamily:'Bangers,cursive', fontSize:14, letterSpacing:2, color:'var(--red-l)' }}>LOG DE BATALHA</span></div>
          <div style={{ display:'flex', gap:5 }}>
            <button className="btn btn-g btn-sm" onClick={rollBattle}>🎲 D20</button>
            <button className="btn btn-red btn-sm" onClick={addAction}>⚔️ Ação</button>
            <button className="btn btn-g btn-sm" onClick={clearAll}>🗑️</button>
          </div>
        </div>
        <div className="msgs" style={{ flex:1 }}>
          {log.length===0 && <div style={{ textAlign:'center', padding:16, color:'var(--dim)', fontSize:11 }}>Log vazio. Adicione combatentes e comece!</div>}
          {log.map(e=>(<div key={e.id} style={{ marginBottom:7, fontSize:11.5, lineHeight:1.5 }} dangerouslySetInnerHTML={{__html:e.html}} />))}
          <div ref={logEndRef} />
        </div>
        <div style={{ padding:9, borderTop:'1px solid var(--border)', background:'var(--card)', flexShrink:0 }}>
          <textarea className="tinp" rows={2} value={text} onChange={e=>setText(e.target.value)} placeholder="Descreva a ação de combate..." style={{ marginBottom:5 }} />
          <div style={{ display:'flex', gap:5 }}>
            <button className="btn btn-red" style={{ flex:1 }} onClick={addAction}>⚔️ Confirmar</button>
            <button className="btn btn-g" style={{ flex:1 }} onClick={()=>notify('🛡️ Defesa declarada!')}>🛡️ Defender</button>
          </div>
        </div>
      </div>

      {/* Fighters */}
      <div style={{ display:'flex', flexDirection:'column', overflowY:'auto', background:'var(--card)' }}>
        <div style={{ padding:10, borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontFamily:'Bangers,cursive', fontSize:12, letterSpacing:1, color:'var(--muted)' }}>COMBATENTES</span>
          <button className="btn btn-g btn-sm" onClick={()=>{setEditFighter(null);setShowAdd(true)}}>+ Add</button>
        </div>
        {fighters.length === 0 && <div style={{ fontSize:10, color:'var(--dim)', padding:14, textAlign:'center' }}>Nenhum combatente.<br/>Clique em "+ Add".</div>}
        {fighters.map(f => {
          const hpPct = f.hp_max>0 ? Math.min(100, Math.round(f.hp/f.hp_max*100)) : 100
          const hc = hpPct>50?'var(--green)':hpPct>25?'var(--gold)':'var(--red)'
          return (
            <div key={f.id} style={{ padding:12, borderBottom:'1px solid var(--border)', background: f.role==='villain'?'rgba(220,38,38,.03)':'transparent' }}>
              <div style={{ fontSize:8, color:ROLE_COLOR[f.role], letterSpacing:2, fontWeight:700, marginBottom:7, textTransform:'uppercase' }}>{ROLE_LABEL[f.role]}</div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <Avatar name={f.name} color={f.color} size={40} />
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:'Bangers,cursive', fontSize:15, letterSpacing:1, color:TEXT_COLOR[f.color] }}>{f.name}</div>
                  <div style={{ fontSize:9, color:'var(--muted)' }}>{f.quirk}</div>
                </div>
                <button onClick={()=>{setEditFighter(f);setShowAdd(true)}} style={{ background:'transparent', border:'none', color:'var(--dim)', cursor:'pointer' }}>✏️</button>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:4 }}>
                <span style={{ fontSize:8, color:'var(--dim)', width:16, textTransform:'uppercase' }}>HP</span>
                <div style={{ flex:1, height:6, background:'var(--border)', borderRadius:3, overflow:'hidden' }}><div style={{ height:'100%', width:`${hpPct}%`, background:hc, borderRadius:3, transition:'width .5s' }}/></div>
                <span style={{ fontFamily:'Orbitron,monospace', fontSize:9, color:hc, minWidth:44, textAlign:'right' }}>{f.hp}/{f.hp_max}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:4 }}>
                <span style={{ fontSize:8, color:'var(--purple-l)', width:16, textTransform:'uppercase' }}>QK</span>
                <div style={{ flex:1, height:6, background:'var(--border)', borderRadius:3, overflow:'hidden' }}><div style={{ height:'100%', width:`${f.qk||100}%`, background:'var(--purple)', borderRadius:3 }}/></div>
                <span style={{ fontFamily:'Orbitron,monospace', fontSize:9, color:'var(--purple-l)', minWidth:44, textAlign:'right' }}>{f.qk||100}%</span>
              </div>
              {f.status && <div style={{ fontSize:9, color:'var(--gold)', marginTop:3 }}>⚡ {f.status}</div>}
              {(f.moves||[]).length > 0 && (
                <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:6 }}>
                  {f.moves.map((m,i)=>(
                    <button key={i} onClick={()=>useMove(f,m)} style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:9, padding:'3px 8px', borderRadius:3, border:'1px solid var(--border)', background:'var(--panel)', color:'var(--muted)', cursor:'pointer' }}>
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showAdd && <FighterModal fighter={editFighter} onClose={()=>{setShowAdd(false);setEditFighter(null)}} onSaved={()=>{load();setShowAdd(false);setEditFighter(null)}} />}
    </div>
  )
}

function FighterModal({ fighter, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: fighter?.name||'', role: fighter?.role||'hero', color: fighter?.color||'blue',
    quirk: fighter?.quirk||'', hp: fighter?.hp??100, hp_max: fighter?.hp_max??100,
    qk: fighter?.qk??100, status: fighter?.status||'',
    movesText: (fighter?.moves||[]).map(m=>`${m.name}|${m.cost}`).join('\n')
  })
  const colors = ['red','blue','green','purple','gold','pink','teal','gray']
  function set(k,v){setForm(f=>({...f,[k]:v}))}
  async function handle(){
    if(!form.name.trim()){notify('❌ Nome obrigatório','error');return}
    const moves = form.movesText.trim().split('\n').filter(Boolean).map(l=>{const p=l.split('|');return{name:p[0]||'',cost:p[1]||''}})
    const payload = { name:form.name, role:form.role, color:form.color, quirk:form.quirk, hp:Number(form.hp), hp_max:Number(form.hp_max), qk:Number(form.qk), status:form.status, moves, session_id:SESSION_ID }
    if(fighter?.id) payload.id = fighter.id
    const { error } = await upsertFighter(payload)
    if(error){notify('❌ '+error.message,'error');return}
    notify('✅ Combatente salvo!','success'); onSaved()
  }
  return (
    <Modal title={fighter?'✏️ Combatente':'+ Combatente'} onClose={onClose}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div className="field"><label>Nome *</label><input className="input" value={form.name} onChange={e=>set('name',e.target.value)} /></div>
        <div className="field"><label>Função</label>
          <select className="input" value={form.role} onChange={e=>set('role',e.target.value)}>
            <option value="hero">⚡ Herói</option><option value="villain">💀 Vilão</option><option value="ally">🤝 Aliado</option>
          </select>
        </div>
        <div className="field"><label>Cor</label>
          <select className="input" value={form.color} onChange={e=>set('color',e.target.value)}>
            {colors.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field"><label>Quirk</label><input className="input" value={form.quirk} onChange={e=>set('quirk',e.target.value)} /></div>
        <div className="field"><label>HP Atual</label><input className="input" type="number" value={form.hp} onChange={e=>set('hp',e.target.value)} /></div>
        <div className="field"><label>HP Máximo</label><input className="input" type="number" value={form.hp_max} onChange={e=>set('hp_max',e.target.value)} /></div>
        <div className="field"><label>% Quirk</label><input className="input" type="number" min={0} max={100} value={form.qk} onChange={e=>set('qk',e.target.value)} /></div>
        <div className="field"><label>Status</label><input className="input" value={form.status} onChange={e=>set('status',e.target.value)} placeholder="Atordoado..." /></div>
      </div>
      <div className="field"><label>Movimentos — um por linha: Nome|Custo</label><textarea className="input" rows={3} value={form.movesText} onChange={e=>set('movesText',e.target.value)} placeholder={'Shadow Net|2d6+4\nVoid Slash|3d8+6'} /></div>
      <div style={{ display:'flex', gap:6 }}>
        <button className="btn btn-p btn-lg" onClick={handle} style={{ flex:1 }}>💾 Salvar</button>
        {fighter && <button className="btn btn-danger" onClick={async()=>{if(!confirm('Remover?'))return;await deleteFighter(fighter.id);notify('🗑️ Removido');onSaved()}}>🗑️</button>}
        <button className="btn btn-g" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  )
}

