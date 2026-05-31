import { useCallback, useEffect, useRef } from 'react'
import type { TimerStatus } from './useReadingTimer'

const notes = [
  { frequency: 659.25, start: 0, duration: 0.16 },
  { frequency: 783.99, start: 0.14, duration: 0.18 },
  { frequency: 987.77, start: 0.32, duration: 0.32 },
]

export const useTimerCompletionSound = (status: TimerStatus) => {
  const audioContextRef = useRef<AudioContext | null>(null)
  const previousStatusRef = useRef(status)
  const suppressNextCompletionRef = useRef(false)

  const prepare = useCallback(() => {
    if (typeof window === 'undefined') return

    const AudioContextConstructor =
      window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextConstructor) return

    audioContextRef.current ??= new AudioContextConstructor()
    void audioContextRef.current.resume()
  }, [])

  const suppressNextCompletionSound = useCallback(() => {
    suppressNextCompletionRef.current = true
  }, [])

  const play = useCallback(() => {
    const context = audioContextRef.current
    if (!context) return

    const masterGain = context.createGain()
    masterGain.gain.setValueAtTime(0.0001, context.currentTime)
    masterGain.gain.exponentialRampToValueAtTime(0.28, context.currentTime + 0.02)
    masterGain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.86)
    masterGain.connect(context.destination)

    notes.forEach(({ frequency, start, duration }) => {
      const oscillator = context.createOscillator()
      const noteGain = context.createGain()
      const startTime = context.currentTime + start
      const endTime = startTime + duration

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, startTime)
      noteGain.gain.setValueAtTime(0.0001, startTime)
      noteGain.gain.exponentialRampToValueAtTime(1, startTime + 0.02)
      noteGain.gain.exponentialRampToValueAtTime(0.0001, endTime)

      oscillator.connect(noteGain)
      noteGain.connect(masterGain)
      oscillator.start(startTime)
      oscillator.stop(endTime + 0.02)
    })
  }, [])

  useEffect(() => {
    const previousStatus = previousStatusRef.current

    if (previousStatus === 'running' && status === 'completed') {
      if (suppressNextCompletionRef.current) {
        suppressNextCompletionRef.current = false
      } else {
        play()
      }
    }

    if (status !== 'completed') {
      suppressNextCompletionRef.current = false
    }

    previousStatusRef.current = status
  }, [play, status])

  return {
    prepare,
    suppressNextCompletionSound,
  }
}
