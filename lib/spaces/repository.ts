import {
  MAX_SPACES,
  MAX_SPACE_EMOJI_LEN,
  MAX_SPACE_NAME_LEN,
  MAX_SPACE_RULES,
  SPACE_LAYOUTS,
  SPACE_MATCH_MODES,
  SPACE_RULE_FIELDS,
  SPACE_RULE_OPS,
  type SmartSpaceRow,
  type SmartSpaceRuleRow,
  type SpaceLayout,
  type SpaceMatchMode,
  type SpaceRuleField,
  type SpaceRuleOp,
  type SpaceRuleValue,
} from "@/lib/db/schema";
import { pgDelete, pgGet, pgSelectByUser, pgUpsert, pgUpsertMany } from "@/lib/db/engine";
import { assertUserId, isUuid, newId, nowIso, sanitizeText } from "@/lib/db/sanitize";
import { defaultOpForField, defaultValueForField, ruleIsValid } from "./rules";
import { rowToSpace, type SmartSpace, type SpaceDraft } from "./types";
import type { SortDir, SortField } from "@/lib/utils/sort";

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeSpaces(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function listSpaces(userId: string): Promise<SmartSpace[]> {
  const uid = assertUserId(userId);
  const [spaceRows, ruleRows] = await Promise.all([
    pgSelectByUser("smart_spaces", uid),
    pgSelectByUser("smart_space_rules", uid),
  ]);
  const bySpace = groupRules(ruleRows);
  return spaceRows
    .map((row) => rowToSpace(row, bySpace.get(row.id) ?? []))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export async function getSpace(userId: string, spaceId: string): Promise<SmartSpace | null> {
  const uid = assertUserId(userId);
  if (!isUuid(spaceId)) return null;
  const row = await pgGet("smart_spaces", spaceId);
  if (!row || row.user_id !== uid) return null;
  const rules = (await pgSelectByUser("smart_space_rules", uid)).filter((r) => r.space_id === spaceId);
  return rowToSpace(row, rules);
}

export async function createSpace(userId: string, draft: SpaceDraft): Promise<SmartSpace> {
  const uid = assertUserId(userId);
  const existing = await pgSelectByUser("smart_spaces", uid);
  if (existing.length >= MAX_SPACES) {
    throw new Error(`You can have up to ${MAX_SPACES} Smart Spaces`);
  }

  const now = nowIso();
  const id = newId();
  const rules = sanitizeRules(uid, id, draft.rules);
  const row: SmartSpaceRow = {
    id,
    user_id: uid,
    name: sanitizeSpaceName(draft.name),
    emoji: sanitizeEmoji(draft.emoji),
    color: sanitizeColor(draft.color),
    match_mode: sanitizeMatchMode(draft.matchMode),
    layout: sanitizeLayout(draft.layout),
    sort_field: sanitizeSortField(draft.sortField),
    sort_dir: sanitizeSortDir(draft.sortDir),
    sort_order: nextOrder(existing),
    cached_file_count: null,
    cached_size_bytes: null,
    cached_truncated: false,
    cached_at: null,
    created_at: now,
    updated_at: now,
  };

  await pgUpsert("smart_spaces", row);
  if (rules.length) await pgUpsertMany("smart_space_rules", rules);
  notify();
  return rowToSpace(row, rules);
}

export async function updateSpace(
  userId: string,
  spaceId: string,
  patch: Partial<SpaceDraft> & {
    cachedFileCount?: number | null;
    cachedSizeBytes?: number | null;
    cachedTruncated?: boolean;
  },
): Promise<SmartSpace | null> {
  const uid = assertUserId(userId);
  const current = await getSpace(uid, spaceId);
  if (!current) return null;

  const now = nowIso();
  const row: SmartSpaceRow = {
    id: current.id,
    user_id: uid,
    name: patch.name !== undefined ? sanitizeSpaceName(patch.name) : current.name,
    emoji: patch.emoji !== undefined ? sanitizeEmoji(patch.emoji) : current.emoji,
    color: patch.color !== undefined ? sanitizeColor(patch.color) : current.color,
    match_mode: patch.matchMode !== undefined ? sanitizeMatchMode(patch.matchMode) : current.matchMode,
    layout: patch.layout !== undefined ? sanitizeLayout(patch.layout) : current.layout,
    sort_field: patch.sortField !== undefined ? sanitizeSortField(patch.sortField) : current.sortField,
    sort_dir: patch.sortDir !== undefined ? sanitizeSortDir(patch.sortDir) : current.sortDir,
    sort_order: current.sortOrder,
    cached_file_count: patch.cachedFileCount !== undefined ? patch.cachedFileCount : current.cachedFileCount,
    cached_size_bytes: patch.cachedSizeBytes !== undefined ? patch.cachedSizeBytes : current.cachedSizeBytes,
    cached_truncated: patch.cachedTruncated ?? current.cachedTruncated,
    cached_at: patch.cachedFileCount !== undefined ? now : current.cachedAt,
    created_at: current.createdAt,
    updated_at: now,
  };

  await pgUpsert("smart_spaces", row);

  let ruleRows: SmartSpaceRuleRow[];
  if (patch.rules) {
    await replaceRules(uid, spaceId);
    ruleRows = sanitizeRules(uid, spaceId, patch.rules);
    if (ruleRows.length) await pgUpsertMany("smart_space_rules", ruleRows);
  } else {
    ruleRows = (await pgSelectByUser("smart_space_rules", uid)).filter((r) => r.space_id === spaceId);
  }

  notify();
  return rowToSpace(row, ruleRows);
}

export async function deleteSpace(userId: string, spaceId: string): Promise<boolean> {
  const uid = assertUserId(userId);
  const current = await getSpace(uid, spaceId);
  if (!current) return false;
  await replaceRules(uid, spaceId);
  await pgDelete("smart_spaces", spaceId);
  notify();
  return true;
}

export async function updateSpaceStats(
  userId: string,
  spaceId: string,
  stats: { fileCount: number; sizeBytes: number; truncated: boolean },
): Promise<void> {
  await updateSpace(userId, spaceId, {
    cachedFileCount: stats.fileCount,
    cachedSizeBytes: stats.sizeBytes,
    cachedTruncated: stats.truncated,
  });
}

function groupRules(rows: SmartSpaceRuleRow[]): Map<string, SmartSpaceRuleRow[]> {
  const map = new Map<string, SmartSpaceRuleRow[]>();
  for (const row of rows) {
    const list = map.get(row.space_id) ?? [];
    list.push(row);
    map.set(row.space_id, list);
  }
  return map;
}

async function replaceRules(userId: string, spaceId: string): Promise<void> {
  const rows = (await pgSelectByUser("smart_space_rules", userId)).filter((r) => r.space_id === spaceId);
  for (const row of rows) {
    await pgDelete("smart_space_rules", row.id);
  }
}

function sanitizeRules(
  userId: string,
  spaceId: string,
  rules: SpaceDraft["rules"],
): SmartSpaceRuleRow[] {
  const out: SmartSpaceRuleRow[] = [];
  for (const rule of rules.slice(0, MAX_SPACE_RULES)) {
    const field = sanitizeField(rule.field);
    const op = sanitizeOp(field, rule.op);
    const value = sanitizeValue(field, rule.value);
    const candidate = { field, op, value };
    if (!ruleIsValid(candidate)) continue;
    out.push({
      id: newId(),
      user_id: userId,
      space_id: spaceId,
      field,
      op,
      value,
      position: out.length,
    });
  }
  return out;
}

function sanitizeSpaceName(name: string): string {
  const trimmed = sanitizeText(name, MAX_SPACE_NAME_LEN).trim();
  return trimmed || "Untitled space";
}

function sanitizeEmoji(emoji: string | null | undefined): string | null {
  if (!emoji) return null;
  const trimmed = sanitizeText(emoji, MAX_SPACE_EMOJI_LEN).trim();
  return trimmed || null;
}

function sanitizeColor(color: string | null | undefined): string | null {
  if (!color) return null;
  const trimmed = color.trim().toLowerCase();
  if (!/^[a-z]{2,16}$/.test(trimmed)) return null;
  return trimmed;
}

function sanitizeMatchMode(mode: SpaceMatchMode | string): SpaceMatchMode {
  return SPACE_MATCH_MODES.includes(mode as SpaceMatchMode) ? (mode as SpaceMatchMode) : "and";
}

function sanitizeLayout(layout: SpaceLayout | string): SpaceLayout {
  return SPACE_LAYOUTS.includes(layout as SpaceLayout) ? (layout as SpaceLayout) : "grid";
}

function sanitizeSortField(field: SortField | string): SortField {
  if (field === "name" || field === "modified" || field === "size" || field === "type") return field;
  return "modified";
}

function sanitizeSortDir(dir: SortDir | string): SortDir {
  return dir === "asc" ? "asc" : "desc";
}

function sanitizeField(field: string): SpaceRuleField {
  return SPACE_RULE_FIELDS.includes(field as SpaceRuleField) ? (field as SpaceRuleField) : "type";
}

function sanitizeOp(field: SpaceRuleField, op: string): SpaceRuleOp {
  if (SPACE_RULE_OPS.includes(op as SpaceRuleOp)) return op as SpaceRuleOp;
  return defaultOpForField(field);
}

function sanitizeValue(field: SpaceRuleField, value: SpaceRuleValue): SpaceRuleValue {
  if (field === "size") {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n) || n < 0) return defaultValueForField("size", []);
    return Math.floor(n);
  }
  if (field === "starred" || field === "shared" || field === "untagged") {
    return value !== false;
  }
  if (typeof value === "string") return sanitizeText(value, 256).trim();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return defaultValueForField(field, []);
}

function nextOrder(existing: SmartSpaceRow[]): number {
  if (existing.length === 0) return 0;
  return Math.max(...existing.map((r) => r.sort_order)) + 1;
}
