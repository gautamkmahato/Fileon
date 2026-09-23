"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, Loader2, Plus } from "lucide-react";
import { APP_NAME } from "@/lib/brand";
import { driveRoutes } from "@/lib/navigation";
import {
  EXPIRY_PRESETS,
  effectiveStatus,
  expiryFromPreset,
  formatCount,
  formatExpiry,
  shareAppUrl,
  type ExpiryPresetId,
} from "@/lib/shares";
import { enableLinkShare, findLinkPermission } from "@/lib/drive/drive-extras";
import { useAuth } from "../auth/AuthProvider";
import { toast } from "@/lib/toast";
import { logActivity } from "@/lib/activity-log";
import { useShareLinks } from "./ShareLinksProvider";
import { StatusPill } from "./StatusPill";

export function AppSharePanel({
  fileId, fileName, fileMime, driveLinkEnabled, onDriveShareChanged,
}: {
  fileId: string;
  fileName: string;
  fileMime: string;
  driveLinkEnabled: boolean;
  onDriveShareChanged?: () => void;
}) {
  const { token } = useAuth();
  const { linksForFile, createLink } = useShareLinks();
  const links = linksForFile(fileId);
  const [preset, setPreset] = useState<ExpiryPresetId>("30d");
  const [allowDownload, setAllowDownload] = useState(true);
  const [enableDrive, setEnableDrive] = useState(!driveLinkEnabled);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setEnableDrive(!driveLinkEnabled);
  }, [driveLinkEnabled]);

  async function handleCreate() {
    setBusy(true);
    try {
      const created = await createLink({
        fileId,
        fileName,
        mimeType: fileMime,
        expiresAt: expiryFromPreset(preset),
        allowDownload,
      });
      if (enableDrive && token && !driveLinkEnabled) {
        try {
          const existing = await findLinkPermission(token, fileId);
          if (!existing) await enableLinkShare(token, fileId);
          onDriveShareChanged?.();
        } catch (err) {
          console.error(err);
          toast.info(`${APP_NAME} link created. Enable Google Drive link sharing above so outsiders can open the file.`);
        }
      }
      await logActivity({
        type: "share-link-create",
        description: `Created a ${APP_NAME} share link for ${fileName}`,
        fileIds: [fileId],
        fileNames: [fileName],
      });
      await navigator.clipboard.writeText(shareAppUrl(created.token)).catch(() => undefined);
      setCopiedId(created.id);
      toast.success(`${APP_NAME} link created and copied`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create that link");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy(tokenValue: string, id: string) {
    try {
      await navigator.clipboard.writeText(shareAppUrl(tokenValue));
      setCopiedId(id);
      toast.info(`${APP_NAME} link copied`);
    } catch {
      toast.error("Couldn't copy that link");
    }
  }

  return (
    <div className="mt-5 pt-4 border-t border-zinc-200 dark:border-zinc-700">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{APP_NAME} share link</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Track views, downloads, and expiry. Does not replace Google Drive sharing.
          </p>
        </div>
        <Link href={driveRoutes.sharedLinks} className="text-xs font-medium text-blue-600 hover:underline shrink-0">
          Manage
        </Link>
      </div>

      {links.length > 0 && (
        <ul className="mb-3 space-y-2">
          {links.slice(0, 5).map((link) => (
            <li key={link.id} className="flex items-center gap-2 text-xs">
              <StatusPill status={effectiveStatus(link)} />
              <span className="text-zinc-500 truncate flex-1">
                {formatCount(link.viewCount)} views · {formatCount(link.downloadCount)} downloads · {formatExpiry(link.expiresAt)}
              </span>
              <button
                type="button"
                onClick={() => void handleCopy(link.token, link.id)}
                className="shrink-0 inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900"
              >
                {copiedId === link.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                Copy
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value as ExpiryPresetId)}
          className="h-9 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-200"
        >
          {EXPIRY_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <label className="inline-flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={allowDownload}
            onChange={(e) => setAllowDownload(e.target.checked)}
          />
          Allow download
        </label>
      </div>
      {!driveLinkEnabled && (
        <label className="mt-2 flex items-start gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={enableDrive}
            onChange={(e) => setEnableDrive(e.target.checked)}
          />
          Also enable Google Drive &quot;anyone with the link&quot; so recipients can open the file
        </label>
      )}
      <button
        type="button"
        onClick={() => void handleCreate()}
        disabled={busy}
        className="mt-3 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg btn-primary text-xs font-medium disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        Create {APP_NAME} link
      </button>
    </div>
  );
}
