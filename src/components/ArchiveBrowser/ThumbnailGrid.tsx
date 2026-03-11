import type { MediaFile } from "../../types";
import { Image, Film } from "lucide-react";
import { formatBytes } from "../../utils/formatters";

interface ThumbnailGridProps {
  files: MediaFile[];
}

export default function ThumbnailGrid({ files }: ThumbnailGridProps) {
  if (files.length === 0) {
    return <p className="text-sm text-[#8b92a9]">Bu klasörde dosya yok.</p>;
  }
  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
      {files.map((f) => (
        <div
          key={f.path}
          className="aspect-square bg-[#242736] rounded-lg overflow-hidden group cursor-default relative"
          title={f.filename}
        >
          {f.thumbnail ? (
            <img src={f.thumbnail} alt={f.filename} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {f.kind === "video" ? (
                <Film size={22} className="text-[#6c8cff]" />
              ) : (
                <Image size={22} className="text-[#8b92a9]" />
              )}
            </div>
          )}
          <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-end justify-end p-1">
            <p className="text-[9px] text-white truncate w-full">{f.filename}</p>
            <p className="text-[9px] text-[#8b92a9]">{formatBytes(f.size_bytes)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
