"use client";

import { useEffect, useState } from "react";
import {
  Download,
  ExternalLink,
  Loader2,
  Pencil,
  Star,
  Tag,
  Trash2,
  User,
  X,
} from "lucide-react";
import {
  type DriveFile,
  downloadFile,
  exportFile,
  humanFileSize,
  isGoogleNative,
  renameFile,
  restoreFile,
  setStarred,
  trashFile,
} from "@/lib/drive/drive";
import { useAuth } from "../../auth/AuthProvider";
import { PreviewBody } from "./PreviewBody";
import { getFileType } from "@/lib/types/file-types";
import { toast, runAsync } from "@/lib/toast";
import { logActivity, prepareActivityUndo } from "@/lib/activity-log";
import { recordRecentFolderWork } from "@/lib/recent-folders";
import { pushUndo } from "@/lib/undo";
import { TagPills } from "../../tags/TagDisplay";

interface FilePreviewProps {
  file: DriveFile | null;
  onClose: () => void;
  onFileChanged: (file: DriveFile) => void;
  onFileDeleted: (fileId: string) => void;
  fileTags?: import("@/lib/tags").Tag[];
  onEditTags?: () => void;
}

export function FilePreview({ file, onClose, onFileChanged, onFileDeleted, fileTags = [], onEditTags }: FilePreviewProps) {
  const { token, profile } = useAuth();
  const type = file ? getFileType(file.mimeType) : null;
  const Icon = type?.icon;
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [busy, setBusy] = useState<"none" | "download" | "delete" | "rename" | "star">("none");

  useEffect(() => {
    if (file) setDraftName(file.name);
    setRenaming(false);
  }, [file]);

  useEffect(() => {
    if (!file) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [file, onClose]);

  if (!file || !type || !Icon) return null;

  async function handleDownload() {
    if (!token || !file) return;
    setBusy("download");
    await runAsync({
      loading: `Downloading "${file.name}"…`,
      success: "Download started",
      error: "Download failed",
      fn: async () => {
        let blob: Blob;
        let downloadName = file.name;
        if (isGoogleNative(file)) {
          blob = await exportFile(token, file.id, "application/pdf");
          if (!downloadName.toLowerCase().endsWith(".pdf")) downloadName += ".pdf";
        } else {
          blob = await downloadFile(token, file.id);
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = downloadName;
        a.click();
        URL.revokeObjectURL(url);
        recordRecentFolderWork({ items: [file] });
      },
    });
    setBusy("none");
  }

  async function handleRenameCommit() {
    if (!token || !file) return;
    setRenaming(false);
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === file.name) {
      setDraftName(file.name);
      return;
    }
    setBusy("rename");
    const result = await runAsync({
      loading: "Renaming…",
      success: false,
      error: "Rename failed",
      fn: async () => {
        const updated = await renameFile(token, file.id, trimmed);
        onFileChanged(updated);
        const oldName = file.name;
        const desc = `Renamed ${oldName} → ${trimmed}`;
        const undoFn = async () => {
          const reverted = await renameFile(token, file.id, oldName);
          onFileChanged(reverted);
        };
        const activityId = await prepareActivityUndo({
          type: "rename",
          description: desc,
          fileIds: [file.id],
          fileNames: [trimmed],
          undoData: { type: "rename", fileIds: [file.id], oldNames: [oldName], newNames: [trimmed] },
          undo: undoFn,
        });
        pushUndo({ type: "rename", message: desc, undo: undoFn, activityId: activityId ?? undefined });
        recordRecentFolderWork({ items: [file] });
        return updated;
      },
    });
    if (!result) setDraftName(file.name);
    setBusy("none");
  }

  async function handleToggleStar() {
    if (!token || !file) return;
    setBusy("star");
    const prev = file;
    onFileChanged({ ...file, starred: !file.starred });
    try {
      const updated = await setStarred(token, file.id, !file.starred);
      onFileChanged(updated);
      recordRecentFolderWork({ items: [updated] });
    } catch (err) {
      console.error(err);
      onFileChanged(prev);
      toast.error("Failed to update star");
    } finally {
      setBusy("none");
    }
  }

  async function handleDelete() {
    if (!token || !file) return;
    setBusy("delete");
    const fileSnapshot = file;
    const successMsg = `Moved "${file.name}" to trash`;
    await runAsync({
      loading: `Moving "${file.name}" to trash…`,
      success: false,
      error: "Delete failed",
      fn: async () => {
        await trashFile(token, file.id);
        onFileDeleted(file.id);
        onClose();
        const undoFn = async () => {
          const restored = await restoreFile(token, fileSnapshot.id);
          onFileChanged(restored);
        };
        const activityId = await prepareActivityUndo({
          type: "trash",
          description: successMsg,
          fileIds: [fileSnapshot.id],
          fileNames: [fileSnapshot.name],
          undoData: { type: "trash", fileIds: [fileSnapshot.id] },
          undo: undoFn,
        });
        pushUndo({ type: "trash", message: successMsg, undo: undoFn, activityId: activityId ?? undefined });
        recordRecentFolderWork({ items: [fileSnapshot] });
      },
    });
    setBusy("none");
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 animate-in fade-in duration-150"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-200 flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg ${type.bg} flex items-center justify-center shrink-0`}>
            <Icon className={`w-5 h-5 ${type.tint}`} strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            {renaming ? (
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={handleRenameCommit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") { setDraftName(file.name); setRenaming(false); }
                }}
                className="w-full text-base font-semibold border border-blue-400 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-100"
              />
            ) : (
              <button
                onClick={() => setRenaming(true)}
                className="text-base font-semibold text-zinc-900 hover:bg-zinc-50 rounded px-2 -mx-2 py-0.5 text-left group/title flex items-center gap-2"
              >
                <span className="truncate">{file.name}</span>
                <Pencil className="w-3.5 h-3.5 opacity-0 group-hover/title:opacity-50 shrink-0" />
              </button>
            )}
            <p className="text-xs text-zinc-500 mt-1">{type.label} · {humanFileSize(file.size)}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center text-zinc-500"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action bar */}
        <div className="px-5 py-3 border-b border-zinc-200 flex items-center gap-2 flex-wrap">
          <ActionButton onClick={handleDownload} icon={Download} label="Download" busy={busy === "download"} />
          {file.webViewLink && (
            <a
              href={file.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in Drive
            </a>
          )}
          <ActionButton
            onClick={handleToggleStar}
            icon={Star}
            label={file.starred ? "Unstar" : "Star"}
            busy={busy === "star"}
            iconFilled={file.starred}
            iconClassName={file.starred ? "text-amber-500" : ""}
          />
          {onEditTags && (
            <ActionButton onClick={onEditTags} icon={Tag} label="Tags" />
          )}
          <div className="flex-1" />
          <ActionButton onClick={handleDelete} icon={Trash2} label="Trash" busy={busy === "delete"} danger />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <PreviewBody file={file} userEmail={profile?.email} variant="drawer" />

          {/* Metadata */}
          <dl className="px-5 py-4 grid grid-cols-[120px_1fr] gap-x-4 gap-y-3 text-sm">
            <dt className="text-zinc-500">Type</dt>
            <dd className="text-zinc-900">{type.label}</dd>

            {file.modifiedTime && (
              <>
                <dt className="text-zinc-500">Modified</dt>
                <dd className="text-zinc-900">{formatFull(file.modifiedTime)}</dd>
              </>
            )}
            {file.createdTime && (
              <>
                <dt className="text-zinc-500">Created</dt>
                <dd className="text-zinc-900">{formatFull(file.createdTime)}</dd>
              </>
            )}
            {file.size && (
              <>
                <dt className="text-zinc-500">Size</dt>
                <dd className="text-zinc-900 font-mono">{humanFileSize(file.size)}</dd>
              </>
            )}
            {file.owners && file.owners.length > 0 && (
              <>
                <dt className="text-zinc-500">Owner</dt>
                <dd className="text-zinc-900 flex items-center gap-2">
                  {file.owners[0].photoLink ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={file.owners[0].photoLink} alt="" className="w-5 h-5 rounded-full" />
                  ) : (
                    <User className="w-4 h-4 text-zinc-400" />
                  )}
                  <span>{file.owners[0].displayName}</span>
                  <span className="text-zinc-500 text-xs">({file.owners[0].emailAddress})</span>
                </dd>
              </>
            )}
            <dt className="text-zinc-500">Tags</dt>
            <dd>
              {fileTags.length > 0 ? (
                <TagPills tags={fileTags} max={8} />
              ) : (
                <span className="text-zinc-400 text-sm">None</span>
              )}
              {onEditTags && (
                <button
                  onClick={onEditTags}
                  className="mt-2 text-xs font-medium text-blue-600 hover:underline"
                >
                  {fileTags.length > 0 ? "Edit tags" : "Add tags"}
                </button>
              )}
            </dd>
            <dt className="text-zinc-500">ID</dt>
            <dd className="text-zinc-500 font-mono text-xs break-all">{file.id}</dd>
          </dl>
        </div>
      </div>
    </>
  );
}

function ActionButton({
  onClick,
  icon: Icon,
  label,
  busy,
  danger,
  iconFilled,
  iconClassName,
}: {
  onClick: () => void;
  icon: typeof Download;
  label: string;
  busy?: boolean;
  danger?: boolean;
  iconFilled?: boolean;
  iconClassName?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border disabled:opacity-50 ${
        danger
          ? "border-red-200 text-red-700 hover:bg-red-50"
          : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
      }`}
    >
      {busy ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Icon className={`w-3.5 h-3.5 ${iconClassName || ""}`} fill={iconFilled ? "currentColor" : "none"} />
      )}
      {label}
    </button>
  );
}

function formatFull(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}