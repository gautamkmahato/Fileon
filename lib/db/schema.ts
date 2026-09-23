/** Mirrors lib/db/schema.sql — keep these 1:1 with Postgres. */

export const PG_SCHEMA_VERSION = 3;
export const PG_DB_NAME = "drive_ui_pg";
export const PG_DB_VERSION = 3;

export const PG_TABLES = [
  "cleanup_scans",
  "cleanup_files",
  "cleanup_groups",
  "cleanup_findings",
  "cleanup_health",
  "cleanup_decisions",
  "cleanup_sync_state",
  "smart_spaces",
  "smart_space_rules",
  "share_links",
] as const;

export type PgTable = (typeof PG_TABLES)[number];

export const SCAN_STATUSES = ["running", "completed", "failed", "cancelled"] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];

export const SCAN_KINDS = ["full", "incremental", "reanalyze"] as const;
export type ScanKind = (typeof SCAN_KINDS)[number];

export const DECISION_ACTIONS = ["dismiss", "keep", "snooze"] as const;
export type DecisionAction = (typeof DECISION_ACTIONS)[number];

export const FINDING_DETECTORS = [
  "duplicates",
  "same-content",
  "near-duplicates",
  "dead",
  "stale-6m",
  "stale-1y",
  "stale-2y",
  "unused",
  "empty-folders",
  "broken-shortcuts",
  "inaccessible",
  "orphaned",
  "unorganized",
  "duplicate-folders",
  "redundant",
  "recommendations",
] as const;

export type FindingDetector = (typeof FINDING_DETECTORS)[number];

export interface CleanupFileFlags {
  empty_verified?: boolean;
  inaccessible?: boolean;
  broken_target?: boolean;
}

export interface CleanupScanRow {
  id: string;
  user_id: string;
  status: ScanStatus;
  started_at: string;
  finished_at: string | null;
  file_count: number;
  truncated: boolean;
  error: string | null;
  schema_version: number;
  drive_page_token: string | null;
  kind: ScanKind;
}

export interface CleanupFileRow {
  user_id: string;
  file_id: string;
  name: string;
  mime_type: string;
  size_bytes: number | null;
  md5: string | null;
  created_at: string | null;
  modified_at: string | null;
  viewed_by_me_at: string | null;
  parents: string[];
  starred: boolean;
  shared: boolean;
  can_edit: boolean | null;
  can_download: boolean | null;
  shortcut_target_id: string | null;
  trashed: boolean;
  flags: CleanupFileFlags;
  last_seen_at: string;
}

export interface CleanupGroupRow {
  id: string;
  user_id: string;
  scan_id: string;
  detector: FindingDetector;
  label: string;
  reason: string;
  family: string | null;
  keep_file_id: string | null;
}

export interface CleanupFindingRow {
  id: string;
  user_id: string;
  scan_id: string;
  detector: FindingDetector;
  file_id: string;
  group_id: string | null;
  reason: string;
  rank: number | null;
  extra: Record<string, unknown>;
}

export interface CleanupHealthRow {
  user_id: string;
  scan_id: string;
  score: number;
  counts: Record<string, number>;
  breakdown: Array<{ label: string; count: number; penalty: number }>;
  computed_at: string;
}

export interface CleanupDecisionRow {
  user_id: string;
  file_id: string;
  detector: FindingDetector;
  action: DecisionAction;
  snooze_until: string | null;
  created_at: string;
}

export interface CleanupSyncStateRow {
  user_id: string;
  latest_scan_id: string | null;
  drive_start_page_token: string | null;
  last_incremental_at: string | null;
  last_full_scan_at: string | null;
  schema_version: number;
}

export const SPACE_MATCH_MODES = ["and", "or"] as const;
export type SpaceMatchMode = (typeof SPACE_MATCH_MODES)[number];

export const SPACE_LAYOUTS = ["grid", "list", "gallery"] as const;
export type SpaceLayout = (typeof SPACE_LAYOUTS)[number];

export const SPACE_RULE_FIELDS = [
  "type",
  "tag",
  "starred",
  "shared",
  "untagged",
  "created",
  "modified",
  "size",
  "name",
] as const;
export type SpaceRuleField = (typeof SPACE_RULE_FIELDS)[number];

export const SPACE_RULE_OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "contains"] as const;
export type SpaceRuleOp = (typeof SPACE_RULE_OPS)[number];

export type SpaceRuleValue = string | number | boolean;

export interface SmartSpaceRow {
  id: string;
  user_id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  match_mode: SpaceMatchMode;
  layout: SpaceLayout;
  sort_field: string;
  sort_dir: "asc" | "desc";
  sort_order: number;
  cached_file_count: number | null;
  cached_size_bytes: number | null;
  cached_truncated: boolean;
  cached_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SmartSpaceRuleRow {
  id: string;
  user_id: string;
  space_id: string;
  field: SpaceRuleField;
  op: SpaceRuleOp;
  value: SpaceRuleValue;
  position: number;
}

export const SHARE_LINK_STATUSES = ["active", "revoked"] as const;
export type ShareLinkStatus = (typeof SHARE_LINK_STATUSES)[number];

export interface ShareLinkRow {
  id: string;
  user_id: string;
  token: string;
  manage_key: string;
  file_id: string;
  file_name: string;
  mime_type: string;
  status: ShareLinkStatus;
  expires_at: string | null;
  allow_download: boolean;
  view_count: number;
  download_count: number;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
}

export type PgRow =
  | CleanupScanRow
  | CleanupFileRow
  | CleanupGroupRow
  | CleanupFindingRow
  | CleanupHealthRow
  | CleanupDecisionRow
  | CleanupSyncStateRow
  | SmartSpaceRow
  | SmartSpaceRuleRow
  | ShareLinkRow;

export const MAX_FILE_ROWS = 50_000;
export const MAX_NAME_LEN = 1024;
export const MAX_ID_LEN = 128;
export const MAX_ERROR_LEN = 2000;
export const MAX_REASON_LEN = 500;
export const MAX_SPACES = 50;
export const MAX_SPACE_RULES = 12;
export const MAX_SPACE_NAME_LEN = 80;
export const MAX_SPACE_EMOJI_LEN = 8;
export const MAX_SHARE_LINKS = 200;
export const MAX_SHARE_LINKS_PER_FILE = 20;
export const INCREMENTAL_STALE_MS = 15 * 60 * 1000;
export const FULL_SCAN_STALE_MS = 7 * 24 * 60 * 60 * 1000;
