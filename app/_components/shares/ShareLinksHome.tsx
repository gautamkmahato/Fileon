"use client";

import { useMemo, useState } from "react";
import {
  Check, Copy, Download, Eye, Link2, MoreHorizontal, Trash2,
} from "lucide-react";
import {
  effectiveStatus,
  formatCount,
  formatExpiry,
  shareAppUrl,
  EXPIRY_PRESETS,
  expiryFromPreset,
  type ExpiryPresetId,
  type ShareLinkEffectiveStatus,
  type ShareLink,
} from "@/lib/shares";
import { ConfirmModal } from "../ui/Dialogs";
import { toast } from "@/lib/toast";
import { logActivity } from "@/lib/activity-log";
import { APP_NAME } from "@/lib/brand";
import { useShareLinks } from "./ShareLinksProvider";
import { StatusPill } from "./StatusPill";

const FILTERS: Array<{ id: "all" | ShareLinkEffectiveStatus; label: string }> = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "expired", label: "Expired" },
  { id: "revoked", label: "Revoked" },
];

export function ShareLinksHome() {
  const { links, loading, revokeLink, removeLink, updateExpiry } = useShareLinks();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ShareLink | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ShareLink | null>(null);

  const grouped = useMemo(() => {
    return links.filter((link) => {
      if (filter === "all") return true;
      return effectiveStatus(link) === filter;
    });
  }, [links, filter]);

  async function handleCopy(link: ShareLink) {
    try {
      await navigator.clipboard.writeText(shareAppUrl(link.token));
      setCopiedId(link.id);
      toast.info("Link copied");
      setTimeout(() => setCopiedId((id) => (id === link.id ? null : id)), 2000);
    } catch {
      toast.error("Couldn't copy that link");
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Shared links</h1>
        <p className="text-sm text-zinc-500 mt-1 max-w-xl">
          {APP_NAME}-managed links with views, downloads, and expiry. Google Drive&apos;s own share links are unchanged.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium ${
              filter === f.id
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && links.length === 0 && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && links.length === 0 && (
        <div className="text-center py-20 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 mb-4">
            <Link2 className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No share links yet</p>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            Open a file&apos;s Share menu and create a {APP_NAME} link. Drive&apos;s &quot;anyone with the link&quot; toggle stays as it is.
          </p>
        </div>
      )}

      {!loading && links.length > 0 && grouped.length === 0 && (
        <p className="text-sm text-zinc-500 py-10 text-center">Nothing in this filter.</p>
      )}

      <div className="space-y-3">
        {grouped.map((link) => (
          <ShareLinkCard
            key={link.id}
            link={link}
            copied={copiedId === link.id}
            onCopy={() => void handleCopy(link)}
            onRevoke={() => setRevokeTarget(link)}
            onDelete={() => setDeleteTarget(link)}
            onExpiry={async (preset) => {
              try {
                await updateExpiry(link.id, expiryFromPreset(preset));
                toast.success("Expiry updated");
              } catch {
                toast.error("Couldn't update expiry");
              }
            }}
          />
        ))}
      </div>

      <ConfirmModal
        open={revokeTarget !== null}
        title="Revoke link?"
        message={
          revokeTarget
            ? `People with this ${APP_NAME} link will no longer get through. Drive sharing for "${revokeTarget.fileName}" is not changed.`
            : ""
        }
        confirmLabel="Revoke"
        confirmVariant="danger"
        onClose={() => setRevokeTarget(null)}
        onConfirm={async () => {
          if (!revokeTarget) return;
          try {
            await revokeLink(revokeTarget.id);
            await logActivity({
              type: "share-link-revoke",
              description: `Revoked ${APP_NAME} share link for ${revokeTarget.fileName}`,
              fileIds: [revokeTarget.fileId],
              fileNames: [revokeTarget.fileName],
            });
            toast.success("Link revoked");
          } catch {
            toast.error("Couldn't revoke that link");
          }
          setRevokeTarget(null);
        }}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        title="Delete link record?"
        message={
          deleteTarget
            ? `Removes "${deleteTarget.fileName}" from this list and its view stats. Drive sharing is not changed.`
            : ""
        }
        confirmLabel="Delete"
        confirmVariant="danger"
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await removeLink(deleteTarget.id);
            toast.success("Removed from Shared links");
          } catch {
            toast.error("Couldn't delete that record");
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

function ShareLinkCard({
  link, copied, onCopy, onRevoke, onDelete, onExpiry,
}: {
  link: ShareLink;
  copied: boolean;
  onCopy: () => void;
  onRevoke: () => void;
  onDelete: () => void;
  onExpiry: (preset: ExpiryPresetId) => void;
}) {
  const status = effectiveStatus(link);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <article className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm dark:shadow-none">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
          {link.fileName}
        </h2>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="w-8 h-8 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center"
            aria-label="Link actions"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && (
            <>
              <button type="button" className="fixed inset-0 z-10" aria-label="Close" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-9 z-20 w-44 py-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg">
                <button
                  type="button"
                  className="w-full px-3 py-1.5 text-left text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  onClick={() => { setMenuOpen(false); onCopy(); }}
                >
                  Copy {APP_NAME} link
                </button>
                {status === "active" && (
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    onClick={() => { setMenuOpen(false); onRevoke(); }}
                  >
                    Revoke
                  </button>
                )}
                <button
                  type="button"
                  className="w-full px-3 py-1.5 text-left text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 inline-flex items-center gap-2"
                  onClick={() => { setMenuOpen(false); onDelete(); }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete record
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="mt-3 border-t border-zinc-100 dark:border-zinc-800" />
      <div className="mt-3 space-y-1.5 text-sm text-zinc-600 dark:text-zinc-300">
        <p className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-zinc-400" />
          {formatCount(link.viewCount)} {link.viewCount === 1 ? "view" : "views"}
        </p>
        <p className="flex items-center gap-2">
          <Download className="w-4 h-4 text-zinc-400" />
          {formatCount(link.downloadCount)} {link.downloadCount === 1 ? "download" : "downloads"}
        </p>
        <p>Expires: {formatExpiry(link.expiresAt)}</p>
        <p className="flex items-center gap-2">
          Status: <StatusPill status={status} />
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
        {status === "active" && (
          <select
            value=""
            onChange={(e) => {
              const v = e.target.value as ExpiryPresetId;
              if (v) onExpiry(v);
              e.target.value = "";
            }}
            className="h-8 px-2 rounded-lg text-xs border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300"
          >
            <option value="" disabled>Change expiry</option>
            {EXPIRY_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        )}
        <p className="text-[11px] text-zinc-400 ml-auto">
          Google Drive share is separate
        </p>
      </div>
    </article>
  );
}
