import type { DriveFile } from "@/lib/drive/drive";
import { FOLDER_MIME } from "@/lib/drive/drive";
import type { Tag } from "@/lib/tags";
import { tagShortLabel } from "@/lib/tag-kinds";
import type {
  SpaceDatePreset,
  SpaceFileType,
  SpaceRule,
  SmartSpace,
} from "./types";
import type { SpaceRuleField, SpaceRuleOp, SpaceRuleValue } from "@/lib/db/schema";

const DAY_MS = 24 * 60 * 60 * 1000;

const DOCUMENT_MIMES = new Set([
  "application/vnd.google-apps.document",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "application/rtf",
  "application/vnd.apple.pages",
]);

const SPREADSHEET_MIMES = new Set([
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.apple.numbers",
]);

const PRESENTATION_MIMES = new Set([
  "application/vnd.google-apps.presentation",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.presentation",
  "application/vnd.apple.keynote",
]);

const ARCHIVE_MIMES = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/x-7z-compressed",
  "application/x-rar-compressed",
  "application/gzip",
  "application/x-tar",
]);

export const SPACE_FILE_TYPES: Array<{ value: SpaceFileType; label: string }> = [
  { value: "pdf", label: "PDF" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "document", label: "Document" },
  { value: "spreadsheet", label: "Spreadsheet" },
  { value: "presentation", label: "Presentation" },
  { value: "folder", label: "Folder" },
  { value: "archive", label: "Archive" },
];

export const SPACE_DATE_PRESETS: Array<{ value: SpaceDatePreset; label: string }> = [
  { value: "today", label: "Today" },
  { value: "this-week", label: "This week" },
  { value: "this-month", label: "This month" },
  { value: "this-year", label: "This year" },
  { value: "older-6m", label: "Older than 6 months" },
  { value: "older-1y", label: "Older than 1 year" },
];

export const FIELD_LABELS: Record<SpaceRuleField, string> = {
  type: "File type",
  tag: "Tag",
  starred: "Starred",
  shared: "Shared",
  untagged: "Untagged",
  created: "Created",
  modified: "Modified",
  size: "Size",
  name: "Name",
};

const DATE_PRESET_SET = new Set<string>(SPACE_DATE_PRESETS.map((p) => p.value));
const TYPE_SET = new Set<string>(SPACE_FILE_TYPES.map((t) => t.value));

export function isSpaceFileType(value: string): value is SpaceFileType {
  return TYPE_SET.has(value);
}

export function isSpaceDatePreset(value: string): value is SpaceDatePreset {
  return DATE_PRESET_SET.has(value);
}

export function classifySpaceType(mime: string): SpaceFileType | "other" {
  if (mime === FOLDER_MIME) return "folder";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (DOCUMENT_MIMES.has(mime) || mime.includes("wordprocessingml")) return "document";
  if (SPREADSHEET_MIMES.has(mime) || mime.includes("spreadsheetml")) return "spreadsheet";
  if (PRESENTATION_MIMES.has(mime) || mime.includes("presentationml")) return "presentation";
  if (ARCHIVE_MIMES.has(mime) || mime.includes("compressed") || mime.includes("tar")) return "archive";
  return "other";
}

export function driveMimeClause(type: SpaceFileType): string {
  switch (type) {
    case "pdf":
      return "mimeType = 'application/pdf'";
    case "image":
      return "mimeType contains 'image/'";
    case "video":
      return "mimeType contains 'video/'";
    case "audio":
      return "mimeType contains 'audio/'";
    case "folder":
      return `mimeType = '${FOLDER_MIME}'`;
    case "document":
      return `(${[...DOCUMENT_MIMES].map((m) => `mimeType = '${m}'`).join(" or ")})`;
    case "spreadsheet":
      return `(${[...SPREADSHEET_MIMES].map((m) => `mimeType = '${m}'`).join(" or ")})`;
    case "presentation":
      return `(${[...PRESENTATION_MIMES].map((m) => `mimeType = '${m}'`).join(" or ")})`;
    case "archive":
      return "(name contains '.zip' or name contains '.tar' or name contains '.rar' or name contains '.7z' or mimeType = 'application/zip' or mimeType = 'application/x-zip-compressed' or mimeType = 'application/x-7z-compressed' or mimeType = 'application/x-rar-compressed' or mimeType = 'application/gzip')";
  }
}

export function opsForField(field: SpaceRuleField): SpaceRuleOp[] {
  switch (field) {
    case "size":
      return ["gt", "gte", "lt", "lte"];
    case "name":
      return ["contains"];
    case "type":
    case "tag":
    case "starred":
    case "shared":
    case "untagged":
    case "created":
    case "modified":
      return ["eq", "neq"];
  }
}

export function defaultValueForField(field: SpaceRuleField, tags: Tag[]): SpaceRuleValue {
  switch (field) {
    case "type":
      return "pdf";
    case "tag":
      return tags[0]?.id ?? "";
    case "starred":
    case "shared":
    case "untagged":
      return true;
    case "created":
    case "modified":
      return "this-year";
    case "size":
      return 500 * 1024 * 1024;
    case "name":
      return "";
  }
}

export function defaultOpForField(field: SpaceRuleField): SpaceRuleOp {
  return opsForField(field)[0];
}

export function ruleIsValid(rule: Pick<SpaceRule, "field" | "op" | "value">): boolean {
  if (!opsForField(rule.field).includes(rule.op)) return false;
  switch (rule.field) {
    case "type":
      return typeof rule.value === "string" && isSpaceFileType(rule.value);
    case "tag":
      return typeof rule.value === "string" && rule.value.length > 0;
    case "starred":
    case "shared":
    case "untagged":
      return rule.value === true || rule.value === false;
    case "created":
    case "modified":
      return typeof rule.value === "string" && isSpaceDatePreset(rule.value);
    case "size":
      return typeof rule.value === "number" && Number.isFinite(rule.value) && rule.value >= 0;
    case "name":
      return typeof rule.value === "string" && rule.value.trim().length > 0;
  }
}

