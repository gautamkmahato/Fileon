"use client";

import { useEffect, useRef } from "react";
import { Pencil, Trash2 } from "lucide-react";

interface ViewContextMenuProps {
  x: number;
  y: number;
  canDelete: boolean;
  renameLabel?: string;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ViewContextMenu({
  x, y, canDelete, renameLabel = "Rename", onRename, onDelete, onClose,
}: ViewContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[90] min-w-[160px] py-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-xl"
      style={{ left: x, top: y }}
    >
      <button
        onClick={() => { onRename(); onClose(); }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
      >
        <Pencil className="w-3.5 h-3.5" />
        {renameLabel}
      </button>
      {canDelete && (
        <button
          onClick={() => { onDelete(); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      )}
    </div>
  );
}
