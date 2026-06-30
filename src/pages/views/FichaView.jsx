import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { upsertCharacter, uploadAvatar } from '../../lib/supabase'
import { notify } from '../../components/Toast'
import Modal from '../../components/Modal'
import Avatar, { avatarBg } from '../../components/Avatar'

const COLORS = [
  { key: 'purple', bg: 'linear-gradient(135deg,#7c3aed,#5b21b6)' },
  { key: 'blue',   bg: 'linear-gradient(135deg,#2563eb,#1d4ed8)' },
  { key: 'red',    bg: 'linear-gradient(135deg,#dc2626,#991b1b)' },
  { key: 'green',  bg: 'linear-gradient(135deg,#16a34a,#15803d)' },
  { key: 'gold',   bg: 'linear-gradient(135deg,#d97706,#b45309)' },
  { key: 'pink',   bg: 'linear-gradient(135deg,#db2777,#be185d)' },
  { key: 'teal',   bg: 'linear-gradient(135deg,#0891b2,#0e7490)' },
  { key: 'gray',   bg: 'linear-gradient(135deg,#374151,#1f2937)' },
]

const ATTR_COLORS = {
  forca: 'var(--red)', agilidade: 'var(--green)', controle: 'var(--blue)',
  resistencia: 'var(--gold)', inteligencia: 'var(--purple)', carisma: 'var(--blue-l)'
}

function gradeLabel(v) {
  if (v >= 90) return 'S'; if (v >= 75) return 'A'; if (v >= 60) return 'B'
  if (v >= 45) return 'C'; if (v >= 30) return 'D'; return 'E'
}

function pct(a, b) { return b > 0 ? Math.min(100, Math.round(a / b * 100)) : 100 }

