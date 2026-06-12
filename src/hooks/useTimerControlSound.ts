import { useCallback, useEffect, useRef } from "react";

type Tone = {
  frequency: number;
  start?: number;
  duration: number;
  volume?: number;
};

const soundPatterns = {
  select: [{ frequency: 880, duration: 0.045, volume: 0.09 }],
  start: [
    { frequency: 523.25, duration: 0.07, volume: 0.1 },
    { frequency: 783.99, start: 0.065, duration: 0.1, volume: 0.12 },
  ],
  pause: [
    { frequency: 659.25, duration: 0.065, volume: 0.09 },
    { frequency: 493.88, start: 0.06, duration: 0.08, volume: 0.09 },
  ],
  stop: [
    { frequency: 392, duration: 0.075, volume: 0.1 },
    { frequency: 261.63, start: 0.07, duration: 0.12, volume: 0.11 },
  ],
  eject: [
    { frequency: 293.66, duration: 0.055, volume: 0.08 },
    { frequency: 440, start: 0.05, duration: 0.065, volume: 0.09 },
    { frequency: 659.25, start: 0.105, duration: 0.075, volume: 0.08 },
  ],
  insert: [
    { frequency: 659.25, duration: 0.055, volume: 0.08 },
    { frequency: 440, start: 0.05, duration: 0.065, volume: 0.09 },
    { frequency: 220, start: 0.115, duration: 0.1, volume: 0.12 },
  ],
} satisfies Record<string, Tone[]>;

export const useTimerControlSound = () => {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null;

    const AudioContextConstructor =
      window.AudioContext ??
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;

    if (!AudioContextConstructor) return null;

    audioContextRef.current ??= new AudioContextConstructor();
    void audioContextRef.current.resume();

    return audioContextRef.current;
  }, []);

  const playPattern = useCallback(
    (tones: Tone[]) => {
      const context = getAudioContext();
      if (!context) return;

      const startAt = context.currentTime + 0.005;

      tones.forEach(({ frequency, start = 0, duration, volume = 0.1 }) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const toneStart = startAt + start;
        const toneEnd = toneStart + duration;

        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(frequency, toneStart);
        gain.gain.setValueAtTime(0.0001, toneStart);
        gain.gain.exponentialRampToValueAtTime(volume, toneStart + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, toneEnd);

        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(toneStart);
        oscillator.stop(toneEnd + 0.01);
      });
    },
    [getAudioContext],
  );

  useEffect(
    () => () => {
      const context = audioContextRef.current;
      audioContextRef.current = null;

      if (context && context.state !== "closed") {
        void context.close();
      }
    },
    [],
  );

  return {
    playSelect: () => playPattern(soundPatterns.select),
    playStart: () => playPattern(soundPatterns.start),
    playPause: () => playPattern(soundPatterns.pause),
    playStop: () => playPattern(soundPatterns.stop),
    playEject: () => playPattern(soundPatterns.eject),
    playInsert: () => playPattern(soundPatterns.insert),
  };
};
