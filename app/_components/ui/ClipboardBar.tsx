"use client";

import { X } from "lucide-react";
import { useClipboardStore, clipboardLabel } from "@/lib/stores";

interface ClipboardBarProps {
  onCancel: () => void;
  /** Lift above selection bar when both are visible. */
  elevated?: boolean;
}

export function ClipboardBar({ onCancel, elevated }: ClipboardBarProps) {
  const mode = useClipboardStore((s) => s.mode);
  const count = useClipboardStore((s) => s.items.length);

  if (!mode || count === 0) return null;

  return (
    <div className={`fixed left-1/2 -translate-x-1/2 z-50 ${elevated ? "bottom-24" : "bottom-6"}`}>
      <div className="flex items-center gap-3 px-4 py-2.5 bg-zinc-900/95 dark:bg-zinc-900 text-white rounded-xl shadow-2xl border border-amber-500/40 backdrop-blur-md">
        <span className="text-sm font-medium text-amber-100">
          {count} file{count !== 1 ? "s" : ""} in clipboard · {mode === "cut" ? "Cut" : "Copy"} · ⌘V to paste
        </span>
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Status line for toolbar area when clipboard is active. */
export function ClipboardStatus() {
  const mode = useClipboardStore((s) => s.mode);
  const count = useClipboardStore((s) => s.items.length);
  const label = clipboardLabel(mode, count);
  if (!label) return null;
  return (
    <span className="text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-2.5 py-1 rounded-lg">
      {label}
    </span>
  );
}
