import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'

type AuthState = {
  user: User | null
  isLoading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
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

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      setError('Supabase 환경변수가 설정되지 않았습니다.')
      return
    }

    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      throw signInError
    }
  }

  const signUp = async (email: string, password: string) => {
    if (!supabase) {
      setError('Supabase 환경변수가 설정되지 않았습니다.')
      return
    }

    setError(null)
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      throw signUpError
    }
  }

  const resetPassword = async (email: string) => {
    if (!supabase) {
      setError('Supabase 환경변수가 설정되지 않았습니다.')
      return
    }

    setError(null)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })

    if (resetError) {
      setError(resetError.message)
      throw resetError
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
    signIn,
    signUp,
    resetPassword,
    signOut,
  }
}
