import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

type AuthContextValue = {
  session: Session | null
  user: User | null
  loading: boolean
  recoveryMode: boolean
  signOut: () => Promise<void>
  completePasswordRecovery: (password: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recoveryMode, setRecoveryMode] = useState(false)

  useEffect(() => {
    let mounted = true

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return
      if (error) {
        setSession(null)
      } else {
        setSession(data.session)
      }
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      setRecoveryMode(event === 'PASSWORD_RECOVERY')
      setLoading(false)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      recoveryMode,
      signOut: async () => {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
        setRecoveryMode(false)
      },
      completePasswordRecovery: async (password: string) => {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        setRecoveryMode(false)
      },
    }),
    [session, loading, recoveryMode],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
