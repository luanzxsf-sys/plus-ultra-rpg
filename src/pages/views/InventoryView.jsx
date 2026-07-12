import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getItems, upsertItem, deleteItem, getReputation, updateReputation } from '../../lib/supabase'
import { notify } from '../../components/Toast'
import Modal from '../../components/Modal'

const RARITY_COLORS = { S:'#ff79c6', A:'var(--purple-l)', B:'var(--blue-l)', C:'var(--green-l)', D:'var(--muted)' }

export default function InventoryView() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [credits, setCredits] = useState(0)
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [showCredits, setShowCredits] = useState(false)

  async function load() {
    const { data } = await getItems(user.id)
    if (data) setItems(data)
    const { data: rep } = await getReputation(user.id)
    if (rep) setCredits(rep.credits || 0)
  }

  useEffect(() => { load() }, [])

  const equipped = items.filter(i=>i.equipped)
  const consumables = items.filter(i=>!i.equipped && ['consumível','consumivel','poção','pocao'].some(t=>i.type?.toLowerCase().includes(t)))
  const others = items.filter(i=>!i.equipped && !['consumível','consumivel','poção','pocao'].some(t=>i.type?.toLowerCase().includes(t)))

  function renderGroup(label, group) {
    if (!group.length) return null
    return (
      <div style={{ marginBottom:14 }}>
        <div style={{ fontFamily:'Bangers,cursive', fontSize:12, letterSpacing:1, color:'var(--dim)', marginBottom:7, textTransform:'uppercase' }}>{label}</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
          {group.map(item => (
            <div key={item.id}
              onClick={()=>setSelected(item)}
              onDoubleClick={()=>{ setEditItem(item); setShowAdd(true) }}
              style={{ background:'var(--card)', border:`1px solid ${selected?.id===item.id?'var(--glow)':item.equipped?'rgba(242,183,5,.4)':'var(--border)'}`, borderRadius:8, padding:'10px 7px', textAlign:'center', cursor:'pointer', position:'relative', transition:'all .2s' }}
              onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
              onMouseLeave={e=>e.currentTarget.style.transform='none'}
            >
              {item.equipped && <div style={{ position:'absolute', top:5, right:5, fontSize:7, background:'var(--gold-d)', color:'#000', padding:'1px 3px', borderRadius:2, fontWeight:700 }}>EQ</div>}
              <span style={{ fontSize:26, display:'block', marginBottom:4 }}>{item.icon||'📦'}</span>
              <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:11, color: RARITY_COLORS[item.rarity]||'var(--text)', marginBottom:1 }}>{item.name}</div>
              <div style={{ fontSize:9, color:'var(--muted)' }}>{item.type}</div>
              {item.qty > 1 && <div style={{ fontFamily:'Orbitron,monospace', fontSize:8, color:'var(--dim)', marginTop:2 }}>x{item.qty}</div>}
            </div>
          ))}
          <div onClick={()=>{setEditItem(null);setShowAdd(true)}} style={{ background:'var(--card)', border:'1px dashed var(--border)', borderRadius:8, padding:'10px 7px', textAlign:'center', cursor:'pointer', opacity:.5, transition:'opacity .2s' }}
            onMouseEnter={e=>e.currentTarget.style.opacity='1'} onMouseLeave={e=>e.currentTarget.style.opacity='.5'}>
            <span style={{ fontSize:22, display:'block', marginBottom:4 }}>➕</span>
            <div style={{ fontSize:10, color:'var(--muted)' }}>Adicionar</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex:1, overflowY:'auto', padding:14 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
        <div style={{ fontFamily:'Bangers,cursive', fontSize:20, letterSpacing:3, color:'var(--gold)' }}>INVENTÁRIO</div>
        <button className="btn btn-p btn-sm" onClick={()=>{setEditItem(null);setShowAdd(true)}}>+ Item</button>
        <span style={{ marginLeft:'auto', fontSize:11, color:'var(--muted)' }}>
          💰 <strong style={{ color:'var(--gold)', fontFamily:'Orbitron,monospace' }}>{credits}</strong> créditos
          <button className="btn btn-g btn-sm" style={{ marginLeft:6 }} onClick={()=>setShowCredits(true)}>✏️</button>
        </span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:14 }}>
        <div>
          {items.length === 0 && (
            <div style={{ textAlign:'center', padding:32, color:'var(--muted)', fontSize:12 }}>
              <div style={{ fontSize:36, marginBottom:8 }}>🎒</div>
              Inventário vazio. Clique em "+ Item" para adicionar.
            </div>
          )}
          {renderGroup('⚔️ Equipados', equipped)}
          {renderGroup('💊 Consumíveis', consumables)}
          {renderGroup('📦 Outros', others)}
        </div>

        {/* Detail panel */}
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, padding:14, position:'sticky', top:0, alignSelf:'start' }}>
          {!selected ? (
            <div style={{ textAlign:'center', padding:'24px 0', color:'var(--muted)', fontSize:11 }}>
              <div style={{ fontSize:32, marginBottom:8 }}>👆</div>
              Clique em um item para ver detalhes
            </div>
          ) : (
            <>
              <div style={{ fontSize:32, textAlign:'center', marginBottom:8 }}>{selected.icon||'📦'}</div>
              <div style={{ fontFamily:'Bangers,cursive', fontSize:18, letterSpacing:1, marginBottom:2, color: RARITY_COLORS[selected.rarity]||'var(--text)' }}>{selected.name}</div>
              <div style={{ fontSize:10, color:'var(--muted)', marginBottom:10 }}>
                {selected.type} · <span style={{ color: RARITY_COLORS[selected.rarity]||'var(--text)' }}>Raridade {selected.rarity}</span>
                {selected.qty > 1 ? ` · x${selected.qty}` : ''}
                {selected.equipped ? ' · Equipado ✓' : ''}
              </div>
              {selected.stats && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, padding:'5px 8px', background:'var(--panel)', borderRadius:4, border:'1px solid var(--border)', marginBottom:5 }}>
                  <span style={{ color:'var(--muted)' }}>Efeito</span>
                  <span style={{ color:'var(--gold)', fontSize:10 }}>{selected.stats}</span>
                </div>
              )}
              {selected.description && <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.5, margin:'8px 0' }}>{selected.description}</div>}
              <div style={{ display:'flex', gap:5, marginTop:10 }}>
                <button className="btn btn-p btn-sm" style={{ flex:1 }} onClick={()=>notify('✅ Item usado!')}>Usar</button>
                <button className="btn btn-g btn-sm" style={{ flex:1 }} onClick={()=>{setEditItem(selected);setShowAdd(true)}}>✏️</button>
                <button className="btn btn-danger btn-sm" onClick={async()=>{
                  if(!confirm('Remover?'))return
                  await deleteItem(selected.id); setSelected(null); load(); notify('🗑️ Removido')
                }}>🗑️</button>
              </div>
            </>
          )}
        </div>
      </div>

      {showAdd && <ItemModal item={editItem} onClose={()=>{setShowAdd(false);setEditItem(null)}} onSaved={()=>{ load(); setShowAdd(false); setEditItem(null) }} userId={user.id} />}
      {showCredits && <CreditsModal current={credits} onClose={()=>setShowCredits(false)} onSaved={async v=>{ await updateReputation(user.id,{credits:v}); setCredits(v); setShowCredits(false) }} />}
    </div>
  )
}

