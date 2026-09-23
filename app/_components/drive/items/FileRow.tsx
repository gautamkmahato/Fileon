"use client";

import { memo } from "react";
import { GripVertical, MoreVertical, Pin, Trash2, User, Users } from "lucide-react";
import type { DriveFile } from "@/lib/drive/drive";
import { humanFileSize } from "@/lib/drive/drive";
import { getFileType } from "@/lib/types/file-types";
import { driveActions } from "@/lib/drive/drive-actions-bridge";
import { useBulkSelectionActive, useIsSelected, useIsCut } from "@/lib/stores";
import { useFileTags } from "../../tags/TagsProvider";
import { TagPills } from "../../tags/TagDisplay";
import { HiddenBadge } from "./HiddenBadge";

interface FileRowProps {
  file: DriveFile;
  isPinned?: boolean;
  isHidden?: boolean;
  showDragHandle?: boolean;
  onOpen: (file: DriveFile) => void;
  onSelect?: (file: DriveFile, e: React.MouseEvent) => void;
  onMenu?: (file: DriveFile, anchor: HTMLElement, e?: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent, fileId: string) => void;
  isTrash?: boolean;
  onRestore?: (file: DriveFile) => void;
  onDeleteForever?: (file: DriveFile) => void;
}

export const FileRow = memo(function FileRow({
  file,
  isPinned,
  isHidden,
  showDragHandle,
  onOpen, onSelect, onMenu, onDragStart,
  isTrash, onRestore, onDeleteForever,
}: FileRowProps) {
  const selected = useIsSelected(file.id);
  const isCut = useIsCut(file.id);
  const bulkSelectionActive = useBulkSelectionActive();
  const fileTags = useFileTags(file.id);
  const type = getFileType(file.mimeType);
  const Icon = type.icon;
  const owner = file.owners?.[0];

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={(e) => onDragStart?.(e, file.id)}
      onClick={(e) => onSelect?.(file, e)}
      onDoubleClick={() => onOpen(file)}
      onContextMenu={(e) => {
        if (!onMenu || isTrash) return;
        e.preventDefault();
        e.stopPropagation();
        onMenu(file, e.currentTarget as HTMLElement, e);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onOpen(file);
          return;
        }
        if ((e.key === " " || e.code === "Space") && selected && !isTrash) {
          e.preventDefault();
          driveActions.openQuickLook(file);
        }
      }}
      className={`group grid grid-cols-[1fr_180px_160px_120px_40px] gap-4 items-center px-5 py-3 cursor-pointer focus:outline-none border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 transition-colors ${
        isCut
          ? "opacity-55 bg-amber-50/40 dark:bg-amber-950/20"
          : isHidden
          ? "opacity-60"
          : selected
          ? "bg-blue-50 dark:bg-blue-950/30"
          : "hover:bg-zinc-50 dark:hover:bg-zinc-900 focus:bg-zinc-50 dark:focus:bg-zinc-900"
      } ${isCut ? "outline outline-1 outline-dashed outline-amber-400 -outline-offset-1" : ""}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {showDragHandle && (
          <GripVertical className="w-4 h-4 text-zinc-400 shrink-0 cursor-grab" />
        )}
        <input
          type="checkbox"
          checked={!!selected}
          readOnly
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-2 focus:ring-blue-200 shrink-0 pointer-events-none"
        />
        <div className={`w-9 h-9 rounded-lg ${type.rowBg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-4 h-4 ${type.rowTint}`} strokeWidth={2.5} />
        </div>
        {isPinned && (
          <Pin className="w-3.5 h-3.5 text-blue-600 shrink-0" fill="currentColor" strokeWidth={2} aria-label="Pinned" />
        )}
        {isHidden && <HiddenBadge className="shrink-0" />}
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate flex-1" title={file.name}>
          {file.name}
        </p>
        <TagPills tags={fileTags} max={2} className="shrink-0 hidden lg:flex" />
        {file.shared && (
          <Users className="w-4 h-4 text-zinc-400 shrink-0" strokeWidth={2} />
        )}
      </div>
      <div className="flex items-center">
        {owner?.photoLink ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={owner.photoLink}
            alt={owner.displayName}
            title={owner.displayName}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center" title={owner?.displayName || "Unknown"}>
            <User className="w-4 h-4 text-zinc-500" />
          </div>
        )}
      </div>
      <span className="text-sm text-zinc-600 dark:text-zinc-400">{formatRelative(file.modifiedTime)}</span>
      <span className="text-sm text-zinc-600 dark:text-zinc-400">{file.size ? humanFileSize(file.size) : "—"}</span>
      <div className="flex items-center justify-end gap-1">
        {isTrash && !bulkSelectionActive ? (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onRestore?.(file); }}
              className="text-xs font-medium px-2 py-1 rounded-md btn-primary"
            >
              Restore
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteForever?.(file); }}
              className="w-7 h-7 rounded-full text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center"
              aria-label="Delete forever"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        ) : onMenu && !bulkSelectionActive ? (
          <button
            onClick={(e) => { e.stopPropagation(); onMenu(file, e.currentTarget); }}
            className={`w-7 h-7 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center ${
              selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
            aria-label="More actions"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
});

function formatRelative(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const now = Date.now();
  const diff = now - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;

  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.round(diff / minute)}m ago`;
  if (diff < day) {
    const h = Math.round(diff / hour);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  if (diff < 2 * day) return "Yesterday";
  if (diff < week) {
    const d = Math.round(diff / day);
    return `${d} days ago`;
  }
  if (diff < 30 * day) {
    const w = Math.round(diff / week);
    return `${w} week${w === 1 ? "" : "s"} ago`;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
