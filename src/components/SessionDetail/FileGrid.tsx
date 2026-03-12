import type { MediaFile } from "../../types";
import { formatBytes } from "../../utils/formatters";
import { Image, Film } from "lucide-react";

interface FileGridProps {
  files: MediaFile[];
}

export default function FileGrid({ files }: FileGridProps) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
      {files.map((file) => (
        <div
          key={file.path}
          title={file.filename}
          className="aspect-square bg-[#242736] rounded-lg overflow-hidden flex flex-col items-center justify-center group cursor-default relative"
        >
          {file.thumbnail ? (
            <img src={file.thumbnail} alt={file.filename} className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1">
              {file.kind === "video" ? (
                <Film size={24} className="text-[#6c8cff]" />
              ) : (
                <Image size={24} className="text-[#8b92a9]" />
              )}
            </div>
          )}
          <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-1">
            <p className="text-[10px] text-white text-center truncate w-full px-1">{file.filename}</p>
            <p className="text-[10px] text-[#8b92a9]">{formatBytes(file.size_bytes)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
