export const GOOGLE_SHEET_MIME = "application/vnd.google-apps.spreadsheet";
export const CSV_MIME = "text/csv";
export const TSV_MIME = "text/tab-separated-values";
export const MARKDOWN_MIME = "text/markdown";

function extOf(fileName?: string): string {
  if (!fileName) return "";
  const base = fileName.split("/").pop() ?? fileName;
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}

export function isCsvFile(mimeType: string, fileName?: string): boolean {
  if (mimeType === GOOGLE_SHEET_MIME) return true;
  if (mimeType === CSV_MIME || mimeType === TSV_MIME) return true;
  const ext = extOf(fileName);
  return ext === "csv" || ext === "tsv";
}

export function isMarkdownFile(mimeType: string, fileName?: string): boolean {
  if (mimeType === MARKDOWN_MIME) return true;
  const ext = extOf(fileName);
  return ext === "md" || ext === "markdown";
}

export function needsTextScreenshot(mimeType: string, fileName?: string): boolean {
  return isCsvFile(mimeType, fileName) || isMarkdownFile(mimeType, fileName);
}

export type TextScreenshotKind = "csv" | "markdown";

export function textScreenshotKind(
  mimeType: string,
  fileName?: string
): TextScreenshotKind | null {
  if (isCsvFile(mimeType, fileName)) return "csv";
  if (isMarkdownFile(mimeType, fileName)) return "markdown";
  return null;
}
