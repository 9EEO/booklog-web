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
  const initialMode =
    new URLSearchParams(window.location.search).get('mode') === 'signUp'
      ? 'signUp'
      : 'signIn'
  const [mode, setMode] = useState<AuthMode>(initialMode)
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
        setMessage('메일에서 가입을 확인해 주세요. 확인 후 같은 비밀번호로 로그인할 수 있어요.')
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
      setMessage('비밀번호를 다시 설정할 수 있는 메일을 보냈어요.')
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
          <a href="/" className="auth-back-link">
            <Icon name="chevronLeft" className="h-4 w-4" />
            처음으로
          </a>
          <header className="auth-header">
            <div className="auth-brand">
              <Icon name="book" className="h-4 w-4" />
              <span>BOOKLOG</span>
            </div>
            <div className="auth-focus-display" aria-hidden="true">
              <img src={focusSproutStill} alt="" />
              <span>READY TO READ</span>
            </div>
            <h1>{mode === 'signIn' ? '읽던 곳부터 이어가요' : '내 독서 기록을 시작해요'}</h1>
            <p>{mode === 'signIn' ? '로그인하면 저장해둔 책과 기록을 바로 불러와요.' : '계정을 만들면 책, 문장, 단어 기록을 안전하게 보관할 수 있어요.'}</p>
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
                  placeholder="이메일을 입력해 주세요"
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
                  placeholder="비밀번호 6자 이상"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="auth-submit" disabled={!canSubmit}>
              <Icon name={mode === 'signIn' ? 'play' : 'plus'} className="h-5 w-5" />
              {status === 'submitting' ? '잠시만 기다려 주세요' : mode === 'signIn' ? '로그인하고 시작하기' : '계정 만들기'}
            </button>
          </form>

          {mode === 'signIn' && (
            <button type="button" className="auth-reset" onClick={resetPassword} disabled={!hasSupabaseConfig || trimmedEmail.length === 0 || status === 'submitting'}>
              비밀번호 다시 설정하기
            </button>
          )}

          {message && (
            <p className="auth-notice auth-notice-success" aria-live="polite">
              <Icon name="check" className="h-4 w-4" />
              {message}
            </p>
          )}

          {!hasSupabaseConfig && (
            <p className="auth-notice">로그인 준비가 아직 끝나지 않았어요. 설정을 확인해 주세요.</p>
          )}

          {error && (
            <p className="auth-notice auth-notice-error" role="alert">{error}</p>
          )}
        </section>
      </div>
    </main>
  )
}
