"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileQuestion, Loader2 } from "lucide-react";
import { type DriveFile, downloadFile } from "@/lib/drive/drive";
import { detectPreviewKind, needsContentFetch, type PreviewKind } from "@/lib/preview/detect-preview-type";
import { Thumbnail } from "./Thumbnail";

export type PreviewVariant = "drawer" | "quicklook" | "pane";

export interface PreviewRenderProps {
  file: DriveFile;
  token: string | null;
  variant: PreviewVariant;
}

type PreviewRenderer = (props: PreviewRenderProps) => React.ReactNode;

/**
 * Map of preview kind → renderer. Add `video`, `pdf`, etc. here when ready.
 * Unknown kinds fall back automatically.
 */
const PREVIEW_RENDERERS: Partial<Record<PreviewKind, PreviewRenderer>> = {
  image: ImagePreview,
};

export function renderFilePreview(file: DriveFile, token: string | null, variant: PreviewVariant) {
  const kind = detectPreviewKind(file);
  const Renderer = PREVIEW_RENDERERS[kind] ?? FallbackPreview;
  return <Renderer file={file} token={token} variant={variant} />;
}

function shellClass(variant: PreviewVariant, extra = "") {
  if (variant === "quicklook") return `flex items-center justify-center w-full ${extra}`;
  if (variant === "pane") return `flex-1 min-h-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 ${extra}`;
  return `bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-center py-8 min-h-[300px] ${extra}`;
}

function ImagePreview({ file, token, variant }: PreviewRenderProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shouldFetch = needsContentFetch("image");

  useEffect(() => {
    if (!shouldFetch || !token || !file.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    let createdUrl: string | null = null;
    setLoading(true);
    setError(null);
    setBlobUrl(null);

    downloadFile(token, file.id)
      .then((blob) => {
        if (cancelled) return;
        if (!blob || blob.size === 0) {
          setError("Empty file");
          return;
        }
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load preview");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [file.id, token, shouldFetch]);

  if (loading) return <PreviewLoading variant={variant} />;
  if (error || !blobUrl) return <ThumbnailOrFallback file={file} variant={variant} />;
  return (
    <div className={shellClass(variant)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={blobUrl}
        alt={file.name || "Image"}
        className={
          variant === "quicklook"
            ? "max-w-[95vw] max-h-[85vh] object-contain"
            : variant === "pane"
            ? "max-w-full max-h-full object-contain p-4"
            : "max-w-full max-h-[600px] object-contain shadow-lg rounded"
        }
      />
    </div>
  );
}

function ThumbnailOrFallback({ file, variant }: { file: DriveFile; variant: PreviewVariant }) {
  if (file.thumbnailLink) {
    return (
      <div className={shellClass(variant, variant === "drawer" ? "py-8" : "")}>
        <Thumbnail
          fileId={file.id}
          mimeType={file.mimeType}
          thumbnailLink={file.thumbnailLink}
          modifiedTime={file.modifiedTime}
          alt={file.name}
          className={
            variant === "quicklook"
              ? "max-w-[95vw] max-h-[85vh] rounded object-contain"
              : variant === "pane"
              ? "max-w-full max-h-full rounded object-contain p-4"
              : "max-w-full max-h-[400px] rounded shadow-lg"
          }
          size={1200}
        />
      </div>
    );
  }
  return <FallbackPreview file={file} token={null} variant={variant} />;
}

function FallbackPreview({ file, variant }: PreviewRenderProps) {
  if (file.thumbnailLink) {
    return <ThumbnailOrFallback file={file} variant={variant} />;
  }
  return (
    <div className={
      variant === "quicklook"
        ? "px-6 py-16 text-center"
        : variant === "pane"
        ? "flex-1 min-h-0 flex flex-col items-center justify-center px-6 text-center"
        : "px-5 py-12 text-center border-b border-zinc-200 bg-zinc-50 dark:bg-zinc-900"
    }>
      <FileQuestion className="w-10 h-10 text-zinc-300 mb-3" strokeWidth={1.5} />
      <p className={`text-sm font-medium ${variant === "quicklook" ? "text-zinc-300" : "text-zinc-700 dark:text-zinc-300"}`}>
        No preview available
      </p>
      <p className="text-xs text-zinc-400 mt-1">This file type can be opened in Drive.</p>
      {file.webViewLink && (
        <a
          href={file.webViewLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 mt-3"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open in Drive
        </a>
      )}
    </div>
  );
}

function PreviewLoading({ variant }: { variant: PreviewVariant }) {
  return (
    <div className={
      variant === "quicklook"
        ? "flex items-center justify-center min-h-[40vh] w-full"
        : variant === "pane"
        ? "flex-1 min-h-0 flex items-center justify-center"
        : "aspect-[4/3] bg-zinc-100 border-b border-zinc-200 flex items-center justify-center"
    }>
      <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
    </div>
  );
}
