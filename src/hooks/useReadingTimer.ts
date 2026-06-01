import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getStoredReadingTimer, saveReadingTimer, type StoredReadingTimer } from '../storage/readingStorage'

export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed'

export type ReadingTimer = {
  elapsedSeconds: number
  targetSeconds: number
  remainingSeconds: number
  progress: number
  status: TimerStatus
  sessionStartedAt?: number
  setPreset: (seconds: number) => void
  adjustTarget: (deltaSeconds: number) => void
  start: () => void
  pause: () => void
  resume: () => void
  extendAndResume: (additionalSeconds: number) => void
  reset: () => void
  complete: () => void
  cancelCompletion: () => void
}

const getInitialTimer = (initialTargetSeconds: number): StoredReadingTimer => {
  const storedTimer = getStoredReadingTimer(initialTargetSeconds)
  const targetSeconds = Math.max(Math.floor(storedTimer.targetSeconds) || initialTargetSeconds, 1)
  const baseElapsedSeconds = Math.max(Math.floor(storedTimer.baseElapsedSeconds ?? storedTimer.elapsedSeconds) || 0, 0)

  if (storedTimer.status === 'running' && storedTimer.startedAt) {
    const elapsedSinceStart = Math.max(Math.floor((Date.now() - storedTimer.startedAt) / 1000), 0)
    const elapsedSeconds = Math.min(baseElapsedSeconds + elapsedSinceStart, targetSeconds)

    return {
      elapsedSeconds,
      targetSeconds,
      status: elapsedSeconds >= targetSeconds ? 'completed' : 'running',
      startedAt: Date.now(),
      sessionStartedAt: storedTimer.sessionStartedAt ?? storedTimer.startedAt ?? Date.now(),
      baseElapsedSeconds: elapsedSeconds,
    }
  }

  return {
    elapsedSeconds: Math.min(Math.max(Math.floor(storedTimer.elapsedSeconds) || 0, 0), targetSeconds),
    targetSeconds,
    status: storedTimer.status ?? 'idle',
    sessionStartedAt: storedTimer.sessionStartedAt,
  }
}

