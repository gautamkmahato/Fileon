"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { updateView } from "@/lib/views";
import { toast } from "@/lib/toast";

interface ViewRenameModalProps {
  open: boolean;
  currentName: string;
  onClose: () => void;
  onRenamed: () => void;
  viewId: string;
}

export function ViewRenameModal({
  open, currentName, onClose, onRenamed, viewId,
}: ViewRenameModalProps) {
  const [name, setName] = useState(currentName);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setName(currentName);
  }, [open, currentName]);

  if (!open) return null;

  async function handleSave() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await updateView(viewId, { name });
      toast.success("View renamed");
      onRenamed();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rename view");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200/80 dark:border-zinc-700">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Rename view</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-sm outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-zinc-800"
            onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
          />
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-200 dark:border-zinc-700">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancel</button>
          <button
            onClick={handleSave}
            disabled={busy || !name.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg btn-primary text-sm font-medium disabled:opacity-50"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
