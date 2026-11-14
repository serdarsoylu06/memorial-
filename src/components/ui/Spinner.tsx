export default function Spinner({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Yükleniyor"
      className={`inline-block rounded-full border-2 border-edge border-t-paper animate-spin ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
