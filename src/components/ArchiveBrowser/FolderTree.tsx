import type { ArchiveFolder } from "../../types";
import { Folder, ChevronRight, ChevronDown } from "lucide-react";
import { useState } from "react";

interface FolderNodeProps {
  folder: ArchiveFolder;
  onSelect: (f: ArchiveFolder) => void;
  selected: ArchiveFolder | null;
  depth?: number;
}

function FolderNode({ folder, onSelect, selected, depth = 0 }: FolderNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isSelected = selected?.path === folder.path;
  const hasChildren = folder.children.length > 0;

  return (
    <div>
      <button
        type="button"
        onClick={() => { setExpanded(!expanded); onSelect(folder); }}
        className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors ${
          isSelected ? "bg-[#6c8cff]/15 text-[#6c8cff]" : "text-[#8b92a9] hover:bg-[#242736] hover:text-[#e8eaf0]"
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {hasChildren ? (
          expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
        ) : (
          <span className="w-3" />
        )}
        <Folder size={13} />
        <span className="truncate flex-1 text-left">{folder.name}</span>
        {folder.has_edits && <span className="text-[10px] text-[#f0a830]">E</span>}
        {folder.file_count > 0 && (
          <span className="text-[10px] text-[#8b92a9]">{folder.file_count}</span>
        )}
      </button>
      {expanded && hasChildren && (
        <div>
          {folder.children.map((child) => (
            <FolderNode key={child.path} folder={child} onSelect={onSelect} selected={selected} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

interface FolderTreeProps {
  tree: ArchiveFolder | null;
  selected: ArchiveFolder | null;
  onSelect: (f: ArchiveFolder) => void;
}

export default function FolderTree({ tree, selected, onSelect }: FolderTreeProps) {
  if (!tree) {
    return <p className="text-xs text-[#8b92a9] p-4">Arşiv yükleniyor…</p>;
  }
  return (
    <div className="py-2">
      <FolderNode folder={tree} onSelect={onSelect} selected={selected} />
    </div>
  );
}
