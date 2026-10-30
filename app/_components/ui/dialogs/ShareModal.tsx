"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Eye, Globe, Link as LinkIcon, Loader2, Lock } from "lucide-react";
import { Modal } from "../Modal";
import {
  buildShareUrl,
  disableLinkShare,
  enableLinkShare,
  findLinkPermission,
} from "@/lib/drive/drive-extras";
import { useAuth } from "../../auth/AuthProvider";
import { toast, runAsync } from "@/lib/ui/toast";
import { logActivity } from "@/lib/activity/log";
import { AppSharePanel } from "../../shares/AppSharePanel";

/**
 * Share dialog. Top half controls Google Drive's native "anyone with the link"
 * (view-only) permission; the bottom half hosts the app-managed share links.
 */
export function ShareModal({
  open, fileId, fileName, fileMime, onClose, onSharingChanged,
}: {
  open: boolean;
  fileId: string | null;
  fileName: string;
  fileMime: string;
  onClose: () => void;
  onSharingChanged?: () => void;
}) {
  const { token } = useAuth();
  const [linkEnabled, setLinkEnabled] = useState(false);
  const [permissionId, setPermissionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [copied, setCopied] = useState(false);

  // Check current share status on open
  useEffect(() => {
    if (!open || !fileId || !token) return;
    let cancelled = false;
    setLoading(true);
    setCopied(false);
    findLinkPermission(token, fileId)
      .then((p) => {
        if (cancelled) return;
        setLinkEnabled(!!p);
        setPermissionId(p?.id || null);
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, fileId, token]);

  const shareUrl = fileId ? buildShareUrl(fileId, fileMime) : "";

  async function handleToggle() {
    if (!fileId || !token) return;
    setToggling(true);
    await runAsync({
      loading: linkEnabled ? "Disabling link sharing…" : "Enabling link sharing…",
      success: linkEnabled ? "Link sharing disabled" : "Link sharing enabled",
      error: "Failed to update sharing",
      fn: async () => {
        if (linkEnabled && permissionId) {
          await disableLinkShare(token, fileId, permissionId);
          setLinkEnabled(false);
          setPermissionId(null);
          await logActivity({
            type: "share-disable",
            description: `Disabled link sharing for ${fileName}`,
            fileIds: [fileId],
            fileNames: [fileName],
          });
          onSharingChanged?.();
        } else {
          const created = await enableLinkShare(token, fileId);
          setLinkEnabled(true);
          setPermissionId(created.id);
          await logActivity({
            type: "share-enable",
            description: `Enabled link sharing for ${fileName}`,
            fileIds: [fileId],
            fileNames: [fileName],
          });
          onSharingChanged?.();
        }
      },
    });
    setToggling(false);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.info("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
      toast.error("Failed to copy link");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Share "${fileName}"`} width="max-w-lg">
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
        </div>
      ) : (
        <>
          {/* Access toggle */}
          <div className="flex items-start gap-3 p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 mb-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              linkEnabled ? "bg-emerald-100 text-emerald-600" : "bg-zinc-200 text-zinc-500"
            }`}>
              {linkEnabled ? <Globe className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-900">
                {linkEnabled ? "Anyone with the link" : "Restricted"}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1">
                {linkEnabled ? (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    Anyone with the link can view (read-only)
                  </>
                ) : (
                  "Only people you add can open"
                )}
              </p>
            </div>
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                linkEnabled
                  ? "bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                  : "bg-zinc-900 text-white hover:bg-zinc-700"
              }`}
            >
              {toggling
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : linkEnabled ? "Disable" : "Enable link"}
            </button>
          </div>

          {/* Share link */}
          {linkEnabled && (
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1.5">Share link</label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 h-10 px-3 rounded-lg bg-zinc-50 border border-zinc-200 text-sm text-zinc-700 min-w-0">
                  <LinkIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate font-mono text-xs">{shareUrl}</span>
                </div>
                <button
                  onClick={handleCopy}
                  className={`shrink-0 h-10 px-3.5 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 transition-colors ${
                    copied
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-zinc-900 text-white hover:bg-zinc-700"
                  }`}
                >
                  {copied ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy</>}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 mt-2 flex items-center gap-1">
                <Eye className="w-3 h-3" />
                Recipients can only view — they cannot edit or comment.
              </p>
            </div>
          )}

          {!linkEnabled && (
            <p className="text-xs text-zinc-500 text-center py-2">
              Enable the link to share this file with others.
            </p>
          )}

          {fileId && (
            <AppSharePanel
              fileId={fileId}
              fileName={fileName}
              fileMime={fileMime}
              driveLinkEnabled={linkEnabled}
              onDriveShareChanged={() => {
                if (!fileId || !token) return;
                void findLinkPermission(token, fileId).then((p) => {
                  setLinkEnabled(!!p);
                  setPermissionId(p?.id || null);
                  onSharingChanged?.();
                });
              }}
            />
          )}
        </>
      )}
    </Modal>
  );
}
