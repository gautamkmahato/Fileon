import type { DriveFile } from "@/lib/drive/drive";

/**
 * Preview kinds. Add a matcher + renderer to support a new type
 * (video, audio, pdf, doc, csv, …) without changing Inbox or PreviewBody.
 */
export type PreviewKind = "image" | "fallback";

export function getExtension(name: string): string {
  const base = name.split("/").pop() ?? name;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot + 1).toLowerCase();
}

const RASTER_IMAGE_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "gif", "webp", "bmp", "heic", "heif", "avif", "tiff", "tif",
]);

export function isGoogleNative(file: DriveFile): boolean {
  return !!file.mimeType && file.mimeType.startsWith("application/vnd.google-apps.");
}

function isRasterImage(file: DriveFile): boolean {
  const mime = file.mimeType ?? "";
  if (mime.startsWith("image/") && mime !== "image/svg+xml") return true;
  return RASTER_IMAGE_EXTENSIONS.has(getExtension(file.name ?? ""));
}

type KindMatcher = {
  kind: Exclude<PreviewKind, "fallback">;
  match: (file: DriveFile) => boolean;
};

/** First matching kind wins. Append new kinds here (video, pdf, …). */
const KIND_MATCHERS: KindMatcher[] = [
  { kind: "image", match: isRasterImage },
];

export function detectPreviewKind(file: DriveFile | null | undefined): PreviewKind {
  if (!file) return "fallback";
  for (const matcher of KIND_MATCHERS) {
    try {
      if (matcher.match(file)) return matcher.kind;
    } catch {
      /* skip broken matcher */
    }
  }
  return "fallback";
}

export function needsContentFetch(kind: PreviewKind): boolean {
  return kind === "image";
}
