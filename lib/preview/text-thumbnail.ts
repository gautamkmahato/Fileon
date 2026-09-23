import { fetchTextForThumbnail } from "./fetch-text-content";
import { buildCsvPreviewHtml, buildMarkdownPreviewHtml } from "./build-preview-html";
import { snapshotHtmlToPng } from "./snapshot-html-to-png";
import {
  needsTextScreenshot,
  textScreenshotKind,
} from "./text-thumbnail-detect";

export {
  needsTextScreenshot,
  isCsvFile,
  isMarkdownFile,
} from "./text-thumbnail-detect";

/**
 * CSV / Markdown grid thumbnail pipeline:
 * fetch text → build HTML → offscreen DOM snapshot → PNG blob for IDB cache.
 */
export async function generateTextThumbnailBlob(opts: {
  token: string;
  fileId: string;
  mimeType: string;
  fileName?: string;
  renderWidth?: number;
  renderHeight?: number;
}): Promise<Blob> {
  const {
    token,
    fileId,
    mimeType,
    fileName,
    renderWidth = 480,
    renderHeight = Math.round(renderWidth * 0.75),
  } = opts;

  const kind = textScreenshotKind(mimeType, fileName);
  if (!kind) {
    throw new Error("File type does not support text screenshot thumbnails");
  }

  const text = await fetchTextForThumbnail(token, fileId, mimeType);
  const htmlOpts = { width: renderWidth, height: renderHeight };

  const html =
    kind === "csv"
      ? buildCsvPreviewHtml(text, htmlOpts)
      : buildMarkdownPreviewHtml(text, htmlOpts);

  return snapshotHtmlToPng(html, renderWidth, renderHeight);
}

export function shouldGenerateTextThumbnail(
  mimeType: string,
  fileName: string | undefined,
  mode: "grid" | "full"
): boolean {
  return mode === "grid" && needsTextScreenshot(mimeType, fileName);
}
