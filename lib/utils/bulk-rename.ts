import type { DriveFile } from "@/lib/drive/drive";

export type BulkRenameMode = "find-replace" | "pattern" | "case" | "sequence";

export interface BulkRenameConfig {
  mode: BulkRenameMode;
  find?: string;
  replace?: string;
  pattern?: string;
  caseMode?: "lower" | "upper" | "title";
  sequenceStart?: number;
  sequencePad?: number;
  sequencePosition?: "prefix" | "suffix";
  sequenceSeparator?: string;
}

export interface RenamePreviewRow {
  file: DriveFile;
  newName: string;
  error?: string;
}

function splitName(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return { base: name, ext: "" };
  return { base: name.slice(0, dot), ext: name.slice(dot) };
}

function padNum(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

function toTitleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function expandPattern(pattern: string, file: DriveFile, index: number): string {
  const { base, ext } = splitName(file.name);
  const date = file.modifiedTime
    ? new Date(file.modifiedTime).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  let result = pattern;
  result = result.replace(/\{index:(\d+)\}/g, (_, w) => padNum(index + 1, parseInt(w, 10)));
  result = result.replace(/\{index\}/g, String(index + 1));
  result = result.replace(/\{date\}/g, date);
  result = result.replace(/\{ext\}/g, ext.replace(/^\./, ""));
  result = result.replace(/\{original\}/g, base);

  if (!result.includes(".") && ext) result += ext;
  return result;
}

function validateName(name: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return "Name cannot be empty";
  if (/[\\/:*?"<>|]/.test(trimmed)) return "Invalid characters";
  if (trimmed.endsWith(".") || trimmed.endsWith(" ")) return "Invalid trailing characters";
  return undefined;
}

export function previewBulkRename(
  files: DriveFile[],
  config: BulkRenameConfig,
  existingNames: Set<string>
): RenamePreviewRow[] {
  const used = new Set(existingNames);

  return files.map((file, index) => {
    const { base, ext } = splitName(file.name);
    let newName = file.name;

    switch (config.mode) {
      case "find-replace": {
        const find = config.find ?? "";
        const rep = config.replace ?? "";
        if (find) {
          newName = file.name.split(find).join(rep);
        }
        break;
      }
      case "pattern":
        newName = expandPattern(config.pattern ?? "{original}", file, index);
        break;
      case "case": {
        const target = config.caseMode === "lower" ? base.toLowerCase()
          : config.caseMode === "upper" ? base.toUpperCase()
          : toTitleCase(base);
        newName = target + ext;
        break;
      }
      case "sequence": {
        const start = config.sequenceStart ?? 1;
        const pad = config.sequencePad ?? 0;
        const sep = config.sequenceSeparator ?? "-";
        const num = pad > 0 ? padNum(start + index, pad) : String(start + index);
        newName = config.sequencePosition === "suffix"
          ? `${base}${sep}${num}${ext}`
          : `${num}${sep}${base}${ext}`;
        break;
      }
    }

    newName = newName.trim();
    let error = validateName(newName);
    if (!error && newName !== file.name && used.has(newName.toLowerCase())) {
      error = "Name already exists";
    }
    if (!error && newName !== file.name) {
      used.add(newName.toLowerCase());
    }

    return { file, newName, error };
  });
}
