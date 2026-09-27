"use client";

import { useEffect, useState } from "react";
import { Check, Folder as FolderIcon, Loader2, Search } from "lucide-react";
import { Modal } from "../Modal";
import { listAllFolders, type DriveFolder } from "@/lib/drive/drive-extras";
import { useAuth } from "../../auth/AuthProvider";

export function MoveModal({
  open, fileName, currentParentId, excludeFolderId, onClose, onMove,
}: {
  open: boolean;
  fileName: string;
  currentParentId: string | null;
  /** If the file being moved IS a folder, we can't allow moving it into itself. */
  excludeFolderId?: string;
  onClose: () => void;
  onMove: (newParentId: string, destName: string) => Promise<void> | void;
}) {
  const { token } = useAuth();
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    setLoading(true);
    setSelected(null);
    setSearch("");
    listAllFolders(token)
      .then((fs) => { if (!cancelled) setFolders(fs); })
      .catch((err) => { console.error(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, token]);

  const filteredFolders = folders
    .filter((f) => f.id !== excludeFolderId)
    .filter((f) => !search.trim() || f.name.toLowerCase().includes(search.toLowerCase()));

  // Add "My Drive" as a target option (parentId = "root")
  const showMyDrive = currentParentId !== null;
  const filteredMyDrive = showMyDrive && (!search.trim() || "my drive".includes(search.toLowerCase()));

  async function handleMove() {
    if (!selected) return;
    const destName =
      selected === "root"
        ? "My Drive"
        : folders.find((f) => f.id === selected)?.name ?? "folder";
    setBusy(true);
    try { await onMove(selected, destName); onClose(); }
    finally { setBusy(false); }
  }

  return (
    <Modal
      open={open} onClose={onClose} title={`Move "${fileName}"`} width="max-w-md"
      footer={
        <>
          <button onClick={onClose} className="text-sm font-medium px-4 py-2 rounded-lg text-zinc-700 hover:bg-zinc-100">
            Cancel
          </button>
          <button
            onClick={handleMove}
            disabled={!selected || busy}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Move here
          </button>
        </>
      }
    >
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search folders…"
          className="w-full h-9 pl-9 pr-3 rounded-lg bg-white border border-zinc-200 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
        </div>
      ) : (
        <ul className="max-h-[320px] overflow-y-auto -mx-1.5 space-y-0.5">
          {filteredMyDrive && (
            <FolderRow
              name="My Drive"
              selected={selected === "root"}
              isCurrent={currentParentId === null}
              onClick={() => setSelected("root")}
            />
          )}
          {filteredFolders.length === 0 && !filteredMyDrive ? (
            <li className="text-sm text-zinc-500 text-center py-6">No folders found</li>
          ) : (
            filteredFolders.map((f) => (
              <FolderRow
                key={f.id}
                name={f.name}
                selected={selected === f.id}
                isCurrent={f.id === currentParentId}
                onClick={() => setSelected(f.id)}
              />
            ))
          )}
        </ul>
      )}
    </Modal>
  );
}

function FolderRow({
  name, selected, isCurrent, onClick,
}: {
  name: string;
  selected: boolean;
  isCurrent: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        disabled={isCurrent}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
          isCurrent
            ? "text-zinc-400 cursor-not-allowed"
            : selected
              ? "bg-blue-50 text-blue-700"
              : "text-zinc-700 hover:bg-zinc-50"
        }`}
      >
        <FolderIcon className="w-4 h-4 text-zinc-400 shrink-0" />
        <span className="flex-1 truncate">{name}</span>
        {isCurrent && <span className="text-[10px] uppercase tracking-wider text-zinc-400">Current</span>}
        {selected && !isCurrent && <Check className="w-4 h-4 text-blue-600" />}
      </button>
    </li>
  );
}
