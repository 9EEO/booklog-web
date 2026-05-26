import { useState } from 'react'
import { Icon } from '../components/Icon'
import { PixelCard } from '../components/PixelCard'
import { hasSupabaseConfig } from '../services/supabase'

type AuthScreenProps = {
  error: string | null
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string) => Promise<void>
  onResetPassword: (email: string) => Promise<void>
}

type AuthMode = 'signIn' | 'signUp'
type SubmitStatus = 'idle' | 'submitting' | 'notice'

export const AuthScreen = ({ error, onSignIn, onSignUp, onResetPassword }: AuthScreenProps) => {
  const [mode, setMode] = useState<AuthMode>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [message, setMessage] = useState('')

  const trimmedEmail = email.trim()
  const canSubmit = hasSupabaseConfig && trimmedEmail.length > 0 && password.length >= 6 && status !== 'submitting'

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return

    setStatus('submitting')
    setMessage('')

    try {
      if (mode === 'signIn') {
        await onSignIn(trimmedEmail, password)
      } else {
        await onSignUp(trimmedEmail, password)
        setStatus('notice')
        setMessage('가입 확인 메일을 확인해 주세요. 확인 후 같은 비밀번호로 로그인할 수 있습니다.')
      }
    } catch {
      setStatus('idle')
    }
  }

  const resetPassword = async () => {
    if (!hasSupabaseConfig || trimmedEmail.length === 0 || status === 'submitting') return

    setStatus('submitting')
    setMessage('')

    try {
      await onResetPassword(trimmedEmail)
      setStatus('notice')
      setMessage('비밀번호 재설정 메일을 보냈습니다.')
    } catch {
      setStatus('idle')
    }
  }

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setStatus('idle')
    setMessage('')
  }

  return (
    <main className="min-h-svh bg-[#F8F8F5] text-stone-900">
      <div className="mx-auto flex min-h-svh max-w-[430px] flex-col justify-center bg-[#FCFBF7] px-4 py-8 shadow-[0_18px_60px_rgba(47,42,38,0.12)]">
        <div className="space-y-4">
          <header>
            <p className="pixel-label">BOOKLOG TIMER</p>
            <h1 className="mt-2 text-3xl font-black leading-tight text-stone-950">독서 기록을 이어가요</h1>
          </header>

          <PixelCard className="bg-[#F3E8D0]">
            <div className="mb-4 grid h-14 w-14 place-items-center border-2 border-[#2F2A26] bg-[#87937A] text-[#FFFDF8] shadow-pixel">
              <Icon name="profile" className="h-8 w-8" />
            </div>
            <p className="text-sm font-bold leading-relaxed text-stone-700">
              이메일과 비밀번호로 로그인하면 설치한 앱 안에서 바로 독서 기록을 이어갈 수 있습니다.
            </p>
          </PixelCard>

          <div className="grid grid-cols-2 border-2 border-[#2F2A26] bg-[#FCFBF7] text-sm font-black">
            <button
              type="button"
              className={`px-3 py-2 ${mode === 'signIn' ? 'bg-[#87937A] text-[#FFFDF8]' : 'text-stone-700'}`}
              onClick={() => switchMode('signIn')}
            >
              로그인
            </button>
            <button
              type="button"
              className={`border-l-2 border-[#2F2A26] px-3 py-2 ${mode === 'signUp' ? 'bg-[#87937A] text-[#FFFDF8]' : 'text-stone-700'}`}
              onClick={() => switchMode('signUp')}
            >
              회원가입
            </button>
          </div>

          <form className="space-y-3" onSubmit={submit}>
            <label className="field-label" htmlFor="auth-email">
              이메일
            </label>
            <input
              id="auth-email"
              className="pixel-input"
              type="email"
              autoComplete="email"
              placeholder="reader@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <label className="field-label" htmlFor="auth-password">
              비밀번호
            </label>
            <input
              id="auth-password"
              className="pixel-input"
              type="password"
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              placeholder="6자 이상"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            <button type="submit" className="primary-button w-full" disabled={!canSubmit}>
              <Icon name="save" className="h-5 w-5" />
              {status === 'submitting' ? '처리 중' : mode === 'signIn' ? '로그인' : '회원가입'}
            </button>
          </form>

          {mode === 'signIn' && (
            <button type="button" className="secondary-button w-full text-xs" onClick={resetPassword} disabled={!hasSupabaseConfig || trimmedEmail.length === 0 || status === 'submitting'}>
              비밀번호 재설정 메일 받기
            </button>
          )}

          {message && (
            <PixelCard className="bg-[#DCE3D2]">
              <p className="text-sm font-black leading-relaxed">{message}</p>
            </PixelCard>
          )}

          {!hasSupabaseConfig && (
            <PixelCard className="bg-[#F3E8D0]">
              <p className="text-sm font-black leading-relaxed text-[#B58A7A]">Supabase 환경변수가 설정되지 않았습니다.</p>
            </PixelCard>
          )}

          {error && (
            <PixelCard className="bg-[#F3E8D0]">
              <p className="text-sm font-black leading-relaxed text-[#B58A7A]">{error}</p>
            </PixelCard>
          )}
        </div>
      </div>
    </main>
  )
}
