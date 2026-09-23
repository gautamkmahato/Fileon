import type { TagIconId } from "./tag-colors";
import { defaultTagColorId } from "./tag-colors";
import { openLocalDb, STORE_FILE_TAGS, STORE_TAGS, withStore } from "./local-db";
import { logTagCreated, logTagDeleted, logTagUpdated } from "./tag-activity";
import {
  BUILTIN_TAGS,
  MAX_TAG_NAME_LEN,
  MAX_TAGS,
  MAX_TAGS_PER_FILE,
  compareTags,
  isBuiltinTag,
  isExclusiveKind,
  isTagKind,
  normalizeTagName,
  tagKind,
  type TagKind,
} from "./tag-kinds";

export interface Tag {
  id: string;
  name: string;
  colorId: string;
  icon?: TagIconId;
  kind?: TagKind;
  emoji?: string;
  builtIn?: boolean;
  order?: number;
  createdAt: number;
}

export interface FileTag {
  key: string;
  fileId: string;
  tagId: string;
}

export type TagFilterMode = "and" | "or";

type TagsListener = () => void;
const listeners = new Set<TagsListener>();

function fileTagKey(fileId: string, tagId: string): string {
  return `${fileId}::${tagId}`;
}

let idCounter = 0;
let builtinsEnsured = false;

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeTags(fn: TagsListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function hydrateTag(raw: Tag): Tag {
  const builtin = isBuiltinTag(raw);
  const spec = builtin ? BUILTIN_TAGS.find((s) => s.id === raw.id) : undefined;
  return {
    ...raw,
    kind: spec?.kind ?? tagKind(raw),
    builtIn: builtin,
    emoji: raw.emoji || spec?.emoji,
    order: raw.order ?? spec?.order,
    name: (raw.name ?? "").trim() || spec?.name || "Untitled",
  };
}

/** Keep at most one tag per exclusive kind (status). First in list wins. */
function collapseExclusive(tags: Tag[]): Tag[] {
  const seen = new Set<TagKind>();
  const out: Tag[] = [];
  for (const tag of tags) {
    const kind = tagKind(tag);
    if (isExclusiveKind(kind)) {
      if (seen.has(kind)) continue;
      seen.add(kind);
    }
    out.push(tag);
  }
  return out;
}

export async function listTags(): Promise<Tag[]> {
  if (typeof window === "undefined") return [];
  const all = await withStore(STORE_TAGS, "readonly", (s) => s.getAll()) as Tag[];
  return all.map(hydrateTag).sort(compareTags);
}

export async function getTag(id: string): Promise<Tag | null> {
  const tag = await withStore(STORE_TAGS, "readonly", (s) => s.get(id)) as Tag | undefined;
  return tag ? hydrateTag(tag) : null;
}

export async function ensureBuiltinTags(): Promise<void> {
  if (builtinsEnsured || typeof window === "undefined") return;
  try {
    const existing = await withStore(STORE_TAGS, "readonly", (s) => s.getAll()) as Tag[];
    const byId = new Map(existing.map((t) => [t.id, t]));
    const kindNames = new Set(
      existing.map((t) => `${tagKind(t)}:${t.name.trim().toLowerCase()}`),
    );
    const writes: Tag[] = [];

    for (const spec of BUILTIN_TAGS) {
      const found = byId.get(spec.id);
      if (found) {
        if (
          found.kind !== spec.kind
          || found.builtIn !== true
          || !found.emoji
          || found.order === undefined
        ) {
          writes.push({
            ...found,
            name: (found.name ?? "").trim() || spec.name,
            colorId: found.colorId || spec.colorId,
            kind: spec.kind,
            emoji: found.emoji || spec.emoji,
            builtIn: true,
            order: found.order ?? spec.order,
            createdAt: found.createdAt ?? 0,
          });
        }
        continue;
      }
      if (kindNames.has(`${spec.kind}:${spec.name.toLowerCase()}`)) continue;
      writes.push({
        id: spec.id,
        name: spec.name,
        colorId: spec.colorId,
        kind: spec.kind,
        emoji: spec.emoji,
        builtIn: true,
        order: spec.order,
        createdAt: 0,
      });
    }

    if (writes.length > 0) {
      const db = await openLocalDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_TAGS, "readwrite");
        const store = tx.objectStore(STORE_TAGS);
        for (const tag of writes) store.put(tag);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      notify();
    }
    builtinsEnsured = true;
  } catch (err) {
    console.error(err);
    builtinsEnsured = true;
  }
}

