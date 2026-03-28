import { useEffect, useState } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileCheck, Link, Search, Camera } from "lucide-react";
import { useArchiveTree } from "../../hooks/useArchiveTree";
import { useArchiveStore } from "../../store/useArchiveStore";
import { useHDDStatus } from "../../hooks/useHDDStatus";
import Card from "../ui/Card";
import Spinner from "../ui/Spinner";
import type { ArchiveFolder } from "../../types";

function FolderNode({
  node,
  depth = 0,
  onSelect,
  selected,
}: {
  node: ArchiveFolder;
  depth?: number;
  onSelect: (folder: ArchiveFolder) => void;
  selected: ArchiveFolder | null;
}) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const isSelected = selected?.path === node.path;

  return (
    <div>
      <button
        onClick={() => { setOpen((o) => !o); onSelect(node); }}
        className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-sm transition-colors text-left ${
          isSelected ? "bg-[rgba(108,140,255,0.12)] text-[#6c8cff]" : "hover:bg-[#1a1d2e] text-[#8890b4] hover:text-[#e8eaf6]"
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <span className="shrink-0 w-3.5">
          {hasChildren ? (open ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : null}
        </span>
        {isSelected || open ? (
          <FolderOpen size={13} className="shrink-0" />
        ) : (
          <Folder size={13} className="shrink-0" />
        )}
        <span className="flex-1 truncate">{node.name}</span>
        {node.has_manifest && <FileCheck size={10} className="shrink-0 text-[#3dd68c]" />}
        {node.has_edits && <Link size={10} className="shrink-0 text-[#a78bfa]" />}
        {node.file_count > 0 && (
          <span className="text-xs text-[#565e80]">{node.file_count}</span>
        )}
      </button>
      {open && hasChildren && (
        <div>
          {node.children.map((child) => (
            <FolderNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selected={selected}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ArchiveBrowser() {
  const hdd = useHDDStatus();
  const { loadTree } = useArchiveTree();
  const { tree, isLoading, selectedFolder, setSelectedFolder, searchQuery, setSearchQuery } = useArchiveStore();

  useEffect(() => {
    if (hdd.connected) void loadTree();
  }, [hdd.connected]);

  // Filter tree by search
  function filterTree(node: ArchiveFolder, q: string): ArchiveFolder | null {
    if (!q) return node;
    const matchesSelf = node.name.toLowerCase().includes(q.toLowerCase());
    const filteredChildren = node.children
      .map((c) => filterTree(c, q))
      .filter(Boolean) as ArchiveFolder[];
    if (matchesSelf || filteredChildren.length > 0) {
      return { ...node, children: filteredChildren };
    }
    return null;
  }

  const displayTree = tree && searchQuery ? filterTree(tree, searchQuery) : tree;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#e8eaf6]">Arşiv Tarayıcısı</h1>
          <p className="text-sm text-[#565e80] mt-0.5">ARCHIVE/ klasör yapısı</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-[#13161f] border border-[#252840] rounded-lg px-3 py-2">
        <Search size={13} className="text-[#565e80] shrink-0" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Klasör veya etkinlik ara…"
          className="bg-transparent text-sm text-[#e8eaf6] outline-none w-full placeholder:text-[#565e80]"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[60vh]">
        {/* Tree */}
        <Card padded={false} className="lg:col-span-1 p-3 overflow-y-auto max-h-[70vh]">
          {isLoading && <div className="flex justify-center py-8"><Spinner size={24} /></div>}
          {!isLoading && !tree && (
            <p className="text-xs text-[#565e80] text-center py-8">HDD bağlı değil</p>
          )}
          {!isLoading && tree && !displayTree && (
            <p className="text-xs text-[#565e80] text-center py-8">Eşleşen klasör yok</p>
          )}
          {displayTree && (
            <FolderNode node={displayTree} onSelect={setSelectedFolder} selected={selectedFolder} />
          )}
        </Card>

        {/* Content panel */}
        <Card className="lg:col-span-2">
          {!selectedFolder ? (
            <div className="flex flex-col items-center justify-center h-48 text-[#565e80] gap-2">
              <FolderOpen size={32} className="opacity-30" />
              <p className="text-sm">Soldan bir klasör seçin</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <FolderOpen size={16} className="text-[#6c8cff]" />
                <h2 className="text-sm font-medium text-[#e8eaf6]">{selectedFolder.name}</h2>
                {selectedFolder.has_manifest && (
                  <span className="text-xs text-[#3dd68c] flex items-center gap-1">
                    <FileCheck size={11} /> Manifest
                  </span>
                )}
                {selectedFolder.has_edits && (
                  <span className="text-xs text-[#a78bfa] flex items-center gap-1">
                    <Link size={11} /> Düzenlemeler
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-[#13161f] rounded-lg p-3">
                  <p className="text-[#565e80]">Dosya Sayısı</p>
                  <p className="text-lg font-semibold text-[#e8eaf6] mt-0.5">{selectedFolder.file_count}</p>
                </div>
                <div className="bg-[#13161f] rounded-lg p-3">
                  <p className="text-[#565e80]">Alt Klasör</p>
                  <p className="text-lg font-semibold text-[#e8eaf6] mt-0.5">{selectedFolder.children.length}</p>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-xs text-[#565e80] font-mono truncate">{selectedFolder.path}</p>
              </div>
              {/* Placeholder thumbnail grid */}
              {selectedFolder.file_count > 0 && (
                <div className="mt-4 grid grid-cols-6 gap-2">
                  {Array.from({ length: Math.min(12, selectedFolder.file_count) }).map((_, i) => (
                    <div key={i} className="aspect-square rounded-lg bg-[#1a1d2e] border border-[#252840] flex items-center justify-center">
                      <Camera size={14} className="text-[#363b60]" />
                    </div>
                  ))}
                  {selectedFolder.file_count > 12 && (
                    <div className="aspect-square rounded-lg bg-[#1a1d2e] border border-[#252840] flex items-center justify-center text-xs text-[#565e80]">
                      +{selectedFolder.file_count - 12}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
