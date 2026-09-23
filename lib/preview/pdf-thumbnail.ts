import { downloadFile, exportFile } from "@/lib/drive/drive";
import { renderPdfPageToPngBlob } from "./render-pdf-page";

export const PDF_MIME = "application/pdf";
export const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";

export function isPdfMime(mimeType: string, fileName?: string): boolean {
  if (mimeType === PDF_MIME) return true;
  if (mimeType === "application/octet-stream" && fileName?.toLowerCase().endsWith(".pdf")) {
    return true;
  }
  return false;
}

export function isGoogleDocMime(mimeType: string): boolean {
  return mimeType === GOOGLE_DOC_MIME;
}

/** PDF uploads and Google Docs get page-1 screenshot thumbnails in grid mode. */
export function needsPdfScreenshot(mimeType: string, fileName?: string): boolean {
  return isPdfMime(mimeType, fileName) || isGoogleDocMime(mimeType);
}

async function fetchPdfBytes(
  token: string,
  fileId: string,
  mimeType: string
): Promise<ArrayBuffer> {
  const blob = isGoogleDocMime(mimeType)
    ? await exportFile(token, fileId, PDF_MIME)
    : await downloadFile(token, fileId);
  return blob.arrayBuffer();
}

/**
 * Download (or export) a PDF, render page 1 to PNG, return blob for IDB cache.
 */
export async function generatePdfThumbnailBlob(opts: {
  token: string;
  fileId: string;
  mimeType: string;
  fileName?: string;
  renderWidth?: number;
}): Promise<Blob> {
  const { token, fileId, mimeType, fileName, renderWidth = 480 } = opts;

  if (!needsPdfScreenshot(mimeType, fileName)) {
    throw new Error("File type does not support PDF screenshot thumbnails");
  }

  const pdfData = await fetchPdfBytes(token, fileId, mimeType);
  return renderPdfPageToPngBlob(pdfData, { page: 1, width: renderWidth });
}
