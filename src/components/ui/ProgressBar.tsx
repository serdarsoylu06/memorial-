interface ProgressBarProps {
  value: number; // 0–100
  className?: string;
  color?: string;
}

export default function ProgressBar({ value, className = "", color = "#6c8cff" }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={`w-full h-1.5 bg-[#1a1d2e] rounded-full overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}
