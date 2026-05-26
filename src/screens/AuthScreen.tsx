import { useState } from 'react'
import { Icon } from '../components/Icon'
import { PixelCard } from '../components/PixelCard'
import { hasSupabaseConfig } from '../services/supabase'

type AuthScreenProps = {
  error: string | null
  onSendMagicLink: (email: string) => Promise<void>
}

export const AuthScreen = ({ error, onSendMagicLink }: AuthScreenProps) => {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email.trim() || status === 'sending') return

    setStatus('sending')

    try {
      await onSendMagicLink(email.trim())
      setStatus('sent')
    } catch {
      setStatus('idle')
    }
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
              이메일로 받은 링크를 열면 이 기기의 독서 기록을 계정과 연결할 수 있습니다.
            </p>
          </PixelCard>

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
            <button type="submit" className="primary-button w-full" disabled={!hasSupabaseConfig || status === 'sending' || email.trim().length === 0}>
              <Icon name="save" className="h-5 w-5" />
              {status === 'sending' ? '보내는 중' : '로그인 링크 받기'}
            </button>
          </form>

          {status === 'sent' && (
            <PixelCard className="bg-[#DCE3D2]">
              <p className="text-sm font-black leading-relaxed">메일함에서 로그인 링크를 확인해 주세요.</p>
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
