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
  // Step 1: get all profiles
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('*')
    .order('is_online', { ascending: false })
  if (pErr || !profiles) return { data: profiles, error: pErr }

  // Step 2: get all characters (avoids reverse-FK join issues)
  const { data: chars } = await supabase
    .from('characters')
    .select('user_id, name, alias, age, height, affiliation, avatar_url, avatar_color, rank, specialty, bio, quirk_data, attrs, hp, hp_max, quirk_charge, quirk_max, stamina, stamina_max, xp, xp_max, xp_total, level, quirk_level')

  // Step 3: manually attach characters to profiles
  const charMap = {}
  ;(chars || []).forEach(c => { charMap[c.user_id] = c })

  const merged = profiles.map(p => ({
    ...p,
    characters: charMap[p.id] ? [charMap[p.id]] : []
  }))

  return { data: merged, error: null }
}

export async function updateTheme(userId, theme) {
  const { error } = await supabase.from('profiles').update({ theme }).eq('id', userId)
  return { error }
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
  // Strip XP/level fields — those are ONLY updated by addXpToCharacter
  // Prevents ficha edits from resetting earned XP and level
  const { xp_total, level, ...safeData } = charData
  const { data, error } = await supabase
    .from('characters')
    .upsert({ user_id: userId, ...safeData }, { onConflict: 'user_id' })
    .select()
    .single()
  return { data, error }
}

// ─── IMAGE upload helpers (generic) ──────────────────────────

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

