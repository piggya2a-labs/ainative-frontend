'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { createClient } from './supabase-client'

type AuthContextType = {
  user: User | null
  session: Session | null
  loading: boolean
  signInAnonymously: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signInAnonymously: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // 每次渲染都用同一个 client 实例
  const supabase = createClient()

  const refreshSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    setSession(session)
    setUser(session?.user ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    // 初始化时获取 session
    refreshSession()

    // 监听 auth 状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInAnonymously = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) {
      console.error('Anonymous sign in error:', error.message)
      setLoading(false)
      return
    }
    // 手动同步状态，不依赖 onAuthStateChange 时序
    if (data.session) {
      setSession(data.session)
      setUser(data.session.user)
    }
    setLoading(false)
  }, [])

  const signOut = useCallback(async () => {
    setLoading(true)
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setLoading(false)
  }, [])

  return (
    <AuthContext.Provider value={{ user, session, loading, signInAnonymously, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useUser() {
  return useContext(AuthContext)
}
