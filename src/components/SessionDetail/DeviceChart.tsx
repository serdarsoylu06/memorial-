import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { MediaFile } from "../../types";

interface DeviceChartProps {
  files: MediaFile[];
}

const COLORS = ["#6c8cff", "#4caf82", "#f0a830", "#e05252", "#a78bfa", "#38bdf8"];

export default function DeviceChart({ files }: DeviceChartProps) {
  const counts: Record<string, number> = {};
  for (const f of files) {
    const d = f.device === "Unknown" ? "Unknown" : f.device;
    counts[d] = (counts[d] ?? 0) + 1;
  }
  const data = Object.entries(counts).map(([name, value]) => ({ name, value }));

  return (
    <div>
      <p className="text-xs text-[#8b92a9] mb-3 uppercase tracking-wider">Cihaz Dağılımı</p>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: "#1a1d27", border: "1px solid #2e3347", borderRadius: "8px" }}
            labelStyle={{ color: "#e8eaf0" }}
            itemStyle={{ color: "#8b92a9" }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-2 mt-2">
        {data.map((entry, i) => (
          <span key={entry.name} className="flex items-center gap-1 text-xs text-[#8b92a9]">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            {entry.name} ({entry.value})
          </span>
        ))}
      </div>
    </div>
  );
}
