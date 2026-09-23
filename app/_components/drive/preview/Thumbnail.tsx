"use client";

import { memo, useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { getCachedBlob, setCachedBlob } from "@/lib/cache/thumbnail-cache";
import { runThumbnailTask } from "@/lib/cache/thumbnail-queue";
import {
  generatePdfThumbnailBlob,
  isPdfMime,
  needsPdfScreenshot,
} from "@/lib/preview/pdf-thumbnail";
import {
  generateTextThumbnailBlob,
  shouldGenerateTextThumbnail,
} from "@/lib/preview/text-thumbnail";

interface ThumbnailProps {
  fileId?: string;
  mimeType?: string;
  fileName?: string;
  thumbnailLink?: string;
  modifiedTime?: string;
  iconLink?: string;
  alt: string;
  className?: string;
  size?: number;
  /** grid = fast path (thumbnails only); full = rich Google Doc/Sheet previews */
  mode?: "grid" | "full";
  /** When true, defer loading until near viewport */
  lazy?: boolean;
  onLoaded?: () => void;
  onFailed?: () => void;
}

const GOOGLE_DOC = "application/vnd.google-apps.document";
const GOOGLE_SHEET = "application/vnd.google-apps.spreadsheet";
const GOOGLE_SLIDES = "application/vnd.google-apps.presentation";
const GOOGLE_DRAWING = "application/vnd.google-apps.drawing";
const GOOGLE_FORM = "application/vnd.google-apps.form";

function upgradeThumbnailUrl(link: string, size: number): string {
  if (/=s\d+/.test(link)) return link.replace(/=s\d+/, `=s${size}`);
  if (/=w\d+-h\d+/.test(link)) return link.replace(/=w\d+-h\d+/, `=w${size}-h${Math.round(size * 0.75)}`);
  return `${link}=s${size}`;
}

async function blobLooksLikeImage(blob: Blob): Promise<boolean> {
  if (blob.type.startsWith("image/")) return true;
  if (blob.size < 12) return false;
  const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  if (header[0] === 0x89 && header[1] === 0x50) return true;
  if (header[0] === 0xff && header[1] === 0xd8) return true;
  if (header[0] === 0x47 && header[1] === 0x49) return true;
  if (header[0] === 0x52 && header[1] === 0x49 && header[8] === 0x57) return true;
  return false;
}

function parseCsvPreview(text: string, maxRows: number, maxCols: number): string[][] {
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/).slice(0, maxRows)) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let cell = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === "," && !inQuotes) {
        cells.push(cell.trim());
        cell = "";
        continue;
      }
      cell += ch;
    }
    cells.push(cell.trim());
    rows.push(cells.slice(0, maxCols));
  }
  return rows;
}

