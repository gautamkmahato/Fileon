import Papa from "papaparse";
import { marked } from "marked";
import { prepareCsvText, prepareMarkdownText } from "./fetch-text-content";

export interface PreviewHtmlOptions {
  width: number;
  height: number;
  maxRows?: number;
  maxCols?: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseCsvRows(text: string, maxRows: number, maxCols: number): string[][] {
  const parsed = Papa.parse<string[]>(prepareCsvText(text), {
    skipEmptyLines: true,
    preview: maxRows,
  });
  if (parsed.errors.length && !parsed.data.length) return [];
  return parsed.data
    .slice(0, maxRows)
    .map((row) => row.slice(0, maxCols).map((cell) => String(cell ?? "")));
}

export function buildCsvPreviewHtml(text: string, opts: PreviewHtmlOptions): string {
  const { width, height, maxRows = 8, maxCols = 6 } = opts;
  const rows = parseCsvRows(text, maxRows, maxCols);
  if (!rows.length) {
    return wrapFrame(width, height, `<p style="margin:0;color:#71717a;font-size:12px;">Empty spreadsheet</p>`);
  }

  const body = rows
    .map((row, ri) => {
      const cells = row
        .map((cell) => {
          const label = escapeHtml(cell);
          return `<td style="border:1px solid #e4e4e7;padding:4px 6px;max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:top;">${label}</td>`;
        })
        .join("");
      const rowBg = ri === 0 ? "background:#ecfdf5;font-weight:600;" : "";
      return `<tr style="${rowBg}">${cells}</tr>`;
    })
    .join("");

  const table = `
    <table style="width:100%;border-collapse:collapse;font-size:10px;line-height:1.35;color:#3f3f46;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;">
      <tbody>${body}</tbody>
    </table>`;

  return wrapFrame(width, height, table);
}

export function buildMarkdownPreviewHtml(text: string, opts: PreviewHtmlOptions): string {
  const { width, height } = opts;
  marked.setOptions({ gfm: true, breaks: true });
  const rawHtml = marked.parse(prepareMarkdownText(text), { async: false }) as string;

  const content = `
    <style>
      .md-thumb { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; font-size: 13px; line-height: 1.55; color: #27272a; }
      .md-thumb h1 { font-size: 20px; font-weight: 700; margin: 0 0 10px; line-height: 1.25; }
      .md-thumb h2 { font-size: 16px; font-weight: 650; margin: 14px 0 8px; line-height: 1.3; }
      .md-thumb h3 { font-size: 14px; font-weight: 600; margin: 12px 0 6px; }
      .md-thumb p { margin: 0 0 8px; }
      .md-thumb ul, .md-thumb ol { margin: 0 0 8px 18px; padding: 0; }
      .md-thumb li { margin: 0 0 4px; }
      .md-thumb code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; background: #f4f4f5; padding: 1px 4px; border-radius: 4px; }
      .md-thumb pre { margin: 0 0 10px; padding: 10px; background: #18181b; color: #fafafa; border-radius: 8px; overflow: hidden; font-size: 10px; line-height: 1.45; }
      .md-thumb pre code { background: transparent; color: inherit; padding: 0; }
      .md-thumb blockquote { margin: 0 0 8px; padding-left: 10px; border-left: 3px solid #d4d4d8; color: #52525b; }
      .md-thumb a { color: #2563eb; text-decoration: none; }
    </style>
    <div class="md-thumb">${rawHtml}</div>`;

  return wrapFrame(width, height, content);
}

function wrapFrame(width: number, height: number, inner: string): string {
  return `
    <div style="width:${width}px;height:${height}px;overflow:hidden;background:#ffffff;box-sizing:border-box;padding:12px;">
      ${inner}
    </div>`;
}
