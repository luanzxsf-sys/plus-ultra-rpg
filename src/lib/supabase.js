import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltam variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { params: { eventsPerSecond: 10 } }
})

// ─── AUTH helpers ───────────────────────────────────────────

export async function signUp({ email, password, username }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } }
  })
  return { data, error }
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

// ─── PROFILE helpers ────────────────────────────────────────

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return { data, error }
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, last_seen: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()
  return { data, error }
}

export async function setOnline(userId, isOnline) {
  await supabase
    .from('profiles')
    .update({ is_online: isOnline, last_seen: new Date().toISOString() })
    .eq('id', userId)
}

export async function getAllProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, characters(name, alias, avatar_url, avatar_color, rank, quirk_data)')
    .order('is_online', { ascending: false })
  return { data, error }
}

// ─── CHARACTER helpers ──────────────────────────────────────

export async function getCharacter(userId) {
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return { data, error }
}

export async function upsertCharacter(userId, charData) {
  const { data, error } = await supabase
    .from('characters')
    .upsert({ user_id: userId, ...charData }, { onConflict: 'user_id' })
    .select()
    .single()
  return { data, error }
}

// ─── AVATAR upload ──────────────────────────────────────────

export async function uploadAvatar(userId, file) {
  const ext = file.name.split('.').pop()
  const path = `${userId}/avatar.${ext}`
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true })
  if (uploadError) return { url: null, error: uploadError }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

// ─── ITEMS helpers ──────────────────────────────────────────

export async function getItems(userId) {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order')
  return { data: data || [], error }
}

export async function upsertItem(userId, item) {
  const payload = { user_id: userId, ...item }
  if (item.id) {
    const { data, error } = await supabase.from('items').update(payload).eq('id', item.id).select().single()
    return { data, error }
  }
  const { data, error } = await supabase.from('items').insert(payload).select().single()
  return { data, error }
}

export async function deleteItem(itemId) {
  const { error } = await supabase.from('items').delete().eq('id', itemId)
  return { error }
}

// ─── QUESTS helpers ─────────────────────────────────────────

export async function getQuests(userId) {
  const { data, error } = await supabase
    .from('quests')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order')
  return { data: data || [], error }
}

export async function upsertQuest(userId, quest) {
  const payload = { user_id: userId, ...quest }
  if (quest.id) {
    const { data, error } = await supabase.from('quests').update(payload).eq('id', quest.id).select().single()
    return { data, error }
  }
  const { data, error } = await supabase.from('quests').insert(payload).select().single()
  return { data, error }
}

export async function deleteQuest(questId) {
  const { error } = await supabase.from('quests').delete().eq('id', questId)
  return { error }
}

export async function getReputation(userId) {
  const { data, error } = await supabase.from('reputation').select('*').eq('user_id', userId).single()
  return { data, error }
}

export async function updateReputation(userId, rep) {
  const { data, error } = await supabase.from('reputation').update(rep).eq('user_id', userId).select().single()
  return { data, error }
}

// ─── SERVER CONFIG ──────────────────────────────────────────

export async function getServerConfig() {
  const { data, error } = await supabase.from('server_config').select('*').limit(1).single()
  return { data, error }
}

export async function updateServerConfig(id, updates) {
  const { data, error } = await supabase.from('server_config').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  return { data, error }
}

// ─── LOCATIONS helpers ──────────────────────────────────────

export async function getLocations() {
  const { data, error } = await supabase.from('locations').select('*').order('sort_order').order('created_at')
  return { data: data || [], error }
}

export async function upsertLocation(loc) {
  if (loc.id) {
    const { data, error } = await supabase.from('locations').update(loc).eq('id', loc.id).select().single()
    return { data, error }
  }
  const { data, error } = await supabase.from('locations').insert(loc).select().single()
  return { data, error }
}

export async function deleteLocation(locId) {
  const { error } = await supabase.from('locations').delete().eq('id', locId)
  return { error }
}

// ─── MESSAGES helpers ───────────────────────────────────────

export async function getMessages(locationId, limit = 50) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return { data: (data || []).reverse(), error }
}

export async function sendMessage(msg) {
  const { data, error } = await supabase.from('messages').insert(msg).select().single()
  return { data, error }
}

// ─── FEED helpers ───────────────────────────────────────────

export async function getFeedPosts(limit = 20) {
  const { data, error } = await supabase.from('feed_posts').select('*').order('created_at', { ascending: false }).limit(limit)
  return { data: data || [], error }
}

