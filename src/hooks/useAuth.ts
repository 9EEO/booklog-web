import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'

type AuthState = {
  user: User | null
  isLoading: boolean
  error: string | null
  sendMagicLink: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

export const useAuth = (): AuthState => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(supabase))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      return
    }

    let isMounted = true

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!isMounted) return

      setUser(data.session?.user ?? null)
      setError(sessionError?.message ?? null)
      setIsLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const sendMagicLink = async (email: string) => {
    if (!supabase) {
      setError('Supabase 환경변수가 설정되지 않았습니다.')
      return
    }

    setError(null)
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })

    if (signInError) {
      setError(signInError.message)
      throw signInError
    }
  }

  const signOut = async () => {
    if (!supabase) return

    setError(null)
    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      setError(signOutError.message)
      throw signOutError
    }
  }

  return {
    user,
    isLoading,
    error,
    sendMagicLink,
    signOut,
  }
}
