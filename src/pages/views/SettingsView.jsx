import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getServerConfig, updateServerConfig, supabase, updateProfile, uploadAvatar } from '../../lib/supabase'
import { notify } from '../../components/Toast'
import Avatar from '../../components/Avatar'

const THEMES = [
  { k:'dark',  l:'🌑 Escuro',  desc:'Fundo preto profundo com acentos azuis.', preview:['#07071A','#0F0F2E','#60A5FA'] },
  { k:'blue',  l:'🌊 Azul',   desc:'Dark blue, visual de cyber-oceano.',        preview:['#020B18','#041425','#64B5F6'] },
  { k:'light', l:'☀️ Claro',   desc:'Fundo claro para quem prefere alta legibilidade.', preview:['#F0F2F8','#FFFFFF','#2563EB'] },
]

export default function SettingsView({ serverName, onServerNameChange, onThemeChange, currentTheme }) {
  const { user, profile, refreshProfile } = useAuth()
  const [config, setConfig]       = useState(null)
  const [nameInput, setNameInput] = useState(serverName)
  const [saving, setSaving]       = useState(false)
  const [avatarFile, setAvatarFile]     = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || null)
  const [savingAvatar, setSavingAvatar]   = useState(false)

  useEffect(() => {
    getServerConfig().then(({ data }) => { if (data) { setConfig(data); setNameInput(data.server_name) } })
  }, [])

  async function handleSaveServerName() {
    if (!config) return
    setSaving(true)
    const { error } = await updateServerConfig(config.id, { server_name: nameInput })
    setSaving(false)
    if (error) { notify('❌ ' + error.message, 'error'); return }
    onServerNameChange(nameInput)
    notify('✅ Nome do servidor atualizado!', 'success')
  }

  function handleAvatarChange(e) {
    const file = e.target.files[0]; if (!file) return
    if (file.size > 2 * 1024 * 1024) { notify('❌ Máx 2MB', 'error'); return }
    setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file))
  }

  async function handleSaveAvatar() {
    if (!avatarFile) return
    setSavingAvatar(true)
    const { url, error } = await uploadAvatar(user.id, avatarFile)
    if (error) { notify('❌ Erro no upload', 'error'); setSavingAvatar(false); return }
    await updateProfile(user.id, { avatar_url: url })
    await refreshProfile()
    setSavingAvatar(false)
    notify('✅ Foto de perfil atualizada!', 'success')
  }

  return (
    <div style={{ flex:1, overflowY:'auto', padding:14 }}>
      <div style={{ fontFamily:'Bangers,cursive', fontSize:20, letterSpacing:3, color:'var(--text)', marginBottom:16 }}>⚙️ CONFIGURAÇÕES</div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, maxWidth:760 }}>

        {/* TEMA */}
        <div className="card" style={{ gridColumn:'1/-1' }}>
          <div className="card-title">🎨 Tema Visual</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
            {THEMES.map(t => (
              <div key={t.k} onClick={() => onThemeChange(t.k)}
                style={{ borderRadius:8, border:`2px solid ${currentTheme===t.k?'var(--blue)':'var(--border)'}`, padding:12, cursor:'pointer', background: currentTheme===t.k?'rgba(37,99,235,.08)':'transparent', transition:'all .2s' }}>
                <div style={{ display:'flex', gap:5, marginBottom:9 }}>
                  {t.preview.map((c,i) => <div key={i} style={{ flex:1, height:24, borderRadius:4, background:c }} />)}
                </div>
                <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:13, marginBottom:3 }}>{t.l}</div>
                <div style={{ fontSize:10, color:'var(--muted)' }}>{t.desc}</div>
                {currentTheme===t.k && <div style={{ fontSize:10, color:'var(--blue-l)', marginTop:5, fontWeight:700 }}>✓ Ativo</div>}
              </div>
            ))}
          </div>
          <div style={{ fontSize:10, color:'var(--dim)', marginTop:8 }}>A preferência de tema é salva no seu perfil e carregada automaticamente ao entrar.</div>
        </div>

        {/* FOTO DE PERFIL */}
        <div className="card">
          <div className="card-title">🖼️ Foto de Perfil</div>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:10 }}>
            <div style={{ position:'relative' }}>
              <Avatar name={profile?.username} url={avatarPreview} size={64} />
              <label style={{ position:'absolute', bottom:-2, right:-2, width:22, height:22, borderRadius:'50%', background:'var(--blue)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:11 }}>
                📷<input type="file" accept="image/*" style={{ display:'none' }} onChange={handleAvatarChange} />
              </label>
            </div>
            <div>
              <div style={{ fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:14 }}>@{profile?.username}</div>
              <div style={{ fontSize:10, color:'var(--dim)', marginTop:2 }}>JPG/PNG, máx 2MB</div>
            </div>
          </div>
          <button className="btn btn-p btn-sm" disabled={!avatarFile || savingAvatar} onClick={handleSaveAvatar}>
            {savingAvatar ? '⏳ Enviando...' : '💾 Salvar foto'}
          </button>
        </div>

        {/* NOME DO SERVIDOR */}
        <div className="card">
          <div className="card-title">🏷️ Servidor</div>
          <div className="field"><label>Nome exibido na sidebar</label><input className="input" value={nameInput} onChange={e=>setNameInput(e.target.value)} /></div>
          <button className="btn btn-p btn-sm" disabled={saving} onClick={handleSaveServerName}>{saving?'⏳...':'💾 Salvar'}</button>
        </div>

        {/* CONTA */}
        <div className="card" style={{ gridColumn:'1/-1' }}>
          <div className="card-title">👤 Conta</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.8 }}>
                <div>E-mail: <strong style={{ color:'var(--text)' }}>{user?.email}</strong></div>
                <div>Usuário: <strong style={{ color:'var(--text)' }}>@{profile?.username}</strong></div>
                <div>Membro desde: <strong style={{ color:'var(--text)' }}>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR') : '—'}</strong></div>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, justifyContent:'flex-end' }}>
              <button className="btn btn-danger btn-sm" onClick={async () => { if (!confirm('Sair de todos os dispositivos?')) return; await supabase.auth.signOut({ scope:'global' }) }}>
                🚪 Sair de todos os dispositivos
              </button>
            </div>
          </div>
        </div>

        {/* SOBRE */}
        <div className="card" style={{ gridColumn:'1/-1' }}>
          <div className="card-title">ℹ️ Sobre o Plus Ultra RPG</div>
          <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.8 }}>
            Plataforma de RPG textual inspirada em Boku no Hero Academia.<br/>
            Personagens, Quirks, sistema de combate dentro dos locais, NPCs, missões com XP automático e muito mais — tudo salvo em tempo real no Supabase.<br/><br/>
            <strong style={{ color:'var(--blue-l)' }}>Dica para narradores:</strong> Vá em <strong>NPCs</strong> para criar personagens narradores, depois use o botão <strong>🎭 NPC</strong> dentro de qualquer local para falar como eles no chat.
          </div>
        </div>
      </div>
    </div>
  )
}
