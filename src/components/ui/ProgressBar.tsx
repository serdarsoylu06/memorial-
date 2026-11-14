type Tone = "paper" | "done" | "stop";

interface ProgressBarProps {
  value: number; // 0–100
  tone?: Tone;
  className?: string;
  label?: string;
}

const toneMap: Record<Tone, string> = {
  paper: "bg-paper",
  done: "bg-done",
  stop: "bg-stop",
};

export default function ProgressBar({ value, tone = "paper", className = "", label }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`w-full h-1.5 bg-well rounded-full overflow-hidden ${className}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${toneMap[tone]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
