import { downloadFile, exportFile } from "@/lib/drive/drive";
import { GOOGLE_SHEET_MIME, isCsvFile } from "./text-thumbnail-detect";

/** Fetch CSV or Markdown text from Drive (export for Google Sheets, download otherwise). */
export async function fetchTextForThumbnail(
  token: string,
  fileId: string,
  mimeType: string
): Promise<string> {
  if (mimeType === GOOGLE_SHEET_MIME) {
    const blob = await exportFile(token, fileId, "text/csv");
    return blob.text();
  }
  const blob = await downloadFile(token, fileId);
  return blob.text();
}

export function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n…`;
}

/** Limit CSV payload before parse to keep snapshot fast. */
export function prepareCsvText(text: string): string {
  const lines = text.split(/\r?\n/).slice(0, 40);
  return truncateText(lines.join("\n"), 24_000);
}

/** Limit markdown body for thumbnail render. */
export function prepareMarkdownText(text: string): string {
  return truncateText(text, 12_000);
}

export function isFetchableAsText(mimeType: string, fileName?: string): boolean {
  if (isCsvFile(mimeType, fileName)) return true;
  if (mimeType.startsWith("text/")) return true;
  return false;
}
