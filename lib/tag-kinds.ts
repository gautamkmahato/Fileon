interface TagLike {
  id: string;
  name: string;
  kind?: string;
  builtIn?: boolean;
  emoji?: string;
  order?: number;
}

export const TAG_KINDS = ["status", "system", "people", "project", "user"] as const;
export type TagKind = (typeof TAG_KINDS)[number];

export const EXCLUSIVE_TAG_KINDS: ReadonlySet<TagKind> = new Set(["status"]);

export const TAG_KIND_META: Record<TagKind, { label: string; hint: string; creatable: boolean }> = {
  status: { label: "Status", hint: "One status per file", creatable: true },
  system: { label: "System", hint: "Built-in file labels", creatable: false },
  people: { label: "People", hint: "Who this belongs to", creatable: true },
  project: { label: "Project", hint: "Which project this is for", creatable: true },
  user: { label: "Labels", hint: "Your own tags", creatable: true },
};

export interface BuiltinTagSpec {
  id: string;
  name: string;
  kind: TagKind;
  colorId: string;
  emoji: string;
  order: number;
  builtIn: true;
}

export const BUILTIN_TAGS: BuiltinTagSpec[] = [
  { id: "builtin:system:document", name: "Document", kind: "system", colorId: "blue", emoji: "📄", order: 0, builtIn: true },
  { id: "builtin:system:invoice", name: "Invoice", kind: "system", colorId: "amber", emoji: "🧾", order: 1, builtIn: true },
  { id: "builtin:system:contract", name: "Contract", kind: "system", colorId: "indigo", emoji: "📑", order: 2, builtIn: true },
  { id: "builtin:system:photo", name: "Photo", kind: "system", colorId: "pink", emoji: "📸", order: 3, builtIn: true },
  { id: "builtin:system:video", name: "Video", kind: "system", colorId: "purple", emoji: "🎥", order: 4, builtIn: true },
  { id: "builtin:system:audio", name: "Audio", kind: "system", colorId: "teal", emoji: "🎵", order: 5, builtIn: true },
  { id: "builtin:system:archive", name: "Archive", kind: "system", colorId: "orange", emoji: "📦", order: 6, builtIn: true },

  { id: "builtin:status:draft", name: "Draft", kind: "status", colorId: "yellow", emoji: "🟡", order: 0, builtIn: true },
  { id: "builtin:status:review", name: "In Review", kind: "status", colorId: "blue", emoji: "🔵", order: 1, builtIn: true },
  { id: "builtin:status:approved", name: "Approved", kind: "status", colorId: "green", emoji: "🟢", order: 2, builtIn: true },
  { id: "builtin:status:rejected", name: "Rejected", kind: "status", colorId: "red", emoji: "🔴", order: 3, builtIn: true },
  { id: "builtin:status:archived", name: "Archived", kind: "status", colorId: "zinc", emoji: "⚪", order: 4, builtIn: true },
];

export const MAX_TAGS = 200;
export const MAX_TAGS_PER_FILE = 40;
export const MAX_TAG_NAME_LEN = 48;

export function isTagKind(value: string | null | undefined): value is TagKind {
  return !!value && (TAG_KINDS as readonly string[]).includes(value);
}

export function tagKind(tag: Pick<TagLike, "kind"> | null | undefined): TagKind {
  return isTagKind(tag?.kind) ? tag.kind : "user";
}

export function isExclusiveKind(kind: TagKind): boolean {
  return EXCLUSIVE_TAG_KINDS.has(kind);
}

export function isBuiltinTag(tag: Pick<TagLike, "builtIn" | "id"> | null | undefined): boolean {
  return !!tag && (tag.builtIn === true || tag.id.startsWith("builtin:"));
}

export function kindOrder(kind: TagKind): number {
  return TAG_KINDS.indexOf(kind);
}

export function compareTags(a: TagLike, b: TagLike): number {
  const kindDiff = kindOrder(tagKind(a)) - kindOrder(tagKind(b));
  if (kindDiff !== 0) return kindDiff;
  const orderDiff = (a.order ?? 0) - (b.order ?? 0);
  if (orderDiff !== 0) return orderDiff;
  return a.name.localeCompare(b.name);
}

export function groupTagsByKind<T extends TagLike>(tags: T[]): Map<TagKind, T[]> {
  const map = new Map<TagKind, T[]>();
  for (const kind of TAG_KINDS) map.set(kind, []);
  for (const tag of tags) {
    map.get(tagKind(tag))!.push(tag);
  }
  for (const list of map.values()) {
    list.sort(compareTags);
  }
  return map;
}

export function displayTagName(tag: TagLike): string {
  const kind = tagKind(tag);
  const name = tag.name.trim() || "Untitled";
  if (kind === "user" && !name.startsWith("#")) return `#${name}`;
  if (kind === "project" && !/^project:\s*/i.test(name)) return `Project: ${name}`;
  return name;
}

export function tagShortLabel(tag: TagLike): string {
  if (tag.emoji) return `${tag.emoji} ${displayTagName(tag)}`;
  return displayTagName(tag);
}

/** Map a Drive MIME type to built-in system tag ids (suggestions only). */
export function suggestedSystemTagIds(mimeType: string | null | undefined): string[] {
  if (!mimeType) return [];
  if (mimeType === "application/vnd.google-apps.folder") return [];
  if (mimeType.startsWith("image/")) return ["builtin:system:photo"];
  if (mimeType.startsWith("video/")) return ["builtin:system:video"];
  if (mimeType.startsWith("audio/")) return ["builtin:system:audio"];
  if (
    mimeType === "application/zip"
    || mimeType.includes("compressed")
    || mimeType.includes("tar")
    || mimeType === "application/gzip"
  ) {
    return ["builtin:system:archive"];
  }
  if (mimeType === "application/pdf" || mimeType.includes("wordprocessing") || mimeType.includes("document")) {
    return ["builtin:system:document"];
  }
  if (mimeType.startsWith("application/vnd.google-apps.")) {
    return ["builtin:system:document"];
  }
  return [];
}

export function normalizeTagName(raw: string, kind: TagKind): string {
  let name = raw.replace(/\u0000/g, "").trim();
  if (kind === "user") name = name.replace(/^#+/, "").trim();
  if (kind === "project") name = name.replace(/^project:\s*/i, "").trim();
  name = name.replace(/\s+/g, " ");
  return name.slice(0, MAX_TAG_NAME_LEN);
}
