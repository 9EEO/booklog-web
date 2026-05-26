import { Component, type ErrorInfo, type ReactNode } from 'react'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App render error', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <main className="grid min-h-svh place-items-center bg-[#F8F8F5] px-4 text-stone-900">
        <div className="w-full max-w-[430px] border-2 border-[#2F2A26] bg-[#FCFBF7] p-5 text-center shadow-pixel">
          <p className="text-sm font-black">화면을 불러오지 못했습니다</p>
          <p className="mt-2 text-xs text-stone-600">새로고침하거나 홈 화면 앱을 삭제 후 다시 열어주세요.</p>
          <button type="button" className="primary-button mt-4 w-full" onClick={() => window.location.reload()}>
            새로고침
          </button>
        </div>
      </main>
    )
  }
}
