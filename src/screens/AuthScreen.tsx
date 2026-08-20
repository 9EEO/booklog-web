import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { hasSupabaseConfig } from '../services/supabase'

type AuthScreenProps = {
  error: string | null
  onSignIn: (email: string, password: string) => Promise<void>
  onSignInWithGoogle: () => Promise<void>
  onSignUp: (email: string, password: string) => Promise<void>
  onResetPassword: (email: string) => Promise<void>
}

type AuthMode = 'signIn' | 'signUp'
type SubmitStatus = 'idle' | 'submitting' | 'notice'

export const AuthScreen = ({
  error,
  onSignIn,
  onSignInWithGoogle,
  onSignUp,
  onResetPassword,
}: AuthScreenProps) => {
  const [mode, setMode] = useState<AuthMode>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [message, setMessage] = useState('')

  const trimmedEmail = email.trim()
  const hasPasswordMismatch =
    mode === 'signUp' &&
    passwordConfirm.length > 0 &&
    password !== passwordConfirm
  const canSubmit =
    hasSupabaseConfig &&
    trimmedEmail.length > 0 &&
    password.length >= 6 &&
    (mode === 'signIn' ||
      (passwordConfirm.length >= 6 && password === passwordConfirm)) &&
    status !== 'submitting'
  const canUseGoogleSignIn = hasSupabaseConfig && status !== 'submitting'

  useEffect(() => {
    document.body.classList.add('auth-page-body')

    return () => {
      document.body.classList.remove('auth-page-body')
    }
  }, [])

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
        setMessage(
          '가입 확인 메일을 확인해 주세요. 확인 후 같은 비밀번호로 로그인할 수 있습니다.',
        )
      }
    } catch {
      setStatus('idle')
    }
  }

  const resetPassword = async () => {
    if (
      !hasSupabaseConfig ||
      trimmedEmail.length === 0 ||
      status === 'submitting'
    ) {
      return
    }

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

  const signInWithGoogle = async () => {
    if (!canUseGoogleSignIn) return

    setStatus('submitting')
    setMessage('')

    try {
      await onSignInWithGoogle()
    } catch {
      setStatus('idle')
    }
  }

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setPasswordConfirm('')
    setStatus('idle')
    setMessage('')
  }

  return (
    <main className="auth-screen">
      <div className="auth-shell">
        <section className="auth-panel">
          <header className="auth-header">
            {/* <div className="auth-brand">
              <Icon name="book" className="h-4 w-4" />
              <span>BOOKLOG</span>
            </div> */}
            <h1>
              {mode === 'signIn' ? 'Login' : 'Sign Up'}
            </h1>
            <div className="auth-mode-prompt">
              <span>
                {mode === 'signIn'
                  ? 'Don\'t have an account?'
                  : 'Already have an account?'}
              </span>
              <button
                type="button"
                onClick={() =>
                  switchMode(mode === 'signIn' ? 'signUp' : 'signIn')
                }
              >
                {mode === 'signIn' ? 'Sign Up' : 'Login'}
              </button>
            </div>
          </header>

          <button
            type="button"
            className="auth-google"
            onClick={signInWithGoogle}
            disabled={!canUseGoogleSignIn}
          >
            <span className="auth-google-icon" aria-hidden="true">
              G
            </span>
            Continue with Google
          </button>

          <div className="auth-divider" aria-hidden="true">
            <span />
            <b>or</b>
            <span />
          </div>

          <form className="auth-form" onSubmit={submit}>
            <div className="auth-field">
              <label htmlFor="auth-email">이메일</label>
              <div className="auth-input-wrap">
                <Icon name="mail" className="h-5 w-5" />
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  placeholder="Email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="auth-password">Password</label>
              <div className="auth-input-wrap">
                <Icon name="lock" className="h-5 w-5" />
                <input
                  id="auth-password"
                  type="password"
                  autoComplete={
                    mode === 'signIn' ? 'current-password' : 'new-password'
                  }
                  placeholder="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            </div>

            {mode === 'signUp' && (
              <div className="auth-field">
                <label htmlFor="auth-password-confirm">Confirm Password</label>
                <div className="auth-input-wrap">
                  <Icon name="lock" className="h-5 w-5" />
                  <input
                    id="auth-password-confirm"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Confirm Password"
                    value={passwordConfirm}
                    onChange={(event) => setPasswordConfirm(event.target.value)}
                  />
                </div>
                {hasPasswordMismatch && (
                  <p className="auth-field-hint">비밀번호가 일치하지 않습니다.</p>
                )}
              </div>
            )}

            <button type="submit" className="auth-submit" disabled={!canSubmit}>
              <Icon
                name={mode === 'signIn' ? 'play' : 'plus'}
                className="h-5 w-5"
              />
              {status === 'submitting'
                ? 'Processing'
                : mode === 'signIn'
                  ? 'Login'
                  : 'Sign Up'}
            </button>
          </form>

          {mode === 'signIn' && (
            <button
              type="button"
              className="auth-reset"
              onClick={resetPassword}
              disabled={
                !hasSupabaseConfig ||
                trimmedEmail.length === 0 ||
                status === 'submitting'
              }
            >
              Forgot your password?
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
            <p className="auth-notice auth-notice-error" role="alert">
              {error}
            </p>
          )}
        </section>
      </div>
    </main>
  )
}
