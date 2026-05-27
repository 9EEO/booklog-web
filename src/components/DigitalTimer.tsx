import { formatDuration } from "../utils/formatDuration";

type DigitalTimerProps = {
  seconds: number;
  label?: string;
};

export const DigitalTimer = ({ seconds, label }: DigitalTimerProps) => (
  <div className="text-center">
    {label && (
      <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-stone-500">
        {label}
      </p>
    )}
    <div className="digital-timer">{formatDuration(seconds)}</div>
  </div>
);
