import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'
import App from './App.tsx'
import { initializeDoubleBackExitGuard } from './hooks/useDoubleBackExitGuard'
import { ensureServiceWorkerIsHealthy, registerServiceWorker } from './utils/serviceWorkerRecovery'

initializeDoubleBackExitGuard()

void ensureServiceWorkerIsHealthy()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

registerServiceWorker()
