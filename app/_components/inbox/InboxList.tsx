"use client";

import { useFileTags } from "../tags/TagsProvider";
import { TagPills } from "../tags/TagDisplay";
import { getFileType } from "@/lib/types/file-types";
import { humanFileSize, type DriveFile } from "@/lib/drive/drive";
import { Star } from "lucide-react";

function formatRelative(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const now = Date.now();
  const diff = now - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.max(1, Math.round(diff / minute))}m`;
  if (diff < day) return `${Math.max(1, Math.round(diff / hour))}h`;
  if (diff < 2 * day) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function InboxList({
  files,
  selectedId,
  onSelect,
}: {
  files: DriveFile[];
  selectedId: string | null;
  onSelect: (file: DriveFile) => void;
}) {
  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800" role="listbox" aria-label="Inbox">
      {files.map((file) => (
        <InboxListRow
          key={file.id}
          file={file}
          selected={file.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}

function InboxListRow({
  file, selected, onSelect,
}: {
  file: DriveFile;
  selected: boolean;
  onSelect: (file: DriveFile) => void;
}) {
  const tags = useFileTags(file.id);
  const type = getFileType(file.mimeType);
  const Icon = type.icon;

  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={() => onSelect(file)}
        className={`w-full text-left px-3 py-2.5 flex gap-3 transition-colors ${
          selected
            ? "bg-blue-50 dark:bg-blue-950/40"
            : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
        }`}
      >
        <div className={`w-9 h-9 rounded-lg ${type.rowBg} flex items-center justify-center shrink-0 mt-0.5`}>
          <Icon className={`w-4 h-4 ${type.rowTint}`} strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {file.starred && (
              <Star className="w-3 h-3 text-amber-500 shrink-0" fill="currentColor" />
            )}
            <p className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100 truncate">
              {file.name || "Untitled"}
            </p>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="truncate">{type.label}</span>
            <span className="shrink-0">·</span>
            <span className="shrink-0">{file.size ? humanFileSize(file.size) : "—"}</span>
            <span className="shrink-0">·</span>
            <span className="shrink-0">{formatRelative(file.modifiedTime)}</span>
          </div>
          <TagPills tags={tags} max={2} className="mt-1" />
        </div>
      </button>
    </li>
  );
}
