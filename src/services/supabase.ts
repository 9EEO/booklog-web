import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)

const createSupabaseClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) return null

  return createClient(supabaseUrl, supabaseAnonKey)
}

export const supabase = createSupabaseClient()

export const requireSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase 환경변수가 설정되지 않았습니다.')
  }

  return supabase
}
