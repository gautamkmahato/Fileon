"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Download, ExternalLink, Eye, Link2, Loader2 } from "lucide-react";
import { buildDriveDownloadUrl, buildShareUrl } from "@/lib/drive/drive-extras";
import {
  fetchPublicShareLink,
  getShareLinkByToken,
  postShareHit,
  recordShareHit,
  toPublicShareLink,
  type PublicShareLink,
} from "@/lib/shares";
import { StatusPill } from "@/app/_components/shares/StatusPill";
import { APP_NAME } from "@/lib/brand";

const VIEWED_KEY = "share-link-viewed:";

export function PublicShareGate({ token }: { token: string }) {
  const [link, setLink] = useState<PublicShareLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setMissing(false);
      try {
        const fromApi = await fetchPublicShareLink(token);
        if (cancelled) return;
        if (fromApi) {
          setLink(fromApi);
          if (fromApi.status === "active") void recordView(token, fromApi, cancelled, setLink);
          return;
        }
        const local = await getShareLinkByToken(token);
        if (cancelled) return;
        if (local) {
          const pub = toPublicShareLink(local);
          setLink(pub);
          if (pub.status === "active") void recordView(token, pub, cancelled, setLink);
          return;
        }
        setMissing(true);
      } catch {
        if (!cancelled) setMissing(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <Shell>
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400 mx-auto" />
      </Shell>
    );
  }

  if (missing || !link) {
    return (
      <Shell>
        <Link2 className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
        <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Link not found</h1>
        <p className="text-sm text-zinc-500 mt-2">
          This {APP_NAME} share link is invalid, or it was created on another device and hasn&apos;t synced yet.
        </p>
      </Shell>
    );
  }

  const blocked = link.status !== "active";
  const allowDownload = link.allowDownload;
  const driveUrl = buildShareUrl(link.fileId, link.mimeType);
  const downloadUrl = buildDriveDownloadUrl(link.fileId, link.mimeType);

  async function handleDownload() {
    if (!allowDownload || blocked) return;
    const counts = await postShareHit(token, "download");
    await recordShareHit(token, "download").catch(() => null);
    if (counts) setLink((prev) => prev ? { ...prev, ...counts } : prev);
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <Shell>
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400 mb-3">Shared file</p>
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 break-words">{link.fileName}</h1>
      <div className="mt-3">
        <StatusPill status={link.status} />
      </div>
      {blocked ? (
        <p className="text-sm text-zinc-500 mt-4">
          {link.status === "revoked" ? "This link has been revoked." : "This link has expired."}
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg btn-primary text-sm font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              Open in Drive
            </a>
            {allowDownload && (
              <button
                type="button"
                onClick={() => void handleDownload()}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            )}
          </div>
          <p className="mt-4 text-xs text-zinc-400 flex items-center gap-3">
            <span className="inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {link.viewCount} views</span>
            <span className="inline-flex items-center gap-1"><Download className="w-3.5 h-3.5" /> {link.downloadCount} downloads</span>
          </p>
          <p className="mt-3 text-[11px] text-zinc-400">
            Recipients need permission on the Google Drive file itself. This page only tracks the {APP_NAME} link.
          </p>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm text-center">
        {children}
      </div>
    </div>
  );
}

async function recordView(
  token: string,
  current: PublicShareLink,
  cancelled: boolean,
  setLink: Dispatch<SetStateAction<PublicShareLink | null>>,
) {
  try {
    const key = VIEWED_KEY + token;
    const already = typeof sessionStorage !== "undefined" && sessionStorage.getItem(key);
    if (!already) {
      const counts = await postShareHit(token, "view");
      await recordShareHit(token, "view").catch(() => null);
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem(key, "1");
      if (!cancelled && counts) {
        setLink({ ...current, ...counts, status: "active" });
      }
    }
  } catch {
    /* still show the file */
  }
}