function ItemModal({ item, onClose, onSaved, userId }) {
  const [form, setForm] = useState({ name:item?.name||'', icon:item?.icon||'📦', type:item?.type||'', rarity:item?.rarity||'C', qty:item?.qty||1, equipped:item?.equipped||false, stats:item?.stats||'', description:item?.description||'' })
  const [saving, setSaving] = useState(false)
  function set(k,v){setForm(f=>({...f,[k]:v}))}
  async function handle(){
    if(!form.name.trim()){notify('❌ Nome obrigatório','error');return}
    setSaving(true)
    const payload = { ...form, qty:Number(form.qty) }
    if(item?.id) payload.id = item.id
    const { error } = await upsertItem(userId, payload)
    setSaving(false)
    if(error){notify('❌ '+error.message,'error');return}
    notify('✅ Item salvo!','success'); onSaved()
  }
  return (
    <Modal title={item?'✏️ Editar Item':'+ Novo Item'} onClose={onClose}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div className="field"><label>Nome *</label><input className="input" value={form.name} onChange={e=>set('name',e.target.value)} /></div>
        <div className="field"><label>Ícone (emoji)</label><input className="input" value={form.icon} onChange={e=>set('icon',e.target.value)} placeholder="📦" /></div>
        <div className="field"><label>Tipo</label><input className="input" value={form.type} onChange={e=>set('type',e.target.value)} placeholder="Equipamento, Consumível..." /></div>
        <div className="field"><label>Raridade</label>
          <select className="input" value={form.rarity} onChange={e=>set('rarity',e.target.value)}>
            {['S','A','B','C','D'].map(r=><option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="field"><label>Quantidade</label><input className="input" type="number" min={1} value={form.qty} onChange={e=>set('qty',e.target.value)} /></div>
        <div className="field"><label>Equipado?</label>
          <select className="input" value={form.equipped?'true':'false'} onChange={e=>set('equipped',e.target.value==='true')}>
            <option value="false">Não</option><option value="true">Sim</option>
          </select>
        </div>
      </div>
      <div className="field"><label>Efeitos / Stats</label><input className="input" value={form.stats} onChange={e=>set('stats',e.target.value)} placeholder="Ex: ATK +10, DEF +5" /></div>
      <div className="field"><label>Descrição</label><textarea className="input" rows={2} value={form.description} onChange={e=>set('description',e.target.value)} /></div>
      <div style={{ display:'flex', gap:6 }}>
        <button className="btn btn-p btn-lg" onClick={handle} disabled={saving} style={{ flex:1 }}>{saving?'⏳...':'💾 Salvar'}</button>
        {item && <button className="btn btn-danger" onClick={async()=>{if(!confirm('Remover?'))return;await deleteItem(item.id);notify('🗑️ Removido');onSaved()}}>🗑️</button>}
        <button className="btn btn-g" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  )
}

function CreditsModal({ current, onClose, onSaved }) {
  const [val, setVal] = useState(current)
  return (
    <Modal title="💰 Créditos" onClose={onClose} maxWidth={360}>
      <div className="field"><label>Quantidade de Créditos</label><input className="input" type="number" min={0} value={val} onChange={e=>setVal(Number(e.target.value))} /></div>
      <div style={{ display:'flex', gap:6 }}>
        <button className="btn btn-p btn-lg" onClick={()=>onSaved(val)} style={{ flex:1 }}>💾 Salvar</button>
        <button className="btn btn-g" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  )
}
