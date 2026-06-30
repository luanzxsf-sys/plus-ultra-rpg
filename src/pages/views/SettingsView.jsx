import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getServerConfig, updateServerConfig, supabase, updateProfile, uploadAvatar } from '../../lib/supabase'
import { notify } from '../../components/Toast'
import Avatar from '../../components/Avatar'

export default function SettingsView({ serverName, onServerNameChange }) {
  const { user, profile, refreshProfile } = useAuth()
  const [config, setConfig] = useState(null)
  const [nameInput, setNameInput] = useState(serverName)
  const [saving, setSaving] = useState(false)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || null)
  const [savingAvatar, setSavingAvatar] = useState(false)

  useEffect(() => {
    getServerConfig().then(({ data }) => { if (data) { setConfig(data); setNameInput(data.server_name) } })
  }, [])

  async function handleSaveServerName() {
    if (!config) return
    setSaving(true)
    const { error } = await updateServerConfig(config.id, { server_name: nameInput })
    setSaving(false)
    if (error) { notify('❌ '+error.message,'error'); return }
    onServerNameChange(nameInput)
    notify('✅ Nome do servidor atualizado!','success')
  }

  function handleAvatarChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2*1024*1024) { notify('❌ Imagem muito grande (máx 2MB)','error'); return }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function handleSaveAvatar() {
    if (!avatarFile) return
    setSavingAvatar(true)
    const { url, error } = await uploadAvatar(user.id, avatarFile)
    if (error) { notify('❌ Erro no upload','error'); setSavingAvatar(false); return }
    await updateProfile(user.id, { avatar_url: url })
    await refreshProfile()
    setSavingAvatar(false)
    notify('✅ Foto de perfil atualizada!','success')
  }

  async function handleSignOutAllDevices() {
    if (!confirm('Isso vai te desconectar. Continuar?')) return
    await supabase.auth.signOut({ scope: 'global' })
  }

  return (
    <div style={{ flex:1, overflowY:'auto', padding:14 }}>
      <div style={{ fontFamily:'Bangers,cursive', fontSize:20, letterSpacing:3, color:'var(--text)', marginBottom:14 }}>⚙️ CONFIGURAÇÕES</div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, maxWidth:760 }}>
        {/* Profile photo */}
        <div className="card">
          <div className="card-title">🖼️ Foto de Perfil</div>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:10 }}>
            <div style={{ position:'relative' }}>
              <Avatar name={profile?.username} url={avatarPreview} size={64} />
              <label style={{ position:'absolute', bottom:-2, right:-2, width:22, height:22, borderRadius:'50%', background:'var(--blue)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:11 }}>
                📷
                <input type="file" accept="image/*" style={{ display:'none' }} onChange={handleAvatarChange} />
              </label>
            </div>
            <div style={{ fontSize:11, color:'var(--muted)' }}>
              @{profile?.username}<br/>
              <span style={{ fontSize:10, color:'var(--dim)' }}>JPG/PNG, máx 2MB</span>
            </div>
          </div>
          <button className="btn btn-p btn-sm" disabled={!avatarFile || savingAvatar} onClick={handleSaveAvatar}>
            {savingAvatar ? '⏳ Enviando...' : '💾 Salvar foto'}
          </button>
        </div>

        {/* Server name */}
        <div className="card">
          <div className="card-title">🏷️ Nome do Servidor</div>
          <div className="field"><label>Nome exibido na sidebar</label><input className="input" value={nameInput} onChange={e=>setNameInput(e.target.value)} /></div>
          <button className="btn btn-p btn-sm" disabled={saving} onClick={handleSaveServerName}>{saving?'⏳...':'💾 Salvar'}</button>
        </div>

        {/* Account */}
        <div className="card">
          <div className="card-title">👤 Conta</div>
          <div style={{ fontSize:11, color:'var(--muted)', marginBottom:10 }}>
            E-mail: <strong style={{ color:'var(--text)' }}>{user?.email}</strong><br/>
            Membro desde: <strong style={{ color:'var(--text)' }}>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR') : '—'}</strong>
          </div>
          <button className="btn btn-danger btn-sm" onClick={handleSignOutAllDevices}>🚪 Sair de todos os dispositivos</button>
        </div>

        {/* About */}
        <div className="card">
          <div className="card-title">ℹ️ Sobre</div>
          <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.6 }}>
            Plus Ultra RPG — plataforma de roleplay textual inspirada em Boku no Hero Academia.<br/><br/>
            Todos os dados (personagens, mensagens, missões, inventário) ficam armazenados de forma segura no Supabase, vinculados à sua conta.
          </div>
        </div>
      </div>
    </div>
  )
}
