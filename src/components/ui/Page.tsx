import React from "react";

/** Sayfa başlığı: solda başlık ve tek satırlık durum, sağda sayfanın ana eylemi. */
export function PageHeader({
  title,
  status,
  children,
}: {
  title: string;
  status?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-6 pb-5 border-b border-edge">
      <div className="min-w-0">
        <h1 className="display text-[30px] m-0">{title}</h1>
        {status && <p className="text-dim mt-1.5 mb-0">{status}</p>}
      </div>
      {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
    </div>
  );
}

/** Boş ekran veya hata: ne olduğunu ve şimdi ne yapılacağını söyler. */
export function Notice({
  title,
  tone = "plain",
  children,
  action,
}: {
  title: string;
  tone?: "plain" | "stop";
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      role={tone === "stop" ? "alert" : undefined}
      className={`border-l-2 pl-4 py-1 max-w-[62ch] ${tone === "stop" ? "border-stop" : "border-edge-strong"}`}
    >
      <p className={`font-medium m-0 ${tone === "stop" ? "text-stop" : "text-paper"}`}>{title}</p>
      {children && <div className="text-dim mt-1 text-[13px]">{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Birbirini dışlayan birkaç seçenek. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-sm border border-edge-strong p-0.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`h-7 px-3 rounded-[2px] text-[13px] transition-colors ${
              active ? "bg-paper text-ground font-medium" : "text-dim hover:text-paper"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors ${checked ? "bg-paper" : "bg-edge"}`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full transition-[left] ${
          checked ? "left-[18px] bg-ground" : "left-0.5 bg-dim"
        }`}
      />
    </button>
  );
}

/** Klasör yolu: son parça öne çıkar, öncekiler geri planda kalır. */
export function PathText({ path, className = "" }: { path: string; className?: string }) {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return <span className={`font-mono text-dim ${className}`}>—</span>;
  const last = parts[parts.length - 1];
  const lead = parts.slice(0, -1);
  return (
    <span className={`font-mono ${className}`}>
      {lead.length > 0 && <span className="text-dim">{lead.join(" / ")} / </span>}
      <span className="text-paper font-medium">{last}</span>
    </span>
  );
}

export const inputClass =
  "bg-well border border-edge rounded-sm px-2.5 h-8 text-[13px] text-paper placeholder:text-faint outline-none focus:border-paper";
