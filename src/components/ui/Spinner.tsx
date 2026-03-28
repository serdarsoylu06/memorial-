export default function Spinner({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-block rounded-full border-2 border-[#252840] border-t-[#6c8cff] animate-spin ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
