import type {
  SpaceLayout,
  SpaceMatchMode,
  SpaceRuleField,
  SpaceRuleOp,
  SpaceRuleValue,
  SmartSpaceRow,
  SmartSpaceRuleRow,
} from "@/lib/db/schema";
import type { SortField, SortDir } from "@/lib/utils/sort";

export type {
  SpaceLayout,
  SpaceMatchMode,
  SpaceRuleField,
  SpaceRuleOp,
  SpaceRuleValue,
};

export type SpaceFileType =
  | "pdf"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "folder"
  | "archive";

export type SpaceDatePreset =
  | "today"
  | "this-week"
  | "this-month"
  | "this-year"
  | "older-6m"
  | "older-1y";

export interface SpaceRule {
  id: string;
  field: SpaceRuleField;
  op: SpaceRuleOp;
  value: SpaceRuleValue;
  position: number;
}

export interface SmartSpace {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  matchMode: SpaceMatchMode;
  layout: SpaceLayout;
  sortField: SortField;
  sortDir: SortDir;
  sortOrder: number;
  rules: SpaceRule[];
  cachedFileCount: number | null;
  cachedSizeBytes: number | null;
  cachedTruncated: boolean;
  cachedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SpaceDraft {
  name: string;
  emoji?: string | null;
  color?: string | null;
  matchMode: SpaceMatchMode;
  layout: SpaceLayout;
  sortField: SortField;
  sortDir: SortDir;
  rules: Array<{
    field: SpaceRuleField;
    op: SpaceRuleOp;
    value: SpaceRuleValue;
  }>;
}

export interface SpaceQueryResult {
  files: import("@/lib/drive/drive").DriveFile[];
  truncated: boolean;
  warnings: string[];
  totalSizeBytes: number;
}

export function rowToSpace(row: SmartSpaceRow, rules: SmartSpaceRuleRow[]): SmartSpace {
  const sortField = isSortField(row.sort_field) ? row.sort_field : "modified";
  const sortDir = row.sort_dir === "asc" ? "asc" : "desc";
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    color: row.color,
    matchMode: row.match_mode === "or" ? "or" : "and",
    layout: row.layout === "list" || row.layout === "gallery" ? row.layout : "grid",
    sortField,
    sortDir,
    sortOrder: row.sort_order,
    rules: [...rules]
      .sort((a, b) => a.position - b.position)
      .map((r) => ({
        id: r.id,
        field: r.field,
        op: r.op,
        value: r.value,
        position: r.position,
      })),
    cachedFileCount: row.cached_file_count,
    cachedSizeBytes: row.cached_size_bytes,
    cachedTruncated: row.cached_truncated,
    cachedAt: row.cached_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isSortField(value: string): value is SortField {
  return value === "name" || value === "modified" || value === "size" || value === "type";
}