export const useReadingTimer = (initialTargetSeconds = 15 * 60): ReadingTimer => {
  const [initialTimer] = useState(() => getInitialTimer(initialTargetSeconds))
  const [elapsedSeconds, setElapsedSeconds] = useState(initialTimer.elapsedSeconds)
  const [targetSeconds, setTargetSeconds] = useState(initialTimer.targetSeconds)
  const [status, setStatus] = useState<TimerStatus>(initialTimer.status)
  const [sessionStartedAt, setSessionStartedAt] = useState<number | undefined>(initialTimer.sessionStartedAt)
  const intervalRef = useRef<number | null>(null)
  const startedAtRef = useRef<number | undefined>(initialTimer.status === 'running' ? initialTimer.startedAt : undefined)
  const sessionStartedAtRef = useRef<number | undefined>(initialTimer.sessionStartedAt)
  const baseElapsedRef = useRef(initialTimer.status === 'running' ? initialTimer.baseElapsedSeconds ?? initialTimer.elapsedSeconds : initialTimer.elapsedSeconds)

  const setSessionStartedAtValue = useCallback((value: number | undefined) => {
    sessionStartedAtRef.current = value
    setSessionStartedAt(value)
  }, [])

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    if (status !== 'running') {
      clearTimer()
      return
    }

    if (startedAtRef.current === undefined) {
      startedAtRef.current = Date.now()
      baseElapsedRef.current = elapsedSeconds
    }

    intervalRef.current = window.setInterval(() => {
      const elapsedSinceStart = Math.max(Math.floor((Date.now() - (startedAtRef.current ?? Date.now())) / 1000), 0)
      const next = Math.min(baseElapsedRef.current + elapsedSinceStart, targetSeconds)

      setElapsedSeconds(next)

      if (next >= targetSeconds) {
        startedAtRef.current = undefined
        baseElapsedRef.current = targetSeconds
        setStatus('completed')
      }
    }, 1000)

    return clearTimer
  }, [clearTimer, elapsedSeconds, status, targetSeconds])

  useEffect(() => {
    if (status === 'running') {
      saveReadingTimer({
        elapsedSeconds,
        targetSeconds,
        status,
        startedAt: startedAtRef.current,
        sessionStartedAt,
        baseElapsedSeconds: baseElapsedRef.current,
      })
      return
    }

    saveReadingTimer({
      elapsedSeconds,
      targetSeconds,
      status,
      sessionStartedAt,
    })
  }, [elapsedSeconds, sessionStartedAt, status, targetSeconds])

  const remainingSeconds = useMemo(
    () => Math.max(targetSeconds - elapsedSeconds, 0),
    [elapsedSeconds, targetSeconds],
  )

  const progress = useMemo(() => {
    if (targetSeconds === 0) return 0
    return Math.min((elapsedSeconds / targetSeconds) * 100, 100)
  }, [elapsedSeconds, targetSeconds])

  const setPreset = useCallback((seconds: number) => {
    startedAtRef.current = undefined
    setTargetSeconds(() => {
      if (status === 'paused') {
        const nextTarget = Math.min(Math.max(seconds, elapsedSeconds, 5 * 60), 120 * 60)

        baseElapsedRef.current = elapsedSeconds
        return nextTarget
      }

      baseElapsedRef.current = 0
      setSessionStartedAtValue(undefined)
      setElapsedSeconds(0)
      setStatus('idle')
      return seconds
    })
  }, [elapsedSeconds, setSessionStartedAtValue, status])

  const adjustTarget = useCallback((deltaSeconds: number) => {
    startedAtRef.current = undefined
    setTargetSeconds((currentTarget) => {
      const minimumTarget = status === 'paused' ? Math.min(Math.max(elapsedSeconds, 5 * 60), 120 * 60) : 5 * 60
      const nextTarget = Math.min(Math.max(currentTarget + deltaSeconds, minimumTarget), 120 * 60)

      if (status !== 'paused') {
        baseElapsedRef.current = 0
        setSessionStartedAtValue(undefined)
        setElapsedSeconds(0)
        setStatus('idle')
        return nextTarget
      }

      baseElapsedRef.current = elapsedSeconds
      return nextTarget
    })
  }, [elapsedSeconds, setSessionStartedAtValue, status])

  const start = useCallback(() => {
    setStatus((current) => {
      if (current === 'completed') {
        const now = Date.now()
        startedAtRef.current = now
        setSessionStartedAtValue(now)
        baseElapsedRef.current = 0
        setElapsedSeconds(0)
        return 'running'
      }

      if (current !== 'running') {
        const now = Date.now()
        startedAtRef.current = now
        setSessionStartedAtValue(sessionStartedAtRef.current ?? now)
        baseElapsedRef.current = elapsedSeconds
      }

      return 'running'
    })
  }, [elapsedSeconds, setSessionStartedAtValue])

  const pause = useCallback(() => {
    setStatus((current) => {
      if (current !== 'running') return current

      const elapsedSinceStart = Math.max(Math.floor((Date.now() - (startedAtRef.current ?? Date.now())) / 1000), 0)
      const nextElapsedSeconds = Math.min(baseElapsedRef.current + elapsedSinceStart, targetSeconds)

      startedAtRef.current = undefined
      baseElapsedRef.current = nextElapsedSeconds
      setElapsedSeconds(nextElapsedSeconds)

      return 'paused'
    })
  }, [targetSeconds])

  const resume = useCallback(() => {
    setTargetSeconds((currentTarget) => (elapsedSeconds >= currentTarget ? elapsedSeconds + currentTarget : currentTarget))
    const now = Date.now()
    startedAtRef.current = now
    setSessionStartedAtValue(sessionStartedAtRef.current ?? now)
    baseElapsedRef.current = elapsedSeconds
    setStatus('running')
  }, [elapsedSeconds, setSessionStartedAtValue])

  const extendAndResume = useCallback((additionalSeconds: number) => {
    const normalizedAdditionalSeconds = Math.max(Math.floor(additionalSeconds) || 0, 1)

    setTargetSeconds(() => elapsedSeconds + normalizedAdditionalSeconds)
    const now = Date.now()
    startedAtRef.current = now
    setSessionStartedAtValue(sessionStartedAtRef.current ?? now)
    baseElapsedRef.current = elapsedSeconds
    setStatus('running')
  }, [elapsedSeconds, setSessionStartedAtValue])

  const reset = useCallback(() => {
    clearTimer()
    startedAtRef.current = undefined
    setSessionStartedAtValue(undefined)
    baseElapsedRef.current = 0
    setElapsedSeconds(0)
    setStatus('idle')
  }, [clearTimer, setSessionStartedAtValue])

  const complete = useCallback(() => {
    clearTimer()
    startedAtRef.current = undefined
    baseElapsedRef.current = elapsedSeconds
    setStatus('completed')
  }, [clearTimer, elapsedSeconds])

  const cancelCompletion = useCallback(() => {
    setStatus((current) => {
      if (current !== 'completed') return current

      startedAtRef.current = undefined
      baseElapsedRef.current = elapsedSeconds
      return 'paused'
    })
  }, [elapsedSeconds])

  return {
    elapsedSeconds,
    targetSeconds,
    remainingSeconds,
    progress,
    status,
    sessionStartedAt,
    setPreset,
    adjustTarget,
    start,
    pause,
    resume,
    extendAndResume,
    reset,
    complete,
    cancelCompletion,
  }
}
