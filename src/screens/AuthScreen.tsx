import { useState } from 'react'
import focusSproutStill from '../assets/focus-sprout-still.png'
import { Icon } from '../components/Icon'
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
    <main className="auth-screen">
      <div className="auth-shell">
        <section className="auth-panel">
          <header className="auth-header">
            <div className="auth-brand">
              <Icon name="book" className="h-4 w-4" />
              <span>BOOKLOG</span>
            </div>
            <div className="auth-focus-display" aria-hidden="true">
              <img src={focusSproutStill} alt="" />
              <span>READY TO READ</span>
            </div>
            <h1>{mode === 'signIn' ? '다시, 읽던 곳부터' : '나만의 독서 기록 시작하기'}</h1>
            <p>{mode === 'signIn' ? '로그인하고 오늘의 독서를 이어가세요.' : '계정을 만들고 독서 시간을 차곡차곡 쌓아보세요.'}</p>
          </header>

          <div className={`auth-mode-switch ${mode === 'signUp' ? 'auth-mode-switch-sign-up' : ''}`} role="tablist" aria-label="계정 인증 방식">
            <button
              type="button"
              className={mode === 'signIn' ? 'auth-mode-option auth-mode-option-active' : 'auth-mode-option'}
              onClick={() => switchMode('signIn')}
              role="tab"
              aria-selected={mode === 'signIn'}
            >
              로그인
            </button>
            <button
              type="button"
              className={mode === 'signUp' ? 'auth-mode-option auth-mode-option-active' : 'auth-mode-option'}
              onClick={() => switchMode('signUp')}
              role="tab"
              aria-selected={mode === 'signUp'}
            >
              회원가입
            </button>
          </div>

          <form className="auth-form" onSubmit={submit}>
            <div className="auth-field">
              <label htmlFor="auth-email">이메일</label>
              <div className="auth-input-wrap">
                <Icon name="profile" className="h-4 w-4" />
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  placeholder="reader@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="auth-password">비밀번호</label>
              <div className="auth-input-wrap">
                <Icon name="save" className="h-4 w-4" />
                <input
                  id="auth-password"
                  type="password"
                  autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                  placeholder="6자 이상"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="auth-submit" disabled={!canSubmit}>
              <Icon name={mode === 'signIn' ? 'play' : 'plus'} className="h-5 w-5" />
              {status === 'submitting' ? '처리 중' : mode === 'signIn' ? '로그인' : '회원가입'}
            </button>
          </form>

          {mode === 'signIn' && (
            <button type="button" className="auth-reset" onClick={resetPassword} disabled={!hasSupabaseConfig || trimmedEmail.length === 0 || status === 'submitting'}>
              비밀번호를 잊으셨나요?
            </button>
          )}

          {message && (
            <p className="auth-notice auth-notice-success" aria-live="polite">
              <Icon name="check" className="h-4 w-4" />
              {message}
            </p>
          )}

          {!hasSupabaseConfig && (
            <p className="auth-notice">Supabase 환경변수가 설정되지 않았습니다.</p>
          )}

          {error && (
            <p className="auth-notice auth-notice-error" role="alert">{error}</p>
          )}
        </section>
      </div>
    </main>
  )
}