export async function createPost(post) {
  const { data, error } = await supabase.from('feed_posts').insert(post).select().single()
  return { data, error }
}

export async function deletePost(postId) {
  const { error } = await supabase.from('feed_posts').delete().eq('id', postId)
  return { error }
}

export async function likePost(postId, currentLikes) {
  const { error } = await supabase.from('feed_posts').update({ likes: currentLikes + 1 }).eq('id', postId)
  return { error }
}

// ─── NEWS helpers ───────────────────────────────────────────

export async function getNews() {
  const { data, error } = await supabase.from('news').select('*').order('created_at', { ascending: false }).limit(10)
  return { data: data || [], error }
}

export async function createNews(n) {
  const { data, error } = await supabase.from('news').insert(n).select().single()
  return { data, error }
}

export async function deleteNews(id) {
  const { error } = await supabase.from('news').delete().eq('id', id)
  return { error }
}

// ─── EVENTS helpers ─────────────────────────────────────────

export async function getEvents() {
  const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: false })
  return { data: data || [], error }
}

export async function createEvent(ev) {
  const { data, error } = await supabase.from('events').insert(ev).select().single()
  return { data, error }
}

export async function deleteEvent(id) {
  const { error } = await supabase.from('events').delete().eq('id', id)
  return { error }
}

// ─── RANKING helpers ────────────────────────────────────────

export async function getRanking() {
  const { data, error } = await supabase.from('ranking').select('*').order('points', { ascending: false })
  return { data: data || [], error }
}

export async function upsertRankEntry(entry) {
  if (entry.id) {
    const { data, error } = await supabase.from('ranking').update(entry).eq('id', entry.id).select().single()
    return { data, error }
  }
  const { data, error } = await supabase.from('ranking').insert(entry).select().single()
  return { data, error }
}

export async function deleteRankEntry(id) {
  const { error } = await supabase.from('ranking').delete().eq('id', id)
  return { error }
}

// ─── ARENA helpers ──────────────────────────────────────────

export async function getFighters(sessionId) {
  const { data, error } = await supabase.from('fighters').select('*').eq('session_id', sessionId).order('created_at')
  return { data: data || [], error }
}

export async function upsertFighter(fighter) {
  if (fighter.id) {
    const { data, error } = await supabase.from('fighters').update(fighter).eq('id', fighter.id).select().single()
    return { data, error }
  }
  const { data, error } = await supabase.from('fighters').insert(fighter).select().single()
  return { data, error }
}

export async function deleteFighter(id) {
  const { error } = await supabase.from('fighters').delete().eq('id', id)
  return { error }
}

export async function getBattleLog(sessionId, limit = 80) {
  const { data, error } = await supabase.from('battle_log').select('*').eq('session_id', sessionId).order('created_at').limit(limit)
  return { data: data || [], error }
}

export async function addBattleLog(entry) {
  const { data, error } = await supabase.from('battle_log').insert(entry).select().single()
  return { data, error }
}

export async function clearBattleLog(sessionId) {
  const { error } = await supabase.from('battle_log').delete().eq('session_id', sessionId)
  const { error: e2 } = await supabase.from('fighters').delete().eq('session_id', sessionId)
  return { error: error || e2 }
}

// ─── Extended signUp — saves initial character after registration ───
// (Re-exported so AuthPage can call it directly)
export async function signUpWithChar({ email, password, username, charName, charAlias, charColor }) {
  // 1. Create auth user (trigger auto-creates profile + reputation row)
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } }
  })
  if (error) return { data, error }

  const userId = data?.user?.id
  if (!userId) return { data, error: new Error('Usuário não criado') }

  // 2. Create initial character skeleton
  await supabase.from('characters').upsert({
    user_id: userId,
    name: charName,
    alias: charAlias || '',
    avatar_color: charColor || 'purple',
    specialty: '',
    hp: 100, hp_max: 100,
    quirk_charge: 100, quirk_max: 100,
    stamina: 100, stamina_max: 100,
    xp: 0, xp_max: 1000,
    attrs: { forca: 50, agilidade: 50, controle: 50, resistencia: 50, inteligencia: 50, carisma: 50 },
    quirk_data: { name: '', type: '', subtype: '', level: 1, range: '', weakness: '', dominio: 0, carga: 100, description: '', awakening: '', skills: [] }
  }, { onConflict: 'user_id' })

  return { data, error: null }
}
