import type { DriveFile } from "@/lib/drive/drive";
import { fetchAllFilesByIds, listFilesByQuery } from "@/lib/drive/drive";
import { getFileIdsForTag } from "@/lib/tags";
import type { Tag } from "@/lib/tags";
import type { SmartSpace, SpaceQueryResult, SpaceRule } from "./types";
import {
  canSeedQuery,
  datePresetToDriveTime,
  driveMimeClause,
  escapeDriveQueryValue,
  fileMatchesSpace,
  isSpaceDatePreset,
  isSpaceFileType,
  ruleIsValid,
} from "./rules";

const PAGE_SIZE = 100;
const MAX_PAGES = 5;
const MAX_TAG_IDS = 2_000;

export async function querySmartSpace(opts: {
  token: string;
  space: SmartSpace;
  tags: Tag[];
  tagsByFileId: Map<string, Tag[]>;
}): Promise<SpaceQueryResult> {
  const { token, space, tags, tagsByFileId } = opts;
  const rules = space.rules.filter(ruleIsValid);
  const warnings: string[] = [];

  for (const rule of space.rules) {
    if (rule.field === "tag" && typeof rule.value === "string" && !tags.some((t) => t.id === rule.value)) {
      warnings.push("A tag used in this space no longer exists.");
    }
  }

  if (rules.length === 0) {
    return {
      files: [],
      truncated: false,
      warnings: warnings.length ? warnings : ["Add at least one rule to collect matching files."],
      totalSizeBytes: 0,
    };
  }

  if (!rules.some(canSeedQuery)) {
    return {
      files: [],
      truncated: false,
      warnings: [
        ...warnings,
        "Add a type, tag, date, name, or starred/shared rule so we can find files without scanning your whole Drive.",
      ],
      totalSizeBytes: 0,
    };
  }

  const tagEq = rules.filter((r) => r.field === "tag" && r.op === "eq");
  const andMode = space.matchMode === "and";

  let files: DriveFile[] = [];
  let truncated = false;

  if (andMode && tagEq.length > 0) {
    const result = await collectByTags(token, tagEq, tags, "and");
    warnings.push(...result.warnings);
    files = result.files;
    truncated = result.truncated;
    if (files.length === 0) {
      return empty(warnings);
    }
  } else if (!andMode && tagEq.length > 0) {
    const tagged = await collectByTags(token, tagEq, tags, "or");
    warnings.push(...tagged.warnings);
    files = tagged.files;
    truncated = tagged.truncated;

    const driveRules = rules.filter((r) => r.field !== "tag");
    if (driveRules.some(canSeedQuery)) {
      const drive = await collectFromDrive(token, driveRules, "or");
      files = unionFiles(files, drive.files);
      truncated = truncated || drive.truncated;
    }
  } else {
    const drive = await collectFromDrive(token, rules, space.matchMode);
    files = drive.files;
    truncated = drive.truncated;
  }

  const matching = files.filter((file) => fileMatchesSpace(file, { matchMode: space.matchMode, rules }, tagsByFileId));
  const unique = dedupeFiles(matching);
  const totalSizeBytes = unique.reduce((sum, f) => {
    const n = f.size ? Number(f.size) : 0;
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  return { files: unique, truncated, warnings: uniqueWarnings(warnings), totalSizeBytes };
}

function empty(warnings: string[]): SpaceQueryResult {
  return { files: [], truncated: false, warnings: uniqueWarnings(warnings), totalSizeBytes: 0 };
}

async function collectByTags(
  token: string,
  tagRules: SpaceRule[],
  tags: Tag[],
  mode: "and" | "or",
): Promise<{ files: DriveFile[]; truncated: boolean; warnings: string[] }> {
  const warnings: string[] = [];
  const existing = tagRules.filter((r) => tags.some((t) => t.id === r.value));
  if (existing.length === 0) {
    return { files: [], truncated: false, warnings: ["A tag used in this space no longer exists."] };
  }
  if (mode === "and" && existing.length !== tagRules.length) {
    return { files: [], truncated: false, warnings: ["A tag used in this space no longer exists."] };
  }

  const sets = await Promise.all(existing.map((r) => getFileIdsForTag(String(r.value))));
  let ids: string[];
  if (mode === "or") {
    ids = [...new Set(sets.flat())];
  } else {
    const [first, ...rest] = sets;
    const restSets = rest.map((s) => new Set(s));
    ids = first.filter((id) => restSets.every((s) => s.has(id)));
  }

  const truncated = ids.length > MAX_TAG_IDS;
  const slice = ids.slice(0, MAX_TAG_IDS);
  if (slice.length === 0) return { files: [], truncated: false, warnings };
  const files = await fetchAllFilesByIds(token, slice);
  return { files: files.filter((f) => !f.trashed), truncated, warnings };
}

async function collectFromDrive(
  token: string,
  rules: SpaceRule[],
  mode: "and" | "or",
): Promise<{ files: DriveFile[]; truncated: boolean }> {
  const clauses = rules.map(ruleToDriveClause).filter((c): c is string => !!c);
  if (clauses.length === 0) return { files: [], truncated: false };

  const joined = mode === "or" && clauses.length > 1
    ? clauses.map((c) => `(${c})`).join(" or ")
    : clauses.join(" and ");
  const q = `trashed = false and (${joined})`;

  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  let truncated = false;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const res = await listFilesByQuery({
      token,
      q,
      pageToken,
      pageSize: PAGE_SIZE,
      orderBy: "modifiedTime desc",
    });
    files.push(...res.files);
    if (!res.nextPageToken) {
      pageToken = undefined;
      break;
    }
    pageToken = res.nextPageToken;
    if (page === MAX_PAGES - 1) truncated = true;
  }

  return { files, truncated };
}

function ruleToDriveClause(rule: SpaceRule): string | null {
  if (!ruleIsValid(rule) || rule.op === "neq") return null;
  switch (rule.field) {
    case "type":
      return isSpaceFileType(String(rule.value)) ? driveMimeClause(rule.value as never) : null;
    case "starred":
      return "starred = true";
    case "name":
      return `name contains '${escapeDriveQueryValue(String(rule.value).trim())}'`;
    case "created":
    case "modified": {
      if (!isSpaceDatePreset(String(rule.value))) return null;
      const bound = datePresetToDriveTime(rule.value as never);
      if (!bound) return null;
      const field = rule.field === "created" ? "createdTime" : "modifiedTime";
      return `${field} ${bound.op} '${bound.iso}'`;
    }
    default:
      return null;
  }
}

function unionFiles(a: DriveFile[], b: DriveFile[]): DriveFile[] {
  return dedupeFiles([...a, ...b]);
}

function dedupeFiles(files: DriveFile[]): DriveFile[] {
  const seen = new Set<string>();
  const out: DriveFile[] = [];
  for (const file of files) {
    if (seen.has(file.id)) continue;
    seen.add(file.id);
    out.push(file);
  }
  return out;
}

function uniqueWarnings(warnings: string[]): string[] {
  return [...new Set(warnings.filter(Boolean))];
}
