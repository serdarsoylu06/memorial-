import React from "react";

type Variant = "primary" | "ghost" | "danger" | "outline" | "success";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantMap: Record<Variant, string> = {
  primary:
    "bg-[#6c8cff] hover:bg-[#5578ff] text-white shadow-[0_0_16px_rgba(108,140,255,0.25)] active:scale-95",
  ghost:
    "bg-transparent hover:bg-[#1a1d2e] text-[#8890b4] hover:text-[#e8eaf6] active:scale-95",
  danger:
    "bg-[rgba(224,82,82,0.12)] hover:bg-[rgba(224,82,82,0.22)] text-[#e05252] border border-[rgba(224,82,82,0.25)] active:scale-95",
  outline:
    "bg-transparent border border-[#252840] hover:border-[#6c8cff] text-[#8890b4] hover:text-[#6c8cff] active:scale-95",
  success:
    "bg-[rgba(61,214,140,0.12)] hover:bg-[rgba(61,214,140,0.22)] text-[#3dd68c] border border-[rgba(61,214,140,0.25)] active:scale-95",
};

const sizeMap: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-5 py-2.5 text-sm gap-2",
};

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  children,
  className = "",
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center rounded-lg font-medium
        transition-all duration-150 cursor-pointer select-none
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantMap[variant]} ${sizeMap[size]} ${className}
      `}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
