"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Modal } from "../Modal";

export function RenameModal({
  open, initialName, onClose, onRename,
}: {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onRename: (name: string) => Promise<void> | void;
}) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setName(initialName); }, [open, initialName]);

  async function submit() {
    const t = name.trim();
    if (!t || t === initialName) { onClose(); return; }
    setBusy(true);
    try { await onRename(t); onClose(); }
    finally { setBusy(false); }
  }

  return (
    <Modal
      open={open} onClose={onClose} title="Rename"
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
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
            Rename
          </button>
        </>
      }
    >
      <label className="block text-xs font-medium text-zinc-600 mb-1.5">New name</label>
      <input
        autoFocus value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        className="w-full h-10 px-3 rounded-lg bg-white border border-zinc-200 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
      />
    </Modal>
  );
}
