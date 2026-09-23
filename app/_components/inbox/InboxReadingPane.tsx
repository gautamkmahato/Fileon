"use client";

import {
  Archive, EyeOff, FolderInput, Pencil, Star, Tag, Trash2, Eye,
} from "lucide-react";
import { humanFileSize, isFolder, type DriveFile } from "@/lib/drive/drive";
import { getFileType } from "@/lib/types/file-types";
import { PreviewBody } from "../drive/preview/PreviewBody";
import { useHidden } from "../hidden/HiddenProvider";
import { TagPills } from "../tags/TagDisplay";
import { useFileTags } from "../tags/TagsProvider";

function ToolbarButton({
  icon: Icon, label, onClick, danger, active, disabled,
}: {
  icon: typeof Star;
  label: string;
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none ${
        danger
          ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
          : active
          ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
          : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      }`}
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={active ? 2.25 : 1.75} fill={active && Icon === Star ? "currentColor" : "none"} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export function InboxReadingPane({
  file,
  onArchive,
  onMove,
  onRename,
  onTag,
  onStar,
  onHide,
  onDelete,
}: {
  file: DriveFile | null;
  onArchive: () => void;
  onMove: () => void;
  onRename: () => void;
  onTag: () => void;
  onStar: () => void;
  onHide: () => void;
  onDelete: () => void;
}) {
  if (!file) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-8 bg-white dark:bg-zinc-950">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Select a file to preview</p>
        <p className="text-xs text-zinc-400 mt-1 max-w-xs">
          Process incoming files here — archive, move, or tag them when you are ready.
        </p>
      </div>
    );
  }

  return (
    <InboxReadingBody
      file={file}
      onArchive={onArchive}
      onMove={onMove}
      onRename={onRename}
      onTag={onTag}
      onStar={onStar}
      onHide={onHide}
      onDelete={onDelete}
    />
  );
}

function InboxReadingBody({
  file, onArchive, onMove, onRename, onTag, onStar, onHide, onDelete,
}: {
  file: DriveFile;
  onArchive: () => void;
  onMove: () => void;
  onRename: () => void;
  onTag: () => void;
  onStar: () => void;
  onHide: () => void;
  onDelete: () => void;
}) {
  const type = getFileType(file.mimeType);
  const tags = useFileTags(file.id);
  const { isHidden } = useHidden();
  const hidden = isHidden(file.id);
  const canDelete = file.capabilities?.canDelete !== false;
  const folder = isFolder(file);

  return (
    <div className="h-full min-h-0 flex flex-col bg-white dark:bg-zinc-950">
      <div className="shrink-0 border-b border-zinc-200/80 dark:border-zinc-800 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {file.name || "Untitled"}
            </h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {type.label}
              {file.size ? ` · ${humanFileSize(file.size)}` : ""}
              {file.modifiedTime
                ? ` · ${new Date(file.modifiedTime).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                : ""}
            </p>
            <TagPills tags={tags} max={4} className="mt-1.5" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-0.5">
          <ToolbarButton icon={Archive} label="Archive" onClick={onArchive} />
          <ToolbarButton icon={FolderInput} label="Move" onClick={onMove} disabled={folder && !file.parents?.length} />
          <ToolbarButton icon={Pencil} label="Rename" onClick={onRename} />
          <ToolbarButton icon={Tag} label="Tag" onClick={onTag} />
          <ToolbarButton icon={Star} label={file.starred ? "Starred" : "Star"} onClick={onStar} active={!!file.starred} />
          <ToolbarButton
            icon={hidden ? Eye : EyeOff}
            label={hidden ? "Unhide" : "Hidden"}
            onClick={onHide}
            active={hidden}
          />
          <ToolbarButton icon={Trash2} label="Delete" onClick={onDelete} danger disabled={!canDelete} />
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <PreviewBody file={file} variant="pane" />
      </div>
    </div>
  );
}
