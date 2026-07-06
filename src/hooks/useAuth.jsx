import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, setOnline, getProfile, getCharacter } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [character, setCharacter] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        setUser(session.user)
        loadUserData(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        await loadUserData(session.user.id)
        await setOnline(session.user.id, true)
      } else {
        setProfile(null)
        setCharacter(null)
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
      window.__charSub?.unsubscribe()
    }
  }, [])

  // Mark offline on tab close
  useEffect(() => {
    const handleUnload = async () => {
      if (user) await setOnline(user.id, false)
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [user])

  async function loadUserData(userId) {
    const [{ data: prof }, { data: char }] = await Promise.all([
      getProfile(userId),
      getCharacter(userId)
    ])
    setProfile(prof)
    setCharacter(char)
    setLoading(false)

    // Subscribe to realtime character updates - refetch full row on change
    // (Supabase realtime sends only changed columns by default, not the full row)
    const charSub = supabase.channel(`char-rt-${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'characters',
        filter: `user_id=eq.${userId}`,
      }, async () => {
        // Always do a full refetch to get the complete character object
        const { data: freshChar } = await getCharacter(userId)
        if (freshChar) setCharacter(freshChar)
      })
      .subscribe()

    // Store ref for cleanup
    window.__charSub = charSub
  }

  async function refreshProfile() {
    if (!user) return
    const { data } = await getProfile(user.id)
    setProfile(data)
  }

  async function refreshCharacter() {
    if (!user) return
    const { data } = await getCharacter(user.id)
    setCharacter(data)
  }

  const value = {
    session,
    user,
    profile,
    character,
    loading,
    refreshProfile,
    refreshCharacter
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
