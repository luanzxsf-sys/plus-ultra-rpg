import { useState } from 'react'
import { gradeLabel, gradeColor, ATTR_META, ATTR_KEYS, calcDerived, calcEffectiveAttrs, SPECIALTIES } from '../lib/gameSystem'

const TOTAL_POINTS = 60
const ATTR_MIN = 1

export default function AttrBuilder({
  attrs, onChange, readOnly,
  quirk_type, traits = [], specialty,
}) {
  // Step is LOCAL state — no need to pass from parent
  const [step, setStep] = useState(1)

  const used = ATTR_KEYS.reduce((s, k) => s + (attrs[k] || 0), 0)
  const left = TOTAL_POINTS - used
  const { effective, bonuses } = calcEffectiveAttrs(attrs, quirk_type, traits, specialty)
  const derived = calcDerived(attrs, quirk_type, traits, specialty)

  function inc(k) {
    if (readOnly) return
    const canAdd = Math.min(step, left)
    if (canAdd <= 0) return
    onChange({ ...attrs, [k]: (attrs[k] || 0) + canAdd })
  }

  function dec(k) {
    if (readOnly) return
    const canSub = Math.min(step, (attrs[k] || 0) - ATTR_MIN)
    if (canSub <= 0) return
    onChange({ ...attrs, [k]: (attrs[k] || 0) - canSub })
  }

  const specObj = SPECIALTIES.find(s => s.key === specialty)

  // Group bonuses by attr for inline display
  const bonusByAttr = {}
  bonuses.forEach(b => {
    if (!bonusByAttr[b.attr]) bonusByAttr[b.attr] = []
    bonusByAttr[b.attr].push(b)
  })

  const STEPS = [1, 5, 10]

  function handleCustomStep() {
    const v = parseInt(prompt('Passo personalizado (1–50):', step), 10)
    if (!isNaN(v) && v >= 1 && v <= 50) setStep(v)
  }

  return (
    <div>
      {!readOnly && (
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, padding:'10px 12px', background:'var(--panel)', borderRadius:8, border:'1px solid var(--border)' }}>
          <div>
            <div style={{ fontFamily:'Orbitron,monospace', fontSize:26, fontWeight:700, color:left<=0?'var(--red-l)':'var(--gold)', lineHeight:1 }}>{left}</div>
            <div style={{ fontSize:9, color:'var(--dim)', textTransform:'uppercase', letterSpacing:1 }}>pontos</div>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, color:'var(--muted)', marginBottom:6 }}>
              Distribua {TOTAL_POINTS} pts · <span style={{ color:'var(--gold)' }}>Resistência +5HP · Controle +5Quirk · Stamina +3Stamina</span>
            </div>
            <div style={{ display:'flex', gap:4, alignItems:'center' }}>
              <span style={{ fontSize:9, color:'var(--dim)', textTransform:'uppercase', letterSpacing:.5 }}>Passo:</span>
              {STEPS.map(s => (
                <button key={s} onClick={() => setStep(s)}
                  className={`btn btn-sm ${step === s ? 'btn-p' : 'btn-g'}`}
                  style={{ padding:'2px 10px', fontSize:10, minWidth:32 }}>
                  {s}
                </button>
              ))}
              <button onClick={handleCustomStep}
                className={`btn btn-sm ${!STEPS.includes(step) ? 'btn-p' : 'btn-g'}`}
                style={{ padding:'2px 10px', fontSize:10, minWidth:36 }}>
                {!STEPS.includes(step) ? `✓${step}` : '?'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bonus summary */}
      {(specObj || bonuses.length > 0) && (
        <div style={{ marginBottom:10, padding:'7px 10px', background:'rgba(88,101,242,.08)', borderRadius:6, border:'1px solid rgba(88,101,242,.2)' }}>
          {specObj && (
            <div style={{ fontSize:10, color:'var(--blue-l)', fontWeight:700, marginBottom: bonuses.filter(b=>b.sourceType!=='specialty').length>0?4:0 }}>
              {specObj.icon} {specObj.label}: {Object.entries(specObj.bonuses).map(([k,v]) => `+${v} ${ATTR_META[k]?.label}`).join(' · ')}
            </div>
          )}
          {bonuses.filter(b => b.sourceType !== 'specialty').map((b, i) => (
            <div key={i} style={{ fontSize:10, color:b.color, fontWeight:700 }}>
              ✦ {b.source}: +{b.value} {ATTR_META[b.attr]?.label}
            </div>
          ))}
        </div>
      )}

      {/* Attribute rows */}
      {ATTR_KEYS.map(k => {
        const base      = attrs[k] || 0
        const eff       = effective[k] || 0
        const extraBons = bonusByAttr[k] || []
        const pct       = Math.min(100, (eff / 40) * 100)
        const meta      = ATTR_META[k]
        return (
          <div key={k} className="attr-builder-row">
            <div className="attr-builder-name" title={meta.desc}>{meta.label}</div>

            {!readOnly ? (
              <div className="attr-builder-controls">
                <button className="attr-btn" onClick={() => dec(k)}
                  disabled={base <= ATTR_MIN}>−</button>
                <span className="attr-val">{base}</span>
                <button className="attr-btn" onClick={() => inc(k)}
                  disabled={left <= 0}>+</button>
              </div>
            ) : (
              <span className="attr-val" style={{ fontFamily:'Orbitron,monospace', fontSize:12, marginRight:4, color:'var(--text-h)' }}>{base}</span>
            )}

            {/* Bonus badge */}
            {extraBons.length > 0 ? (
              <span style={{ fontSize:9, fontWeight:700, color:'var(--gold)', minWidth:30, textAlign:'center' }}
                title={extraBons.map(b=>`+${b.value} ${b.source}`).join(', ')}>
                +{extraBons.reduce((s, b) => s + b.value, 0)}
              </span>
            ) : (
              <span style={{ minWidth:30 }} />
            )}

            <div className="attr-bar-wrap">
              <div className="attr-bar-fill" style={{ width:`${pct}%`, background:meta.color }} />
            </div>
            <span className="attr-grade" style={{ color:gradeColor(eff), fontSize:10, minWidth:28, textAlign:'right' }}>
              {gradeLabel(eff)}
            </span>
          </div>
        )
      })}

      {/* Derived stats */}
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
