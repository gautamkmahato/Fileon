"use client";

import { Download, Archive, Eye, EyeOff, FolderInput, Loader2, Pencil, RotateCcw, Tag, Trash2, X } from "lucide-react";

interface SelectionBarProps {
  count: number;
  onDownload: () => void;
  onMove: () => void;
  onTrash: () => void;
  onRename?: () => void;
  onTag?: () => void;
  onToggleHide?: () => void;
  hideActionLabel?: string;
  onArchive?: () => void;
  onRestore?: () => void;
  onDeleteForever?: () => void;
  onClear: () => void;
  busy?: boolean;
  busyLabel?: string;
  isTrash?: boolean;
  allowSingleActions?: boolean;
}

export function SelectionBar({
  count, onDownload, onMove, onTrash, onRename, onTag, onToggleHide, hideActionLabel,
  onArchive, onRestore, onDeleteForever, onClear,
  busy, busyLabel, isTrash, allowSingleActions,
}: SelectionBarProps) {
  if (count < 1) return null;

  const isBulk = count >= 2 || !!allowSingleActions;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-1 px-2 py-2 bg-zinc-900 dark:bg-zinc-900/90 dark:backdrop-blur-md text-white rounded-xl shadow-2xl border border-zinc-700 dark:border-zinc-700/60">
        {busy ? (
          <span className="flex items-center gap-2 text-sm font-medium px-3 py-1.5 text-zinc-300">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            {busyLabel ?? "Working…"}
          </span>
        ) : (
          <>
            <span className="text-sm font-medium px-3">{count} selected</span>
            <div className="w-px h-6 bg-zinc-600 mx-1" />
            {isTrash ? (
              <>
                {isBulk && <BarButton icon={RotateCcw} label="Restore" onClick={onRestore!} />}
                <BarButton icon={Trash2} label="Delete forever" onClick={onDeleteForever!} />
              </>
            ) : (
              <>
                {isBulk && <BarButton icon={Download} label="Download" onClick={onDownload} />}
                {isBulk && <BarButton icon={FolderInput} label="Move" onClick={onMove} />}
                {isBulk && onRename && <BarButton icon={Pencil} label="Rename" onClick={onRename} />}
                {onTag && <BarButton icon={Tag} label="Tag" onClick={onTag} />}
                {onArchive && <BarButton icon={Archive} label="Archive" onClick={onArchive} />}
                {onToggleHide && (
                  <BarButton
                    icon={hideActionLabel === "Unhide" ? Eye : EyeOff}
                    label={hideActionLabel ?? "Hide"}
                    onClick={onToggleHide}
                  />
                )}
                {isBulk && <BarButton icon={Trash2} label="Trash" onClick={onTrash} />}
              </>
            )}
            <div className="w-px h-6 bg-zinc-600 mx-1" />
            <BarButton icon={X} label="Clear" onClick={onClear} />
          </>
        )}
      </div>
    </div>
  );
}

function BarButton({
  icon: Icon, label, onClick,
}: {
  icon: typeof Download;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm hover:bg-zinc-700 transition-colors"
    >
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
