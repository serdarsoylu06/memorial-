type Tone = "accent" | "success" | "warning" | "danger" | "muted" | "none";

interface BadgeProps {
  tone?: Tone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}

const toneMap: Record<Tone, string> = {
  accent:  "bg-[rgba(108,140,255,0.15)] text-[#6c8cff] border border-[rgba(108,140,255,0.25)]",
  success: "bg-[rgba(61,214,140,0.12)]  text-[#3dd68c] border border-[rgba(61,214,140,0.22)]",
  warning: "bg-[rgba(240,178,58,0.12)]  text-[#f0b23a] border border-[rgba(240,178,58,0.22)]",
  danger:  "bg-[rgba(224,82,82,0.12)]   text-[#e05252] border border-[rgba(224,82,82,0.22)]",
  muted:   "bg-[rgba(136,144,180,0.1)]  text-[#8890b4] border border-[rgba(136,144,180,0.2)]",
  none:    "bg-[rgba(136,144,180,0.08)] text-[#565e80] border border-[rgba(136,144,180,0.15)]",
};

const dotMap: Record<Tone, string> = {
  accent:  "bg-[#6c8cff]",
  success: "bg-[#3dd68c]",
  warning: "bg-[#f0b23a]",
  danger:  "bg-[#e05252]",
  muted:   "bg-[#8890b4]",
  none:    "bg-[#565e80]",
};

export function confidenceTone(confidence: string): Tone {
  switch (confidence.toLowerCase()) {
    case "high":   return "success";
    case "medium": return "warning";
    case "low":    return "danger";
    default:       return "none";
  }
}

export default function Badge({ tone = "muted", children, dot = false, className = "" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${toneMap[tone]} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotMap[tone]}`} />}
      {children}
    </span>
  );
}