export async function createTag(opts: {
  name: string;
  colorId?: string;
  icon?: TagIconId;
  kind?: TagKind;
  emoji?: string;
}): Promise<Tag> {
  const kind: TagKind = opts.kind && isTagKind(opts.kind) && opts.kind !== "system"
    ? opts.kind
    : "user";
  const trimmed = normalizeTagName(opts.name, kind);
  if (!trimmed) throw new Error("Tag name is required");

  const existing = await listTags();
  if (existing.length >= MAX_TAGS) {
    throw new Error(`You can have at most ${MAX_TAGS} tags`);
  }
  const clash = existing.find(
    (t) => tagKind(t) === kind && t.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (clash) throw new Error("A tag with that name already exists in this group");

  const tag: Tag = {
    id: `tag-${Date.now()}-${++idCounter}`,
    name: trimmed,
    colorId: opts.colorId ?? defaultTagColorId(),
    icon: opts.icon,
    kind,
    emoji: sanitizeEmoji(opts.emoji),
    builtIn: false,
    order: existing.filter((t) => tagKind(t) === kind).length,
    createdAt: Date.now(),
  };
  await withStore(STORE_TAGS, "readwrite", (s) => s.put(tag));
  notify();
  void logTagCreated(trimmed);
  return tag;
}

export async function updateTag(
  id: string,
  patch: Partial<Pick<Tag, "name" | "colorId" | "icon" | "emoji" | "kind">>
): Promise<Tag | null> {
  const existing = await getTag(id);
  if (!existing) return null;

  const builtin = isBuiltinTag(existing);
  const nextKind = builtin
    ? tagKind(existing)
    : (patch.kind && isTagKind(patch.kind) && patch.kind !== "system" ? patch.kind : tagKind(existing));
  const nextName = builtin
    ? existing.name
    : (patch.name !== undefined ? normalizeTagName(patch.name, nextKind) : existing.name);
  if (!nextName) throw new Error("Tag name is required");

  if (!builtin && (nextName.toLowerCase() !== existing.name.toLowerCase() || nextKind !== tagKind(existing))) {
    const all = await listTags();
    const clash = all.find(
      (t) => t.id !== id && tagKind(t) === nextKind && t.name.toLowerCase() === nextName.toLowerCase(),
    );
    if (clash) throw new Error("A tag with that name already exists in this group");
  }

  const updated: Tag = {
    ...existing,
    colorId: patch.colorId ?? existing.colorId,
    icon: patch.icon !== undefined ? patch.icon : existing.icon,
    emoji: patch.emoji !== undefined ? sanitizeEmoji(patch.emoji) : existing.emoji,
    kind: nextKind,
    name: nextName.slice(0, MAX_TAG_NAME_LEN),
    builtIn: builtin,
  };
  await withStore(STORE_TAGS, "readwrite", (s) => s.put(updated));

  if (isExclusiveKind(nextKind) && tagKind(existing) !== nextKind) {
    const fileIds = await getFileIdsForTag(id);
    for (const fileId of fileIds) {
      const current = await listTagsForFileRaw(fileId);
      for (const t of current) {
        if (t.id !== id && tagKind(t) === nextKind) {
          await deleteFileTag(fileId, t.id);
        }
      }
    }
  }

  notify();
  void logTagUpdated({
    oldName: existing.name,
    newName: updated.name,
    colorChanged: existing.colorId !== updated.colorId,
  });
  return updated;
}

export async function deleteTag(id: string): Promise<void> {
  const existing = await getTag(id);
  if (!existing) return;
  if (isBuiltinTag(existing)) {
    throw new Error("Built-in tags cannot be deleted");
  }
  const db = await openLocalDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_TAGS, STORE_FILE_TAGS], "readwrite");
    tx.objectStore(STORE_TAGS).delete(id);
    const index = tx.objectStore(STORE_FILE_TAGS).index("tagId");
    const req = index.openCursor(IDBKeyRange.only(id));
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notify();
  void logTagDeleted(existing.name);
}

export async function listAllFileTags(): Promise<FileTag[]> {
  if (typeof window === "undefined") return [];
  return withStore(STORE_FILE_TAGS, "readonly", (s) => s.getAll()) as Promise<FileTag[]>;
}

async function listTagsForFileRaw(fileId: string): Promise<Tag[]> {
  const links = await withStore(STORE_FILE_TAGS, "readonly", (s) =>
    s.index("fileId").getAll(fileId)
  ) as FileTag[];
  const tags = await Promise.all(links.map((l) => getTag(l.tagId)));
  return tags.filter((t): t is Tag => t !== null);
}

export async function getTagsForFile(fileId: string): Promise<Tag[]> {
  return collapseExclusive((await listTagsForFileRaw(fileId)).sort(compareTags));
}

export async function getFileIdsForTag(tagId: string): Promise<string[]> {
  const links = await withStore(STORE_FILE_TAGS, "readonly", (s) =>
    s.index("tagId").getAll(tagId)
  ) as FileTag[];
  return links.map((l) => l.fileId);
}

export async function getFileIdsForTags(
  tagIds: string[],
  mode: TagFilterMode
): Promise<string[]> {
  if (!tagIds.length) return [];
  if (tagIds.length === 1) return getFileIdsForTag(tagIds[0]);

  const sets = await Promise.all(tagIds.map(getFileIdsForTag));
  if (mode === "or") {
    return [...new Set(sets.flat())];
  }
  const [first, ...rest] = sets;
  const firstSet = new Set(first);
  const restSets = rest.map((s) => new Set(s));
  return [...firstSet].filter((id) => restSets.every((s) => s.has(id)));
}

