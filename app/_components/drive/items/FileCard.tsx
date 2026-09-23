"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { Clock, MoreVertical, Pin, RotateCcw, Star, Trash2 } from "lucide-react";
import type { DriveFile } from "@/lib/drive/drive";
import { getFileType } from "@/lib/types/file-types";
import { getTagColor } from "@/lib/tag-colors";
import { displayTagName } from "@/lib/tag-kinds";
import { driveActions } from "@/lib/drive/drive-actions-bridge";
import { useBulkSelectionActive, useIsSelected, useIsCut } from "@/lib/stores";
import { useFileTags } from "../../tags/TagsProvider";
import { HiddenBadge } from "./HiddenBadge";
import { Thumbnail } from "../preview/Thumbnail";

interface FileCardProps {
  file: DriveFile;
  isPinned?: boolean;
  isHidden?: boolean;
  onOpen: (file: DriveFile) => void;
  onSelect?: (file: DriveFile, e: React.MouseEvent) => void;
  onMenu?: (file: DriveFile, anchor: HTMLElement, e?: React.MouseEvent) => void;
  onToggleStar?: (file: DriveFile) => void;
  onDragStart?: (e: React.DragEvent, fileId: string) => void;
  isTrash?: boolean;
  onRestore?: (file: DriveFile) => void;
  onDeleteForever?: (file: DriveFile) => void;
}

export const FileCard = memo(function FileCard({
  file,
  isPinned,
  isHidden,
  onOpen, onSelect, onMenu, onToggleStar,
  isTrash, onRestore, onDeleteForever,
}: FileCardProps) {
  const selected = useIsSelected(file.id);
  const isCut = useIsCut(file.id);
  const bulkSelectionActive = useBulkSelectionActive();
  const fileTags = useFileTags(file.id);
  const type = getFileType(file.mimeType);
  const Icon = type.icon;
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const showThumb = thumbLoaded && !thumbFailed;

  useEffect(() => {
    setThumbLoaded(false);
    setThumbFailed(false);
  }, [file.id]);

  const handleThumbLoaded = useCallback(() => {
    setThumbLoaded(true);
    setThumbFailed(false);
  }, []);

  const handleThumbFailed = useCallback(() => {
    setThumbFailed(true);
  }, []);

  const timeLabel = file.modifiedTime ? formatDate(file.modifiedTime) : null;

  return (
    <div
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
      className={`group relative min-w-0 rounded-2xl bg-white dark:bg-zinc-900 p-1.5 cursor-pointer transition-all focus:outline-none ${
        isCut
          ? "opacity-55 ring-2 ring-dashed ring-amber-500"
          : isHidden
          ? "opacity-60 ring-1 ring-zinc-200/80 dark:ring-zinc-700 hover:ring-zinc-300 dark:hover:ring-zinc-600"
          : selected
          ? "ring-2 ring-blue-500"
          : "ring-1 ring-zinc-200/80 dark:ring-zinc-700 hover:ring-zinc-300 dark:hover:ring-zinc-600 focus:ring-2 focus:ring-blue-400"
      }`}
    >
      {/* Header — icon, title, menu */}
      <div className="flex items-center gap-2 min-w-0 mb-1.5 px-0.5">
        <div
          className={`flex items-center gap-1 min-w-0 overflow-hidden ${
            isPinned ? "flex-1 min-w-0" : "max-w-[70%]"
          }`}
        >
          <div className={`w-5 h-5 shrink-0 rounded-md ${type.bg} flex items-center justify-center`}>
            <Icon className={`w-2.5 h-2.5 ${type.tint}`} />
          </div>
          <p
            className="min-w-0 flex-1 text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-tight"
            title={file.name}
          >
            {file.name}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {isHidden && <HiddenBadge className="mr-0.5" />}
          {isPinned && (
            <div
              className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-blue-600"
              aria-hidden="true"
            >
              <Pin className="w-3.5 h-3.5" fill="currentColor" strokeWidth={2} />
            </div>
          )}
          {onMenu && !bulkSelectionActive && !isTrash && (
            <button
              onClick={(e) => { e.stopPropagation(); onMenu(file, e.currentTarget); }}
              className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              aria-label="More actions"
            >
              <MoreVertical className="w-4 h-4" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {!showThumb && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
            <div className={`w-14 h-14 rounded-2xl ${type.bg} flex items-center justify-center shadow-sm`}>
              <Icon className={`w-7 h-7 ${type.tint}`} strokeWidth={2} />
            </div>
          </div>
        )}
        <div className={`absolute inset-0 transition-opacity duration-300 ease-out ${showThumb ? "opacity-100" : "opacity-0"}`}>
          <Thumbnail
            fileId={file.id}
            mimeType={file.mimeType}
            fileName={file.name}
            thumbnailLink={file.thumbnailLink}
            modifiedTime={file.modifiedTime}
            alt={file.name}
            className="w-full h-full object-cover object-top"
            size={400}
            mode="grid"
            lazy
            onLoaded={handleThumbLoaded}
            onFailed={handleThumbFailed}
          />
        </div>

        {/* Star — bottom-right on preview */}
        {onToggleStar && !isTrash && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleStar(file); }}
            className="absolute bottom-2.5 right-2.5 z-30 w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-black/25 hover:backdrop-blur-sm"
            aria-label={file.starred ? "Remove from starred" : "Add to starred"}
          >
            <Star
              className={`w-4 h-4 drop-shadow-sm ${
                file.starred ? "text-amber-400" : "text-white/90"
              }`}
              fill={file.starred ? "currentColor" : "none"}
              strokeWidth={2}
            />
          </button>
        )}

        {/* Bottom gradient overlay — date + tags */}
        {(timeLabel || fileTags.length > 0) && (
          <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
            <div className="relative px-2.5 pb-2.5 pt-3">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.72) 30%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.15) 75%, transparent 100%)",
                }}
              />
              <div className="relative flex items-center gap-1.5 min-w-0 flex-wrap">
                {timeLabel && (
                  <>
                    <Clock className="w-3.5 h-3.5 text-white/90 shrink-0" strokeWidth={2} />
                    <span className="text-xs text-white/95">{timeLabel}</span>
                  </>
                )}
                {fileTags.length > 0 && fileTags.slice(0, 2).map((tag, i) => {
                  const color = getTagColor(tag.colorId);
                  return (
                    <span key={tag.id} className="inline-flex items-center gap-1.5">
                      {(timeLabel || i > 0) && <span className="text-white/40 text-xs">·</span>}
                      <span
                        title={displayTagName(tag)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/20 backdrop-blur-sm text-[11px] font-medium text-white"
                      >
                        {tag.emoji ? (
                          <span className="shrink-0">{tag.emoji}</span>
                        ) : (
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${color.dot}`} />
                        )}
                        {displayTagName(tag)}
                      </span>
                    </span>
                  );
                })}
                {fileTags.length > 2 && (
                  <span className="text-[10px] text-white/60">+{fileTags.length - 2}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {isTrash && !bulkSelectionActive && (
        <div className="flex gap-2 px-1 pt-2 pb-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); onRestore?.(file); }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium px-2 py-1.5 rounded-lg btn-primary"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restore
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteForever?.(file); }}
            className="inline-flex items-center justify-center gap-1.5 text-xs font-medium px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
});

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diff = now - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const year = 365 * day;

  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.round(diff / minute)}m ago`;
  if (diff < day) return `${Math.round(diff / hour)}h ago`;
  if (diff < 2 * day) return "Yesterday";
  if (diff < week) return `${Math.round(diff / day)}d ago`;
  if (diff < year) return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