/* ── EDIT MODAL ── */
function EditCharModal({ char, onClose, onSaved }) {
  const { user } = useAuth()
  const [form, setForm] = useState({
    name: char?.name || '',
    alias: char?.alias || '',
    age: char?.age || '',
    height: char?.height || '',
    affiliation: char?.affiliation || '',
    rank: char?.rank || '',
    specialty: char?.specialty || '',
    bio: char?.bio || '',
    avatar_color: char?.avatar_color || 'purple',
    hp: char?.hp ?? 100,
    hp_max: char?.hp_max ?? 100,
    quirk_charge: char?.quirk_charge ?? 100,
    quirk_max: char?.quirk_max ?? 100,
    stamina: char?.stamina ?? 100,
    stamina_max: char?.stamina_max ?? 100,
    xp: char?.xp ?? 0,
    xp_max: char?.xp_max ?? 1000,
    attrs: { ...(char?.attrs || { forca: 50, agilidade: 50, controle: 50, resistencia: 50, inteligencia: 50, carisma: 50 }) }
  })
  const [saving, setSaving] = useState(false)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(char?.avatar_url || null)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function setAttr(k, v) { setForm(f => ({ ...f, attrs: { ...f.attrs, [k]: Number(v) } })) }

  function handleAvatarChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { notify('❌ Imagem muito grande (máx 2MB)', 'error'); return }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!form.name.trim()) { notify('❌ Nome do personagem obrigatório', 'error'); return }
    setSaving(true)
    let avatar_url = char?.avatar_url || null

    if (avatarFile) {
      const { url, error } = await uploadAvatar(user.id, avatarFile)
      if (error) notify('⚠️ Erro no upload da foto', 'error')
      else avatar_url = url
    }

    const payload = { ...form, avatar_url, quirk_data: char?.quirk_data || { name: '', type: '', subtype: '', level: 1, range: '', weakness: '', dominio: 0, carga: 100, description: '', awakening: '', skills: [] } }
    const { error } = await upsertCharacter(user.id, payload)
    setSaving(false)
    if (error) { notify('❌ Erro ao salvar: ' + error.message, 'error'); return }
    notify('✅ Personagem salvo!', 'success')
    onSaved()
    onClose()
  }

  return (
    <Modal title="✏️ Editar Personagem" onClose={onClose} maxWidth={620}>
      {/* Avatar upload */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, padding: '12px 14px', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8 }}>
        <div style={{ position: 'relative' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: avatarBg(form.avatar_color), display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontFamily: 'Bangers, cursive', fontSize: 24, color: '#fff' }}>
            {avatarPreview
              ? <img src={avatarPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (form.name[0] || '?').toUpperCase()
            }
          </div>
          <label style={{ position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: '50%', background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 10 }}>
            📷
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
          </label>
        </div>
        <div>
          <div style={{ fontFamily: 'Bangers, cursive', fontSize: 18, letterSpacing: 1 }}>{form.name || '—'}</div>
          <div style={{ fontSize: 9, color: 'var(--gold)', letterSpacing: 2 }}>{form.alias ? `"${form.alias}"` : 'Codinome'}</div>
          <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>Clique em 📷 para adicionar foto</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="field"><label>Nome Real *</label><input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Emi Yakumo" /></div>
        <div className="field"><label>Codinome</label><input className="input" value={form.alias} onChange={e => set('alias', e.target.value)} placeholder='Ex: "Shadowlace"' /></div>
        <div className="field"><label>Idade</label><input className="input" value={form.age} onChange={e => set('age', e.target.value)} placeholder="Ex: 17 anos" /></div>
        <div className="field"><label>Altura</label><input className="input" value={form.height} onChange={e => set('height', e.target.value)} placeholder="Ex: 165 cm" /></div>
        <div className="field"><label>Afiliação</label><input className="input" value={form.affiliation} onChange={e => set('affiliation', e.target.value)} placeholder="Ex: U.A. High · 2-A" /></div>
        <div className="field"><label>Rank Herói</label><input className="input" value={form.rank} onChange={e => set('rank', e.target.value)} placeholder="Ex: Rank B" /></div>
        <div className="field" style={{ gridColumn: '1/-1' }}><label>Especialidade</label><input className="input" value={form.specialty} onChange={e => set('specialty', e.target.value)} placeholder="Ex: Captura não-letal, Suporte" /></div>
      </div>

      <div className="field"><label>Cor do Avatar</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          {COLORS.map(c => (
            <div key={c.key} onClick={() => set('avatar_color', c.key)} style={{ width: 26, height: 26, borderRadius: '50%', background: c.bg, cursor: 'pointer', border: `2px solid ${form.avatar_color === c.key ? '#fff' : 'transparent'}`, transition: 'border .15s' }} />
          ))}
        </div>
      </div>

      <div className="field"><label>Histórico / Bio</label><textarea className="input" rows={3} value={form.bio} onChange={e => set('bio', e.target.value)} placeholder="Escreva a história do seu personagem..." /></div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, margin: '4px 0 10px' }}>
        <div style={{ fontFamily: 'Bangers, cursive', fontSize: 13, color: 'var(--blue-l)', marginBottom: 8, letterSpacing: 1 }}>⚡ ATRIBUTOS (0–100)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {Object.keys(form.attrs).map(a => (
            <div key={a} className="field">
              <label>{a.charAt(0).toUpperCase() + a.slice(1)}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input className="input" type="number" min={0} max={100} value={form.attrs[a]} onChange={e => setAttr(a, e.target.value)} style={{ width: 60 }} />
                <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${form.attrs[a]}%`, background: ATTR_COLORS[a], borderRadius: 3 }} />
                </div>
                <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 10, color: 'var(--text)', width: 16 }}>{gradeLabel(form.attrs[a])}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, margin: '4px 0 10px' }}>
        <div style={{ fontFamily: 'Bangers, cursive', fontSize: 13, color: 'var(--green-l)', marginBottom: 8, letterSpacing: 1 }}>❤️ VITAIS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {[
            { l: 'HP Atual', k: 'hp' }, { l: 'HP Máx', k: 'hp_max' },
            { l: 'Quirk Atual', k: 'quirk_charge' }, { l: 'Quirk Máx', k: 'quirk_max' },
            { l: 'Stamina', k: 'stamina' }, { l: 'Stamina Máx', k: 'stamina_max' },
            { l: 'EXP', k: 'xp' }, { l: 'EXP Máx', k: 'xp_max' },
          ].map(f => (
            <div key={f.k} className="field">
              <label>{f.l}</label>
              <input className="input" type="number" min={0} value={form[f.k]} onChange={e => set(f.k, Number(e.target.value))} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-p btn-lg" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
          {saving ? '⏳ Salvando...' : '💾 Salvar Personagem'}
        </button>
        <button className="btn btn-g" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  )
}

/* ── MAIN VIEW ── */
export default function FichaView() {
  const { user, character, refreshCharacter } = useAuth()
  const [showEdit, setShowEdit] = useState(false)
  const char = character

  async function handleSaved() { await refreshCharacter() }

  if (!char) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, color: 'var(--muted)' }}>
      <div style={{ fontSize: 48 }}>🦸</div>
      <div style={{ fontFamily: 'Bangers, cursive', fontSize: 22, letterSpacing: 2, color: 'var(--blue-l)' }}>NENHUM PERSONAGEM</div>
      <div style={{ fontSize: 13 }}>Crie seu herói para começar a jogar!</div>
      <button className="btn btn-p btn-lg" onClick={() => setShowEdit(true)}>✦ Criar Personagem</button>
      {showEdit && <EditCharModal char={null} onClose={() => setShowEdit(false)} onSaved={handleSaved} />}
    </div>
  )

  const skills = (char.quirk_data?.skills || []).filter(s => !s.locked).slice(0, 4)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{ fontFamily: 'Bangers, cursive', fontSize: 20, letterSpacing: 3, color: 'var(--blue-l)' }}>FICHA DO HERÓI</div>
        <button className="btn btn-p btn-sm" onClick={() => setShowEdit(true)}>✏️ Editar</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 12 }}>
        {/* LEFT COL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Identity card */}
          <div className="card">
            <div className="card-title">👤 Identidade</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <Avatar name={char.name} color={char.avatar_color} url={char.avatar_url} size={56} />
              <div>
                <div style={{ fontFamily: 'Bangers, cursive', fontSize: 20, letterSpacing: 1 }}>{char.name}</div>
                {char.alias && <div style={{ fontSize: 10, color: 'var(--gold)', letterSpacing: 2 }}>"{char.alias}"</div>}
                {char.rank && (
                  <span className="tag" style={{ background: 'rgba(220,38,38,.2)', color: 'var(--red-l)', border: '1px solid rgba(220,38,38,.3)', marginTop: 4 }}>
                    {char.rank}
                  </span>
                )}
              </div>
            </div>
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
              <tbody>
                {[
                  { l: 'Afiliação', v: char.affiliation, c: 'var(--blue-l)' },
                  { l: 'Idade', v: char.age },
                  { l: 'Altura', v: char.height },
                  { l: 'Especialidade', v: char.specialty, c: 'var(--purple-l)' },
                ].filter(r => r.v).map(r => (
                  <tr key={r.l}>
                    <td style={{ color: 'var(--dim)', paddingBottom: 4, width: 110, fontWeight: 600 }}>{r.l}</td>
                    <td style={{ color: r.c || 'var(--text)', paddingBottom: 4 }}>{r.v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Attributes */}
          <div className="card">
            <div className="card-title">📊 Atributos</div>
            {Object.entries(char.attrs || {}).map(([a, v]) => (
              <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 11, color: 'var(--muted)', width: 85, textTransform: 'uppercase', flexShrink: 0 }}>{a}</span>
                <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${v}%`, background: ATTR_COLORS[a] || 'var(--blue-l)', borderRadius: 3, transition: 'width .4s' }} />
                </div>
                <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 11, fontWeight: 700, color: 'var(--text)', width: 18, textAlign: 'right', flexShrink: 0 }}>{gradeLabel(v)}</span>
              </div>
            ))}
          </div>

          {/* Vitals */}
          <div className="card">
            <div className="card-title">❤️ Vitais</div>
            {[
              { l: 'HP',     v: char.hp,           m: char.hp_max,      c: 'var(--green)' },
              { l: 'Quirk',  v: char.quirk_charge, m: char.quirk_max,   c: 'var(--purple)' },
              { l: 'Stamina',v: char.stamina,       m: char.stamina_max, c: 'var(--blue)' },
              { l: 'EXP',    v: char.xp,            m: char.xp_max,      c: 'linear-gradient(90deg,var(--blue),var(--purple))' },
            ].map(b => {
              const p = pct(b.v, b.m)
              return (
                <div key={b.l} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--dim)', marginBottom: 3 }}>
                    <span>{b.l}</span><span>{b.v}/{b.m}</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${p}%`, background: b.c, borderRadius: 3, transition: 'width .4s' }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Bio */}
          {char.bio && (
            <div className="card">
              <div className="card-title">🧠 Histórico</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.7 }}>
                {char.bio.split('\n').map((l, i) => <p key={i} style={{ marginBottom: 4 }}>{l}</p>)}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Quirk */}
          {char.quirk_data?.name ? (
            <div className="card card-purple">
              <div className="card-title" style={{ color: 'var(--purple-l)' }}>✨ Quirk — {char.quirk_data.name}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 10 }}>
                {[
                  { l: 'Tipo',     v: char.quirk_data.type,     c: 'var(--purple-l)' },
                  { l: 'Nível',    v: `Nv.${char.quirk_data.level}`, c: 'var(--gold)', mono: true },
                  { l: 'Alcance',  v: char.quirk_data.range,    c: 'var(--blue-l)' },
                  { l: 'Fraqueza', v: char.quirk_data.weakness, c: 'var(--red-l)' },
                ].filter(s => s.v).map(s => (
                  <div key={s.l} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 5, padding: '7px', textAlign: 'center' }}>
                    <div style={{ fontSize: 7, letterSpacing: 1, color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 3 }}>{s.l}</div>
                    <div style={{ fontFamily: s.mono ? 'Orbitron, monospace' : 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 12, color: s.c }}>{s.v}</div>
                  </div>
                ))}
              </div>
              {/* Domínio & Carga */}
              {[
                { l: 'CARGA DO QUIRK', v: char.quirk_data.carga || 100, c: 'linear-gradient(90deg,var(--purple),var(--blue-l))', vc: 'var(--purple-l)' },
                { l: 'DOMÍNIO',        v: char.quirk_data.dominio || 0, c: 'linear-gradient(90deg,var(--gold-d),var(--gold))',  vc: 'var(--gold)' },
              ].map(b => (
                <div key={b.l} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--dim)', letterSpacing: 1, marginBottom: 3 }}>
                    <span>{b.l}</span><span style={{ color: b.vc }}>{b.v}%</span>
                  </div>
                  <div style={{ height: 7, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${b.v}%`, background: b.c, borderRadius: 4, transition: 'width .5s' }} />
                  </div>
                </div>
              ))}
              {char.quirk_data.description && (
                <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 10 }}>
                  {char.quirk_data.description}
                </div>
              )}
              {char.quirk_data.awakening && (
                <div style={{ background: 'rgba(255,179,0,.06)', border: '1px solid rgba(255,179,0,.2)', borderRadius: 5, padding: 8 }}>
                  <div style={{ fontSize: 9, color: 'var(--gold)', fontWeight: 700, letterSpacing: 1, marginBottom: 3, textTransform: 'uppercase' }}>⚡ Awakening</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{char.quirk_data.awakening}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="card card-glow">
              <div className="card-title">✨ Quirk</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Configure seu Quirk no menu <strong>Quirk &amp; Habilidades</strong>.</div>
            </div>
          )}

          {/* Técnicas */}
          {skills.length > 0 && (
            <div className="card">
              <div className="card-title">⚔️ Técnicas</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {skills.map((s, i) => (
                  <div key={i} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 5, padding: '8px 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 12, color: 'var(--text)' }}>
                        {s.icon || '⚡'} {s.name}
                      </span>
                      <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 9, color: 'var(--gold)' }}>Nv.{s.level}</span>
                    </div>
                    <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 9, color: 'var(--red-l)', marginBottom: 2 }}>{s.cost}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.4 }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showEdit && (
        <EditCharModal char={char} onClose={() => setShowEdit(false)} onSaved={handleSaved} />
      )}
    </div>
  )
}