/** Rules that can seed a Drive list query or a local tag lookup. Size/untagged cannot. */
export function canSeedQuery(rule: SpaceRule): boolean {
  if (!ruleIsValid(rule)) return false;
  return rule.field === "type"
    || rule.field === "tag"
    || rule.field === "starred"
    || rule.field === "created"
    || rule.field === "modified"
    || rule.field === "name";
}

export function fileMatchesRule(
  file: DriveFile,
  rule: SpaceRule,
  tagsByFileId: Map<string, Tag[]>,
): boolean {
  if (!ruleIsValid(rule)) return false;
  const positive = matchPositive(file, rule, tagsByFileId);
  return rule.op === "neq" ? !positive : positive;
}

function matchPositive(
  file: DriveFile,
  rule: SpaceRule,
  tagsByFileId: Map<string, Tag[]>,
): boolean {
  switch (rule.field) {
    case "type":
      return classifySpaceType(file.mimeType) === rule.value;
    case "tag": {
      const ids = (tagsByFileId.get(file.id) ?? []).map((t) => t.id);
      return ids.includes(String(rule.value));
    }
    case "starred":
      return !!file.starred;
    case "shared":
      return !!file.shared;
    case "untagged":
      return !(tagsByFileId.get(file.id)?.length);
    case "created":
      return matchesDatePreset(file.createdTime, String(rule.value));
    case "modified":
      return matchesDatePreset(file.modifiedTime, String(rule.value));
    case "size": {
      const size = file.size ? Number(file.size) : NaN;
      if (!Number.isFinite(size)) return false;
      const bound = Number(rule.value);
      switch (rule.op) {
        case "gt": return size > bound;
        case "gte": return size >= bound;
        case "lt": return size < bound;
        case "lte": return size <= bound;
        default: return false;
      }
    }
    case "name":
      return file.name.toLowerCase().includes(String(rule.value).trim().toLowerCase());
  }
}

function matchesDatePreset(iso: string | undefined, preset: string): boolean {
  if (!iso || !isSpaceDatePreset(preset)) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  const now = Date.now();
  const age = now - t;
  switch (preset) {
    case "today":
      return age >= 0 && age <= DAY_MS;
    case "this-week":
      return age >= 0 && age <= 7 * DAY_MS;
    case "this-month":
      return age >= 0 && age <= 30 * DAY_MS;
    case "this-year": {
      const start = new Date();
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      return t >= start.getTime() && t <= now;
    }
    case "older-6m":
      return age > 182 * DAY_MS;
    case "older-1y":
      return age > 365 * DAY_MS;
  }
}

export function fileMatchesSpace(
  file: DriveFile,
  space: Pick<SmartSpace, "matchMode" | "rules">,
  tagsByFileId: Map<string, Tag[]>,
): boolean {
  const rules = space.rules.filter(ruleIsValid);
  if (rules.length === 0) return false;
  if (space.matchMode === "or") {
    return rules.some((rule) => fileMatchesRule(file, rule, tagsByFileId));
  }
  return rules.every((rule) => fileMatchesRule(file, rule, tagsByFileId));
}

export function describeRule(rule: SpaceRule, tags: Tag[]): string {
  const field = FIELD_LABELS[rule.field];
  switch (rule.field) {
    case "type": {
      const label = SPACE_FILE_TYPES.find((t) => t.value === rule.value)?.label ?? String(rule.value);
      return rule.op === "neq" ? `${field} is not ${label}` : `${field} is ${label}`;
    }
    case "tag": {
      const tag = tags.find((t) => t.id === rule.value);
      const name = tag ? tagShortLabel(tag) : "missing tag";
      return rule.op === "neq" ? `${field} is not ${name}` : `${field} is ${name}`;
    }
    case "starred":
    case "shared":
    case "untagged":
      return rule.op === "neq" ? `Not ${field.toLowerCase()}` : field;
    case "created":
    case "modified": {
      const preset = SPACE_DATE_PRESETS.find((p) => p.value === rule.value)?.label ?? String(rule.value);
      return `${field} · ${preset}`;
    }
    case "size": {
      const n = Number(rule.value);
      const op = rule.op === "gt" ? ">" : rule.op === "gte" ? "≥" : rule.op === "lt" ? "<" : "≤";
      return `${field} ${op} ${formatSize(n)}`;
    }
    case "name":
      return `${field} contains “${String(rule.value).trim()}”`;
  }
}

export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

export function datePresetToDriveTime(preset: SpaceDatePreset): { op: ">" | "<"; iso: string } | null {
  const now = new Date();
  switch (preset) {
    case "today": {
      const d = new Date(now.getTime() - DAY_MS);
      return { op: ">", iso: d.toISOString() };
    }
    case "this-week": {
      const d = new Date(now.getTime() - 7 * DAY_MS);
      return { op: ">", iso: d.toISOString() };
    }
    case "this-month": {
      const d = new Date(now.getTime() - 30 * DAY_MS);
      return { op: ">", iso: d.toISOString() };
    }
    case "this-year": {
      const d = new Date(now.getFullYear(), 0, 1);
      return { op: ">", iso: d.toISOString() };
    }
    case "older-6m": {
      const d = new Date(now.getTime() - 182 * DAY_MS);
      return { op: "<", iso: d.toISOString() };
    }
    case "older-1y": {
      const d = new Date(now.getTime() - 365 * DAY_MS);
      return { op: "<", iso: d.toISOString() };
    }
  }
}

export function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
