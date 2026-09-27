"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Modal } from "../Modal";

/** Confirmation dialog for destructive actions (trash, delete forever, empty trash). */
export function ConfirmModal({
  open, title, message, confirmLabel = "Confirm", confirmVariant = "default",
  onClose, onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: "default" | "danger";
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);

  async function handle() {
    setBusy(true);
    try { await onConfirm(); onClose(); }
    finally { setBusy(false); }
  }

  return (
    <Modal
      open={open} onClose={onClose} title={title}
      footer={
        <>
          <button onClick={onClose} className="text-sm font-medium px-4 py-2 rounded-lg text-zinc-700 hover:bg-zinc-100">
            Cancel
          </button>
          <button
            onClick={handle}
            disabled={busy}
            className={`text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5 ${
              confirmVariant === "danger"
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-zinc-900 text-white hover:bg-zinc-700"
            }`}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        {confirmVariant === "danger" && (
          <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        )}
        <p className="text-sm text-zinc-700 leading-relaxed flex-1">{message}</p>
      </div>
    </Modal>
  );
}
