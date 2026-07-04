import { gradeLabel, gradeColor, ATTR_META, ATTR_KEYS, calcDerived, SPECIALTIES, calcAttrsWithSpecialty } from '../lib/gameSystem'

const TOTAL_POINTS = 60
const ATTR_MIN = 1
const ATTR_MAX_BASE = 20  // máximo na criação; sem cap depois

export default function AttrBuilder({ attrs, onChange, readOnly, quirk_type, traits = [], specialty }) {
  const used = ATTR_KEYS.reduce((s, k) => s + (attrs[k] || 0), 0)
  const left = TOTAL_POINTS - used
  const effectiveAttrs = specialty ? calcAttrsWithSpecialty(attrs, specialty) : attrs
  const derived = calcDerived(effectiveAttrs, quirk_type, traits)

  function inc(k) {
    if (readOnly || left <= 0) return
    onChange({ ...attrs, [k]: (attrs[k] || 0) + 1 })
  }
  function dec(k) {
    if (readOnly || (attrs[k] || 0) <= ATTR_MIN) return
    onChange({ ...attrs, [k]: (attrs[k] || 0) - 1 })
  }

  const specObj = SPECIALTIES.find(s => s.key === specialty)

  return (
    <div>
      {!readOnly && (
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14, padding:'10px 12px', background:'var(--panel)', borderRadius:8, border:'1px solid var(--border)' }}>
          <div>
            <div className="points-left">{left}</div>
            <div style={{ fontSize:9, color:'var(--dim)', textTransform:'uppercase', letterSpacing:1 }}>pontos</div>
          </div>
          <div style={{ flex:1, fontSize:11, color:'var(--muted)', lineHeight:1.6 }}>
            Distribua {TOTAL_POINTS} pontos.<br/>
            <span style={{ color:'var(--gold)', fontSize:10 }}>Resistência +5HP · Controle +5Quirk · Stamina +3Stamina</span>
          </div>
        </div>
      )}

      {specObj && (
        <div style={{ marginBottom:10, padding:'7px 10px', background:'rgba(88,101,242,.08)', borderRadius:6, border:'1px solid rgba(88,101,242,.25)', fontSize:10, color:'var(--blue-l)' }}>
          {specObj.icon} <strong>{specObj.label}</strong>: {Object.entries(specObj.bonuses).map(([k,v])=>`+${v} ${ATTR_META[k]?.label||k}`).join(' · ')}
          <div style={{ fontSize:10, color:'var(--dim)', marginTop:2 }}>🎯 {specObj.passive}</div>
        </div>
      )}

      {ATTR_KEYS.map(k => {
        const base = attrs[k] || 0
        const effective = effectiveAttrs[k] || 0
        const bonus = effective - base
        const meta = ATTR_META[k]
        const pct  = Math.min(100, (effective / 30) * 100)  // 30 = cap visual
        const grade = gradeLabel(effective)
        const gcolor = gradeColor(effective)
        return (
          <div key={k} className="attr-builder-row">
            <div className="attr-builder-name" title={meta.desc}>{meta.label}</div>
            {!readOnly && (
              <div className="attr-builder-controls">
                <button className="attr-btn" onClick={()=>dec(k)} disabled={base<=ATTR_MIN}>−</button>
                <span className="attr-val">{base}</span>
                <button className="attr-btn" onClick={()=>inc(k)} disabled={base>=ATTR_MAX_BASE||left<=0}>+</button>
              </div>
            )}
            {readOnly && (
              <span className="attr-val" style={{ fontFamily:'Orbitron,monospace', fontSize:12, marginRight:4, color:'var(--text-h)' }}>
                {effective}
                {bonus>0 && <span style={{ fontSize:8, color:'var(--green-l)', marginLeft:2 }}>+{bonus}</span>}
              </span>
            )}
            <div className="attr-bar-wrap">
              <div className="attr-bar-fill" style={{ width:`${pct}%`, background: meta.color }} />
            </div>
            <span className="attr-grade" style={{ color: gcolor, fontSize:10 }}>{grade}</span>
          </div>
        )
      })}

      <div style={{ marginTop:12, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
        {[
          { l:'HP Máx',      v: derived.hpMax,      c:'var(--red-l)' },
          { l:'Quirk Máx',   v: derived.quirkMax,   c:'var(--purple-l)' },
          { l:'Stamina Máx', v: derived.staminaMax, c:'var(--blue-l)' },
        ].map(s => (
          <div key={s.l} style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:5, padding:'6px 8px', textAlign:'center' }}>
            <div style={{ fontSize:8, color:'var(--dim)', textTransform:'uppercase', letterSpacing:1, marginBottom:2 }}>{s.l}</div>
            <div style={{ fontFamily:'Orbitron,monospace', fontSize:13, fontWeight:700, color:s.c }}>{s.v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
