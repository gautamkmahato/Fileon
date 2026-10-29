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
    <div className="fixed inset-x-0 bottom-4 sm:bottom-6 z-50 flex justify-center px-3 pointer-events-none">
      <div className="pointer-events-auto flex w-max max-w-full flex-wrap items-center justify-center gap-1 px-2 py-2 bg-zinc-900 dark:bg-zinc-900/90 dark:backdrop-blur-md text-white rounded-xl shadow-2xl border border-zinc-700 dark:border-zinc-700/60">
        {busy ? (
          <span className="flex items-center gap-2 text-sm font-medium px-3 py-1.5 text-zinc-300 whitespace-nowrap">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            {busyLabel ?? "Working…"}
          </span>
        ) : (
          <>
            <span className="text-sm font-medium px-3 whitespace-nowrap shrink-0">{count} selected</span>
            <div className="w-px h-6 bg-zinc-600 mx-1 shrink-0" />
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
            <div className="w-px h-6 bg-zinc-600 mx-1 shrink-0" />
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
      className="flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm whitespace-nowrap hover:bg-zinc-700 transition-colors"
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}
