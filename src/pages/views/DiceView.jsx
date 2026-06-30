import { useState } from 'react'

function d(sides){ return Math.floor(Math.random()*sides)+1 }

export default function DiceView() {
  const [result, setResult] = useState(null)
  const [label, setLabel] = useState('')
  const [qty, setQty] = useState(1)
  const [sides, setSides] = useState(20)
  const [mod, setMod] = useState(0)

  function quickRoll(s) {
    const r = d(s)
    const color = r===s ? '#4ade80' : r===1 ? '#f87171' : '#fbbf24'
    setResult({ value:r, color })
    setLabel(r===s ? `Máximo! 🌟` : r===1 ? 'Mínimo 💀' : `D${s} rolado`)
  }

  function multiRoll() {
    const q = Math.min(qty,20)
    const rolls = []
    let total = 0
    for (let i=0;i<q;i++){ const r=d(sides); rolls.push(r); total+=r }
    total += Number(mod)
    setResult({ value: total, color: '#fbbf24' })
    setLabel(`${q}d${sides}${mod!=0?(mod>=0?'+':'')+mod:''}  [${rolls.join(', ')}]${mod!=0?' + '+mod:''}  = ${total}`)
  }

  return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div className="card" style={{ width:'100%', maxWidth:420 }}>
        <div className="card-title">🎲 Mesa de Dados</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:14 }}>
          {[4,6,8,10,12,20].map(s=>(
            <button key={s} className="btn btn-g" style={{ padding:12, fontFamily:'Bangers,cursive', fontSize:16, letterSpacing:1 }} onClick={()=>quickRoll(s)}>D{s}</button>
          ))}
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:10, color:'var(--muted)', fontWeight:600, letterSpacing:.3, marginBottom:4, display:'block', textTransform:'uppercase' }}>Rolar Múltiplos</label>
          <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
            <input className="input" type="number" min={1} max={20} value={qty} onChange={e=>setQty(Number(e.target.value))} style={{ width:56 }} />
            <span style={{ color:'var(--muted)' }}>d</span>
            <input className="input" type="number" min={2} value={sides} onChange={e=>setSides(Number(e.target.value))} style={{ width:56 }} />
            <span style={{ color:'var(--muted)' }}>+</span>
            <input className="input" type="number" value={mod} onChange={e=>setMod(Number(e.target.value))} style={{ width:50 }} />
            <button className="btn btn-p btn-sm" onClick={multiRoll}>Rolar</button>
          </div>
        </div>

        <div style={{ textAlign:'center', fontFamily:'Orbitron,monospace', fontSize:34, minHeight:56, padding:8, color: result?.color || 'var(--gold)' }}>
          {result ? result.value : '—'}
        </div>
        <div style={{ textAlign:'center', fontSize:11, color:'var(--muted)' }}>{label}</div>
      </div>
    </div>
  )
}
