import FolderTree from "./FolderTree";
import ThumbnailGrid from "./ThumbnailGrid";
import { useArchiveStore } from "../../store/useArchiveStore";
import { Search } from "lucide-react";
import type { MediaFile } from "../../types";

export default function ArchiveBrowser() {
  const { tree, selectedFolder, searchQuery, setSelectedFolder, setSearchQuery } = useArchiveStore();

  // Placeholder files — in production these would come from a Tauri command
  const files: MediaFile[] = [];

  return (
    <div className="flex gap-5 h-full">
      {/* Sidebar tree */}
      <div className="w-64 shrink-0 bg-[#1a1d27] border border-[#2e3347] rounded-xl overflow-auto">
        <div className="p-3 border-b border-[#2e3347]">
          <div className="flex items-center gap-2 bg-[#242736] rounded-lg px-3 py-1.5">
            <Search size={13} className="text-[#8b92a9]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ara…"
              className="bg-transparent text-xs text-[#e8eaf0] placeholder-[#8b92a9] outline-none flex-1"
            />
          </div>
        </div>
        <FolderTree tree={tree} selected={selectedFolder} onSelect={setSelectedFolder} />
      </div>

      {/* Content */}
      <div className="flex-1 bg-[#1a1d27] border border-[#2e3347] rounded-xl overflow-auto p-5">
        {selectedFolder ? (
          <>
            <p className="text-sm font-semibold text-[#e8eaf0] mb-1">{selectedFolder.name}</p>
            <p className="text-xs text-[#8b92a9] mb-4">{selectedFolder.path}</p>
            <ThumbnailGrid files={files} />
          </>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-[#8b92a9]">Sol taraftan bir klasör seçin.</p>
          </div>
        )}
      </div>
    </div>
  );
}