/** Whether a file still belongs in a tag-scoped browse view. */
export function fileMatchesTagScope(
  fileId: string,
  tagsByFileId: Map<string, Tag[]>,
  tagIds: string[],
  mode: TagFilterMode,
): boolean {
  if (!tagIds.length) return false;
  const fileTagIds = new Set((tagsByFileId.get(fileId) ?? []).map((t) => t.id));
  if (mode === "or") {
    return tagIds.some((id) => fileTagIds.has(id));
  }
  return tagIds.every((id) => fileTagIds.has(id));
}

export async function getTagCounts(): Promise<Map<string, number>> {
  const links = await listAllFileTags();
  const counts = new Map<string, number>();
  for (const l of links) {
    counts.set(l.tagId, (counts.get(l.tagId) ?? 0) + 1);
  }
  return counts;
}

export async function getTagsByFileIdMap(): Promise<Map<string, Tag[]>> {
  const [tags, links] = await Promise.all([listTags(), listAllFileTags()]);
  const tagMap = new Map(tags.map((t) => [t.id, t]));
  const result = new Map<string, Tag[]>();
  for (const link of links) {
    const tag = tagMap.get(link.tagId);
    if (!tag) continue;
    const arr = result.get(link.fileId) ?? [];
    arr.push(tag);
    result.set(link.fileId, arr);
  }
  for (const [fileId, arr] of result) {
    arr.sort(compareTags);
    result.set(fileId, collapseExclusive(arr));
  }
  return result;
}

async function putFileTag(fileId: string, tagId: string): Promise<void> {
  const entry: FileTag = { key: fileTagKey(fileId, tagId), fileId, tagId };
  await withStore(STORE_FILE_TAGS, "readwrite", (s) => s.put(entry));
}

async function deleteFileTag(fileId: string, tagId: string): Promise<void> {
  await withStore(STORE_FILE_TAGS, "readwrite", (s) => s.delete(fileTagKey(fileId, tagId)));
}

/** Apply one tag to a file. Exclusive kinds (status) replace siblings. */
async function applyTagToFile(fileId: string, tag: Tag): Promise<void> {
  const current = await listTagsForFileRaw(fileId);
  if (current.some((t) => t.id === tag.id)) return;

  const kind = tagKind(tag);
  const toRemove = isExclusiveKind(kind)
    ? current.filter((t) => tagKind(t) === kind)
    : [];
  const nextCount = current.length - toRemove.length + 1;
  if (nextCount > MAX_TAGS_PER_FILE) {
    throw new Error(`A file can have at most ${MAX_TAGS_PER_FILE} tags`);
  }
  for (const t of toRemove) {
    await deleteFileTag(fileId, t.id);
  }
  await putFileTag(fileId, tag.id);
}

export async function addTagToFile(fileId: string, tagId: string): Promise<void> {
  const tag = await getTag(tagId);
  if (!tag) return;
  await applyTagToFile(fileId, tag);
  notify();
}

export async function removeTagFromFile(fileId: string, tagId: string): Promise<void> {
  await deleteFileTag(fileId, tagId);
  notify();
}

export async function setFileTags(fileId: string, tagIds: string[]): Promise<void> {
  const unique = [...new Set(tagIds.filter(Boolean))];
  const resolved = (await Promise.all(unique.map(getTag))).filter((t): t is Tag => t !== null);
  const kept: Tag[] = [];
  const seenExclusive = new Set<TagKind>();
  for (let i = resolved.length - 1; i >= 0; i -= 1) {
    const tag = resolved[i];
    const kind = tagKind(tag);
    if (isExclusiveKind(kind)) {
      if (seenExclusive.has(kind)) continue;
      seenExclusive.add(kind);
    }
    kept.push(tag);
  }
  kept.reverse();
  if (kept.length > MAX_TAGS_PER_FILE) {
    throw new Error(`A file can have at most ${MAX_TAGS_PER_FILE} tags`);
  }

  const db = await openLocalDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_FILE_TAGS, "readwrite");
    const store = tx.objectStore(STORE_FILE_TAGS);
    const index = store.index("fileId");
    const req = index.openCursor(IDBKeyRange.only(fileId));
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  for (const tag of kept) {
    await putFileTag(fileId, tag.id);
  }
  notify();
}

export async function bulkAddTag(fileIds: string[], tagId: string): Promise<void> {
  const tag = await getTag(tagId);
  if (!tag) return;
  for (const fileId of fileIds) {
    await applyTagToFile(fileId, tag);
  }
  notify();
}

export async function bulkRemoveTag(fileIds: string[], tagId: string): Promise<void> {
  for (const fileId of fileIds) {
    await deleteFileTag(fileId, tagId);
  }
  notify();
}

export async function removeAllTagsForFile(fileId: string): Promise<void> {
  const links = await withStore(STORE_FILE_TAGS, "readonly", (s) =>
    s.index("fileId").getAll(fileId)
  ) as FileTag[];
  for (const l of links) {
    await deleteFileTag(fileId, l.tagId);
  }
  notify();
}

function sanitizeEmoji(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.replace(/\u0000/g, "").trim().slice(0, 8);
  return trimmed || undefined;
}
