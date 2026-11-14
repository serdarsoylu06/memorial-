import { useLayoutEffect, useRef, useState } from "react";
import type { MediaFile } from "../../types";
import { useThumbnails } from "../../hooks/useThumbnails";

function extension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot + 1).toUpperCase() : "";
}

/**
 * Tek bir kare. Küçük resim varsa onu, yoksa dosya türünü gösterir;
 * boş kare, o dosya hakkında bilinen tek şeyi (RAW mı, JPEG mi, video mu) söyler.
 */
export function Frame({
  file,
  number,
  width,
  thumbnail,
  className = "",
}: {
  file: MediaFile;
  number: number;
  width?: number;
  /** Arka uçtan gelen küçük resim; yoksa dosyanın kendi `thumbnail` alanına bakılır. */
  thumbnail?: string | null;
  className?: string;
}) {
  const src = thumbnail ?? file.thumbnail;
  return (
    <figure className={`m-0 ${className}`} style={width ? { width } : undefined} title={file.filename}>
      <div className="relative aspect-[3/2] rounded-[2px] bg-well border border-edge overflow-hidden flex items-center justify-center">
        {src ? (
          <img src={src} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="condensed text-[11px] text-faint">{extension(file.filename)}</span>
        )}
        {file.kind === "video" && (
          <span
            aria-label="Video"
            className="absolute left-1 bottom-1 w-0 h-0 border-y-[4px] border-y-transparent border-l-[6px] border-l-paper/80"
          />
        )}
      </div>
      <figcaption className="condensed text-[11px] leading-4 text-faint mt-0.5">{number}</figcaption>
    </figure>
  );
}

const FRAME_WIDTH = 66;
const GAP = 6;
const MORE_WIDTH = 44;

/**
 * Oturumun ilk kareleri, yan yana. Sığdığı kadarını gösterir, kalanını sayıyla söyler.
 * `marked` ise şeridin etrafına mumlu kalem çerçevesi çizilir.
 */
export default function ContactStrip({
  files,
  marked = false,
  className = "",
}: {
  files: MediaFile[];
  marked?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(8);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth;
      setFit(Math.max(1, Math.floor((width - MORE_WIDTH + GAP) / (FRAME_WIDTH + GAP))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const shown = files.slice(0, fit);
  const rest = files.length - shown.length;
  const thumbs = useThumbnails(shown.map((f) => f.path));

  return (
    <div ref={ref} className={className}>
      <div className="relative inline-flex items-start" style={{ gap: GAP }}>
        {shown.map((file, i) => (
          <Frame
            key={file.path}
            file={file}
            number={i + 1}
            width={FRAME_WIDTH}
            thumbnail={thumbs[file.path]}
            className="shrink-0"
          />
        ))}
        {rest > 0 && (
          <span className="condensed text-[13px] text-dim self-start mt-3 pl-1">
            +{rest.toLocaleString("tr-TR")}
          </span>
        )}
        {marked && <GreaseMark />}
      </div>
    </div>
  );
}

/**
 * Kontakt baskıda seçilen karelerin etrafına çizilen mumlu kalem halkası.
 * Yol gerçek piksel ölçüsüyle üretilir ki çizgi kalınlığı ve çizim animasyonu
 * şeridin genişliğinden etkilenmesin.
 */
export function GreaseMark() {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  let d = "";
  if (size && size.w > 0 && size.h > 0) {
    const { w, h } = size;
    const x = (v: number) => (v * w).toFixed(1);
    const y = (v: number) => (v * h).toFixed(1);
    // Sol üstten başlar, saat yönünde döner ve başlangıcın üstünden biraz taşarak biter.
    d = [
      `M ${x(0.012)} ${y(0.16)}`,
      `C ${x(0.2)} ${y(0.03)}, ${x(0.78)} ${y(0.0)}, ${x(0.985)} ${y(0.1)}`,
      `C ${x(1.0)} ${y(0.3)}, ${x(1.0)} ${y(0.74)}, ${x(0.982)} ${y(0.92)}`,
      `C ${x(0.76)} ${y(1.0)}, ${x(0.2)} ${y(0.99)}, ${x(0.014)} ${y(0.93)}`,
      `C ${x(0.0)} ${y(0.7)}, ${x(0.0)} ${y(0.32)}, ${x(0.016)} ${y(0.1)}`,
      `C ${x(0.05)} ${y(0.05)}, ${x(0.11)} ${y(0.04)}, ${x(0.17)} ${y(0.06)}`,
    ].join(" ");
  }

  return (
    <svg
      ref={ref}
      aria-hidden
      className="grease-mark pointer-events-none absolute -left-3 -top-2.5 w-[calc(100%+1.5rem)] h-[calc(100%+1rem)] overflow-visible"
    >
      {d && <path pathLength={1} d={d} />}
    </svg>
  );
}