export async function uploadToBucket(bucket, pathPrefix, file) {
  const ext = file.name.split('.').pop()
  const path = `${pathPrefix}/${Date.now()}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true })
  if (uploadError) return { url: null, error: uploadError }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
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
// Missões agora podem ser vistas/geridas pelo dono OU por usuários vinculados (assigned_users)

export async function getQuests(userId) {
  const { data: all, error } = await supabase
    .from('quests')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return { data: [], error }
  // Filter: show quests owned by user OR where user is in assigned_users
  const visible = (all || []).filter(q =>
    q.user_id === userId ||
    (Array.isArray(q.assigned_users) && q.assigned_users.includes(userId))
  )
  // Sort: active first, then completed
  visible.sort((a, b) => {
    if (a.completed === b.completed) return new Date(b.created_at) - new Date(a.created_at)
    return a.completed ? 1 : -1
  })
  return { data: visible, error: null }
}

export async function getAllQuests() {
  const { data, error } = await supabase.from('quests').select('*').order('created_at', { ascending: false })
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

export async function completeQuest(questId, callerId) {
  // 1. Fetch the quest with all recipients
  const { data: quest, error: qErr } = await supabase
    .from('quests')
    .select('*')
    .eq('id', questId)
    .single()
  if (qErr || !quest) return { data: null, error: qErr }

  // 2. Mark as completed
  const { data, error } = await supabase
    .from('quests')
    .update({ completed: true, is_active: false, completed_at: new Date().toISOString() })
    .eq('id', questId)
    .select()
    .single()
  if (error) return { data, error }

  // 3. Distribute XP to owner + all assigned users (deduplicated)
  const xp = quest.xp_reward || 100
  const recipients = [...new Set(
    [quest.user_id, ...(quest.assigned_users || [])].filter(Boolean)
  )]

  let leveledUp = false, newLevel = null, oldLevel = null
  for (const uid of recipients) {
    const result = await addXpToCharacter(uid, xp)
    // Track level-up for the caller specifically
    if (uid === callerId || uid === quest.user_id) {
      leveledUp = result.leveledUp || false
      newLevel  = result.newLevel  || null
      oldLevel  = result.oldLevel  || null
    }
  }

  return { data, error: null, xpAwarded: xp, recipientCount: recipients.length, leveledUp, newLevel, oldLevel }
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

// ─── LOCATIONS helpers (agora com capa, fundo e modo combate) ──

export async function getLocations() {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  return { data: data || [], error }
}

export async function getLocation(id) {
  const { data, error } = await supabase.from('locations').select('*').eq('id', id).single()
  return { data, error }
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

// ─── MESSAGES helpers (com NPC e imagem) ─────────────────────

export async function getMessages(locationId, limit = 60) {
  let q = supabase.from('messages').select('*')
  if (locationId == null) {
    q = q.is('location_id', null)    // global chat
  } else {
    q = q.eq('location_id', locationId)
  }
  const { data, error } = await q
    .order('created_at', { ascending: false })
    .limit(limit)
  return { data: (data || []).reverse(), error }
}

export async function sendMessage(msg) {
  const { data, error } = await supabase.from('messages').insert(msg).select().single()
  return { data, error }
}

export async function deleteMessage(id) {
  const { error } = await supabase.from('messages').delete().eq('id', id)
  return { error }
}

// ─── NPCs helpers ─────────────────────────────────────────────

export async function getNpcs() {
  const { data, error } = await supabase.from('npcs').select('*').order('name')
  return { data: data || [], error }
}

export async function upsertNpc(npc) {
  if (npc.id) {
    const { data, error } = await supabase.from('npcs').update(npc).eq('id', npc.id).select().single()
    return { data, error }
  }
  const { data, error } = await supabase.from('npcs').insert(npc).select().single()
  return { data, error }
}

export async function deleteNpc(id) {
  const { error } = await supabase.from('npcs').delete().eq('id', id)
  return { error }
}

// ─── FEED helpers (newsletter — aceita imagem e NPC) ─────────

export async function getFeedPosts(limit = 30) {
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

// ─── Extended signUp — APENAS conta, sem criar personagem ────

export async function signUpAccount({ email, password, username }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } }
  })
  return { data, error }
}

// ─── TRAITS helpers ─────────────────────────────────────────

export async function getPresetTraits() {
  const { data, error } = await supabase.from('traits').select('*').order('rank').order('name')
  return { data: data || [], error }
}

export async function createCustomTrait(userId, trait) {
  // Strip UI-only fields (attr_bonus, bonus_value) that are not DB columns
  // The 'effect' field is already built by the caller from these
  const { attr_bonus, bonus_value, ...rest } = trait
  const payload = { ...rest, is_preset: false, created_by: userId }
  const { data, error } = await supabase.from('traits')
    .insert(payload)
    .select().single()
  return { data, error }
}

export async function getCharacterTraits(userId) {
  const { data, error } = await supabase
    .from('character_traits')
    .select('*, traits(*)')
    .eq('user_id', userId)
  return { data: data || [], error }
}

export async function addTraitToCharacter(userId, traitId) {
  const { data, error } = await supabase.from('character_traits')
    .insert({ user_id: userId, trait_id: traitId })
    .select('*, traits(*)')
    .single()
  return { data, error }
}

export async function removeTraitFromCharacter(userId, traitId) {
  const { error } = await supabase.from('character_traits')
    .delete()
    .eq('user_id', userId)
    .eq('trait_id', traitId)
  return { error }
}

// ─── COMBAT SESSION helpers ──────────────────────────────────

export async function getActiveCombatSession(locationId) {
  const { data, error } = await supabase
    .from('combat_sessions')
    .select('*')
    .eq('location_id', locationId)
    .eq('is_active', true)
    .maybeSingle()
  return { data, error }
}

export async function createCombatSession(locationId, questId, userId) {
  const { data, error } = await supabase
    .from('combat_sessions')
    .insert({ location_id: locationId, quest_id: questId, created_by: userId })
    .select().single()
  return { data, error }
}

export async function endCombatSession(sessionId) {
  const { error } = await supabase.from('combat_sessions')
    .update({ is_active: false })
    .eq('id', sessionId)
  return { error }
}

export async function updateSessionTurn(sessionId, currentTurn, round) {
  const { error } = await supabase.from('combat_sessions')
    .update({ current_turn: currentTurn, round })
    .eq('id', sessionId)
  return { error }
}

// ─── COMBATANTS helpers ──────────────────────────────────────

export async function getCombatants(sessionId) {
  const { data, error } = await supabase
    .from('combatants')
    .select('*')
    .eq('session_id', sessionId)
    .order('initiative', { ascending: false })
  return { data: data || [], error }
}

export async function addCombatant(combatant) {
  const { data, error } = await supabase.from('combatants').insert(combatant).select().single()
  return { data, error }
}

export async function updateCombatant(id, updates) {
  const { data, error } = await supabase.from('combatants').update(updates).eq('id', id).select().single()
  return { data, error }
}

export async function deleteCombatant(id) {
  const { error } = await supabase.from('combatants').delete().eq('id', id)
  return { error }
}

// Aplica dano ou cura a um combatant (negativo = dano, positivo = cura)
export async function applyCombatEffect(combatantId, hpDelta, quirkDelta = 0) {
  const { data: c, error: fetchErr } = await supabase
    .from('combatants').select('hp, hp_max, quirk_charge, quirk_max, is_alive').eq('id', combatantId).single()
  if (fetchErr) return { error: fetchErr }
  const newHp = Math.max(0, Math.min(c.hp_max, c.hp + hpDelta))
  const newQk = Math.max(0, Math.min(c.quirk_max, c.quirk_charge + quirkDelta))
  const isAlive = newHp > 0
  const { data, error } = await supabase.from('combatants')
    .update({ hp: newHp, quirk_charge: newQk, is_alive: isAlive })
    .eq('id', combatantId).select().single()
  // Se foi um jogador, sincroniza com a ficha real
  if (!error && data?.user_id) {
    await supabase.from('characters')
      .update({ hp: newHp, quirk_charge: newQk })
      .eq('user_id', data.user_id)
  }
  return { data, error }
}

// ─── COMBAT ACTIONS helpers ──────────────────────────────────

export async function getCombatActions(sessionId, limit = 80) {
  const { data, error } = await supabase
    .from('combat_actions')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at')
    .limit(limit)
  return { data: data || [], error }
}

export async function addCombatAction(action) {
  const { data, error } = await supabase.from('combat_actions').insert(action).select().single()
  return { data, error }
}

export async function clearCombatActions(sessionId) {
  const { error } = await supabase.from('combat_actions').delete().eq('session_id', sessionId)
  return { error }
}

// ─── LEVEL & XP helpers ─────────────────────────────────────
// XP model: xp_total is ALWAYS growing (never reset).
// level and xp_max are derived from xp_total and stored for display.
// Thresholds: level N costs floor(1000 * 1.25^(N-1)) XP

function _xpForLevel(level) {
  return Math.floor(1000 * Math.pow(1.25, level - 1))
}

function _calcLevelFromTotal(xpTotal) {
  let level = 1, acc = 0
  while (true) {
    const needed = _xpForLevel(level)
    if (acc + needed > xpTotal) break
    acc += needed
    level++
    if (level > 999) break
  }
  return { level, xpIntoLevel: xpTotal - acc, xpForThisLevel: _xpForLevel(level) }
}

// Adds XP to a character. Stores xp_total, updates level + xp/xp_max for display.
export async function addXpToCharacter(userId, xpAmount) {
  // Read current state - use select('*') to avoid missing-column errors
  const { data: char, error: fetchErr } = await supabase
    .from('characters')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (fetchErr || !char) return { error: fetchErr }

  // xp_total: cumulative XP ever earned (never decreases)
  // Falls back to char.xp if xp_total column didn't exist yet
  const oldTotal = (char.xp_total != null && char.xp_total > 0)
    ? char.xp_total
    : (char.xp || 0)
  const newTotal = oldTotal + xpAmount
  const oldLevel = char.level ?? 1
  const { level: newLevel, xpIntoLevel, xpForThisLevel } = _calcLevelFromTotal(newTotal)
  const leveledUp = newLevel > oldLevel

  // Build update payload - only include columns we know exist
  const updatePayload = {
    xp:     xpIntoLevel,    // XP progress within current level (bar display)
    xp_max: xpForThisLevel, // XP needed for next level
    level:  newLevel,       // current level (now stored in DB)
  }
  // Try to set xp_total if the column exists (it may not on older DBs)
  try {
    updatePayload.xp_total = newTotal
  } catch (_) {}

  const { data, error } = await supabase
    .from('characters')
    .update(updatePayload)
    .eq('user_id', userId)
    .select()
    .single()

  return { data, error, leveledUp, newLevel, oldLevel }
}

// Adds XP to multiple users at once (quest complete)
export async function addXpToUsers(userIds, xpAmount) {
  const results = await Promise.all(
    userIds.map(uid => addXpToCharacter(uid, xpAmount))
  )
  return results
}

// ─── RANKING realtime helpers ────────────────────────────────

export async function upsertRankFromCharacter(userId, charData) {
  // Cria ou atualiza entrada no ranking baseada na ficha
  const { data: existing } = await supabase
    .from('ranking').select('id').eq('user_id', userId).maybeSingle()
  const payload = {
    user_id:     userId,
    player_name: charData.name || 'Herói',
    char_name:   charData.alias || charData.name || '',
    quirk_name:  charData.quirk_data?.name || '',
    points:      charData.xp || 0,
    rank_badge:  charData.rank || '',
    color:       charData.avatar_color || 'blue',
  }
  if (existing?.id) {
    payload.id = existing.id
    const { data, error } = await supabase.from('ranking').update(payload).eq('id', existing.id).select().single()
    return { data, error }
  }
  const { data, error } = await supabase.from('ranking').insert(payload).select().single()
  return { data, error }
}

// ── QUIRK XP ─────────────────────────────────────────────────
// Quirk XP thresholds (inline to avoid circular import)
const QUIRK_THRESHOLDS = [0, 100, 300, 700, 1500]
function _calcQuirkLevel(qxp) {
  let lv = 1
  for (let i = QUIRK_THRESHOLDS.length - 1; i >= 0; i--) {
    if (qxp >= QUIRK_THRESHOLDS[i]) { lv = i + 1; break }
  }
  return Math.min(lv, 5)
}

// Called after using a technique in combat
export async function addQuirkXp(userId, xpAmount) {
  const { data: char, error: fetchErr } = await supabase
    .from('characters')
    .select('quirk_xp, quirk_level')
    .eq('user_id', userId)
    .single()
  if (fetchErr || !char) return { error: fetchErr }

  const newXp    = (char.quirk_xp || 0) + xpAmount
  const newLevel = _calcQuirkLevel(newXp)
  const oldLevel = char.quirk_level || 1

  const { data, error } = await supabase
    .from('characters')
    .update({ quirk_xp: newXp, quirk_level: newLevel })
    .eq('user_id', userId)
    .select()
    .single()
  return { data, error, leveledUp: newLevel > oldLevel, newLevel }
}
