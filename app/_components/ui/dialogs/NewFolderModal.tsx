"use client";

import { useEffect, useState } from "react";
import { FolderPlus, Loader2 } from "lucide-react";
import { Modal } from "../Modal";

export function NewFolderModal({
  open, onClose, onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setName(""); }, [open]);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    try { await onCreate(name.trim()); onClose(); }
    finally { setBusy(false); }
  }

  return (
    <Modal
      open={open} onClose={onClose} title="New folder"
      footer={
        <>
          <button onClick={onClose} className="text-sm font-medium px-4 py-2 rounded-lg text-zinc-700 hover:bg-zinc-100">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim() || busy}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
            Create
          </button>
        </>
      }
    >
      <label className="block text-xs font-medium text-zinc-600 mb-1.5">Folder name</label>
      <input
        autoFocus value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        placeholder="My new folder"
        className="w-full h-10 px-3 rounded-lg bg-white border border-zinc-200 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
      />
    </Modal>
  );
}
