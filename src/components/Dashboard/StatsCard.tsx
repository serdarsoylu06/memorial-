interface StatsCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}

export default function StatsCard({ label, value, sub, color = "#6c8cff" }: StatsCardProps) {
  return (
    <div className="bg-[#1a1d27] border border-[#2e3347] rounded-xl p-5">
      <p className="text-xs text-[#8b92a9] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>
        {value}
      </p>
      {sub && <p className="text-xs text-[#8b92a9] mt-1">{sub}</p>}
    </div>
  );
}
