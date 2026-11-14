import { useEffect, useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { useArchiveTree } from "../../hooks/useArchiveTree";
import { useArchiveStore } from "../../store/useArchiveStore";
import { useHDDStatus } from "../../hooks/useHDDStatus";
import Spinner from "../ui/Spinner";
import { Notice, PageHeader, inputClass } from "../ui/Page";
import type { ArchiveFolder } from "../../types";

const n = (value: number) => value.toLocaleString("tr-TR");

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
        type="button"
        aria-expanded={hasChildren ? open : undefined}
        onClick={() => {
          setOpen((o) => !o);
          onSelect(node);
        }}
        className={`w-full flex items-center gap-1.5 h-7 pr-2 rounded-sm text-[13px] text-left transition-colors ${
          isSelected ? "bg-table text-paper font-medium" : "text-dim hover:text-paper hover:bg-table/60"
        }`}
        style={{ paddingLeft: `${6 + depth * 14}px` }}
      >
        <span className="shrink-0 w-3.5 flex">
          {hasChildren ? open ? <ChevronDown size={13} /> : <ChevronRight size={13} /> : null}
        </span>
        <span className="flex-1 truncate font-mono">{node.name}</span>
        {node.file_count > 0 && <span className="condensed text-xs text-faint">{n(node.file_count)}</span>}
      </button>
      {open && hasChildren && (
        <div>
          {node.children.map((child) => (
            <FolderNode key={child.path} node={child} depth={depth + 1} onSelect={onSelect} selected={selected} />
          ))}
        </div>
      )}
    </div>
  );
}

function FolderDetail({ folder, onSelect }: { folder: ArchiveFolder; onSelect: (f: ArchiveFolder) => void }) {
  const facts = [`${n(folder.file_count)} dosya`];
  if (folder.children.length > 0) facts.push(`${n(folder.children.length)} alt klasör`);

  return (
    <div>
      <h2 className="display text-2xl m-0 break-words">{folder.name}</h2>
      <p className="font-mono text-xs text-dim break-all m-0 mt-1.5">{folder.path}</p>
      <p className="m-0 mt-4">{facts.join(", ")}.</p>
      {(folder.has_manifest || folder.has_edits) && (
        <p className="text-[13px] text-dim m-0 mt-1">
          {folder.has_manifest && "Oturum kaydı (manifest) var. "}
          {folder.has_edits && "Bu klasörün düzenlenmiş kopyaları EDITS altında."}
        </p>
      )}

      {folder.children.length > 0 && (
        <ul className="list-none m-0 mt-6 p-0 border-t border-edge">
          {folder.children.map((child) => (
            <li key={child.path} className="border-b border-edge">
              <button
                type="button"
                onClick={() => onSelect(child)}
                className="flex items-center justify-between gap-4 py-2.5 -mx-3 px-3 w-[calc(100%+1.5rem)] rounded-sm text-left hover:bg-table/50 transition-colors"
              >
                <span className="font-mono text-[13px] truncate">{child.name}</span>
                <span className="condensed text-[13px] text-dim shrink-0">{n(child.file_count)} dosya</span>
              </button>
            </li>
          ))}
        </ul>
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
  }, [hdd.connected, loadTree]);

  function filterTree(node: ArchiveFolder, q: string): ArchiveFolder | null {
    if (!q) return node;
    const matchesSelf = node.name.toLowerCase().includes(q.toLowerCase());
    const filteredChildren = node.children.map((c) => filterTree(c, q)).filter(Boolean) as ArchiveFolder[];
    if (matchesSelf || filteredChildren.length > 0) {
      return { ...node, children: filteredChildren };
    }
    return null;
  }

  const displayTree = tree && searchQuery ? filterTree(tree, searchQuery) : tree;

  return (
    <div className="space-y-6">
      <PageHeader title="Arşiv" status="Diskteki arşiv klasörleri, yıl ve etkinliğe göre.">
        <input
          type="search"
          aria-label="Klasör veya etkinlik adında ara"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Klasör veya etkinlik ara"
          className={`${inputClass} w-64`}
        />
      </PageHeader>

      {!hdd.connected && !tree ? (
        <Notice title="Disk bağlı değil">Arşivi görmek için diski takın.</Notice>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-10">
          <nav aria-label="Arşiv klasörleri" className="overflow-y-auto max-h-[calc(100vh-220px)] lg:border-r lg:border-edge lg:pr-4">
            {isLoading && (
              <div className="flex justify-center py-8">
                <Spinner size={22} />
              </div>
            )}
            {!isLoading && tree && !displayTree && (
              <p className="text-[13px] text-dim m-0">"{searchQuery}" ile eşleşen klasör yok.</p>
            )}
            {displayTree && <FolderNode node={displayTree} onSelect={setSelectedFolder} selected={selectedFolder} />}
          </nav>

          <div className="min-w-0">
            {selectedFolder ? (
              <FolderDetail folder={selectedFolder} onSelect={setSelectedFolder} />
            ) : (
              <p className="text-dim m-0">İçeriğini görmek için soldan bir klasör seçin.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
