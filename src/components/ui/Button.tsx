import React from "react";

type Variant = "primary" | "secondary" | "quiet" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantMap: Record<Variant, string> = {
  primary: "bg-paper text-ground hover:opacity-90",
  secondary: "border border-edge-strong text-paper hover:bg-table",
  quiet: "text-dim hover:text-paper hover:bg-table",
  danger: "border border-stop/50 text-stop hover:bg-stop/10",
};

const sizeMap: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
};

export default function Button({
  variant = "secondary",
  size = "sm",
  loading = false,
  icon,
  children,
  className = "",
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-sm font-medium whitespace-nowrap select-none transition-colors disabled:opacity-45 ${variantMap[variant]} ${sizeMap[size]} ${className}`}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon ? (
        <span className="shrink-0 flex">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