export const Thumbnail = memo(function Thumbnail({
  fileId, mimeType, fileName, thumbnailLink, modifiedTime,
  alt, className, size = 600, mode = "full", lazy = false,
  onLoaded, onFailed,
}: ThumbnailProps) {
  const { token } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(!lazy);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [docPreviewHtml, setDocPreviewHtml] = useState<string | null>(null);
  const [sheetRows, setSheetRows] = useState<string[][] | null>(null);
  const onLoadedRef = useRef(onLoaded);
  const onFailedRef = useRef(onFailed);

  useEffect(() => { onLoadedRef.current = onLoaded; }, [onLoaded]);
  useEffect(() => { onFailedRef.current = onFailed; }, [onFailed]);

  useEffect(() => {
    if (!lazy || inView) return;
    const el = rootRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { rootMargin: "240px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [lazy, inView]);

  useEffect(() => {
    if (!token || !inView) return;
    let cancelled = false;
    let createdUrl: string | null = null;
    setBlobUrl(null);
    setDocPreviewHtml(null);
    setSheetRows(null);

    const loaded = () => { if (!cancelled) onLoadedRef.current?.(); };
    const failed = () => { if (!cancelled) onFailedRef.current?.(); };

    async function exportText(mime: string): Promise<string | null> {
      if (!fileId) return null;
      try {
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(mime)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return null;
        return res.text();
      } catch {
        return null;
      }
    }

    async function load() {
      await runThumbnailTask(async () => {
      // 1. Cache
      if (fileId) {
        const cached = await getCachedBlob(fileId, modifiedTime);
        if (cached && !cancelled) {
          createdUrl = URL.createObjectURL(cached);
          setBlobUrl(createdUrl);
          loaded();
          return;
        }
      }

      const storeBlob = (blob: Blob) => {
        if (cancelled) return;
        if (fileId) setCachedBlob(fileId, modifiedTime, blob);
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
        loaded();
      };

      // PDF + Google Docs: render page 1 via pdfjs (grid cards; PDFs in any mode)
      if (
        fileId &&
        mimeType &&
        token &&
        needsPdfScreenshot(mimeType, fileName) &&
        (mode === "grid" || isPdfMime(mimeType, fileName))
      ) {
        try {
          const pngBlob = await generatePdfThumbnailBlob({
            token,
            fileId,
            mimeType,
            fileName,
            renderWidth: Math.min(Math.max(size, 320), 640),
          });
          if (!cancelled) {
            storeBlob(pngBlob);
            return;
          }
        } catch (err) {
          console.warn("[thumbnail] PDF page screenshot failed:", err);
        }
      }

      // CSV + Markdown: render HTML offscreen → PNG snapshot (grid cards)
      if (fileId && mimeType && token && shouldGenerateTextThumbnail(mimeType, fileName, mode)) {
        try {
          const renderWidth = Math.min(Math.max(size, 320), 640);
          const pngBlob = await generateTextThumbnailBlob({
            token,
            fileId,
            mimeType,
            fileName,
            renderWidth,
            renderHeight: Math.round(renderWidth * 0.75),
          });
          if (!cancelled) {
            storeBlob(pngBlob);
            return;
          }
        } catch (err) {
          console.warn("[thumbnail] Text screenshot failed:", err);
        }
      }

      const tryImageUrl = async (url: string, requireAuth = true): Promise<boolean> => {
        try {
          const headers: HeadersInit = requireAuth ? { Authorization: `Bearer ${token}` } : {};
          const res = await fetch(url, { headers });
          if (!res.ok) return false;
          const blob = await res.blob();
          if (blob.size < 50 || !(await blobLooksLikeImage(blob))) return false;
          storeBlob(blob);
          return true;
        } catch {
          return false;
        }
      };

      const tryDriveThumbnail = async (): Promise<boolean> => {
        if (!fileId) return false;
        const urls = [
          `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`,
          `https://drive.google.com/thumbnail?id=${fileId}&sz=s${size}`,
        ];
        for (const url of urls) {
          if (await tryImageUrl(url)) return true;
        }
        return false;
      };

      if (fileId && mimeType) {
        const gridOnly = mode === "grid";

        // 2. Content-aware previews for Google native files (full mode only)
        if (!gridOnly && mimeType === GOOGLE_DOC) {
          const html = await exportText("text/html");
          if (!cancelled && html) {
            setDocPreviewHtml(html);
            loaded();
            return;
          }
        }

        if (!gridOnly && mimeType === GOOGLE_SHEET) {
          const html = await exportText("text/html");
          const rows = html ? extractSheetRows(html, 6, 7) : null;
          if (!cancelled && rows && rows.some((r) => r.some(Boolean))) {
            setSheetRows(rows);
            loaded();
            return;
          }
          const csv = await exportText("text/csv");
          const csvRows = csv ? parseCsvPreview(csv, 6, 7) : null;
          if (!cancelled && csvRows && csvRows.some((r) => r.some(Boolean))) {
            setSheetRows(csvRows);
            loaded();
            return;
          }
        }

        if (mimeType === GOOGLE_SLIDES || mimeType === GOOGLE_DRAWING) {
          if (await tryImageUrl(
            `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=image/png`
          )) return;
        }

        if (mimeType === GOOGLE_FORM) {
          if (await tryDriveThumbnail()) return;
        }

        // 3. thumbnailLink
        if (thumbnailLink) {
          if (await tryImageUrl(upgradeThumbnailUrl(thumbnailLink, size))) return;
        }

        // 4. Drive thumbnail endpoint
        if (await tryDriveThumbnail()) return;

        // 5. Direct image download
        if (mimeType.startsWith("image/")) {
          if (await tryImageUrl(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`)) return;
        }

        // 6. Slides/drawing PNG (retry if not caught above)
        if (mimeType === GOOGLE_SLIDES || mimeType === GOOGLE_DRAWING) {
          if (await tryImageUrl(
            `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=image/png`
          )) return;
        }
      }

      failed();
      });
    }

    load();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [fileId, mimeType, fileName, thumbnailLink, modifiedTime, token, size, mode, inView]);

  if (!inView) {
    return <div ref={rootRef} className={className} aria-hidden="true" />;
  }

  if (blobUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={blobUrl} alt={alt} className={className} />;
  }

  if (docPreviewHtml) {
    return <DocTextPreview html={docPreviewHtml} className={className} />;
  }

  if (sheetRows) {
    return <SheetPreview rows={sheetRows} className={className} />;
  }

  return <div ref={rootRef} className={className} aria-hidden="true" />;
});

function DocTextPreview({ html, className }: { html: string; className?: string }) {
  const text = extractTextChunks(html, 250);
  return (
    <div className={`bg-white ${className || ""}`} style={{ position: "relative" }}>
      <div className="absolute inset-0 px-4 py-3 overflow-hidden">
        {text.heading && (
          <div className="text-[10px] font-bold text-zinc-900 mb-1 line-clamp-2 leading-tight">
            {text.heading}
          </div>
        )}
        <div className="text-[7px] leading-[1.4] text-zinc-700 space-y-0.5">
          {text.paragraphs.slice(0, 8).map((p, i) => (
            <p key={i} className="line-clamp-2">{p}</p>
          ))}
        </div>
      </div>
      <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.04)" }} />
    </div>
  );
}

function SheetPreview({ rows, className }: { rows: string[][]; className?: string }) {
  return (
    <div className={`bg-white ${className || ""}`} style={{ position: "relative" }}>
      <div className="absolute inset-0 p-1.5 overflow-hidden">
        <table className="w-full border-collapse text-[6px] leading-tight text-zinc-700">
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={ri === 0 ? "bg-emerald-50/80 font-semibold" : ""}>
                {row.map((cell, ci) => (
                  <td key={ci} className="border border-zinc-200 px-0.5 py-0.5 truncate max-w-[36px]">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.04)" }} />
    </div>
  );
}

function extractTextChunks(html: string, maxParagraphs: number): {
  heading: string | null;
  paragraphs: string[];
} {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const firstHeading = doc.querySelector("h1, h2, h3");
    const heading = firstHeading?.textContent?.trim() || null;
    const paragraphs: string[] = [];
    for (const node of Array.from(doc.querySelectorAll("p, li")).slice(0, maxParagraphs)) {
      const text = node.textContent?.trim();
      if (text && text.length > 0 && text !== heading) paragraphs.push(text);
    }
    return { heading, paragraphs };
  } catch {
    return { heading: null, paragraphs: [] };
  }
}

function extractSheetRows(html: string, maxRows: number, maxCols: number): string[][] {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const rows: string[][] = [];

    const trs = doc.querySelectorAll("table tr");
    for (const tr of Array.from(trs).slice(0, maxRows)) {
      const cells = Array.from(tr.querySelectorAll("td, th"))
        .slice(0, maxCols)
        .map((c) => c.textContent?.trim() || "");
      if (cells.some(Boolean)) rows.push(cells);
    }
    if (rows.length) return rows;

    // Some sheet exports use div grids instead of tables
    const gridCells = doc.querySelectorAll(".s, .softmerge-inner, td");
    if (gridCells.length) {
      const texts = Array.from(gridCells)
        .map((c) => c.textContent?.trim() || "")
        .filter(Boolean)
        .slice(0, maxRows * maxCols);
      for (let i = 0; i < texts.length; i += maxCols) {
        rows.push(texts.slice(i, i + maxCols));
      }
    }
    return rows;
  } catch {
    return [];
  }
}
