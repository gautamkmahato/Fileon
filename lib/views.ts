import type { SidebarView } from "@/lib/navigation";
import type { ViewIconId } from "./view-icons";
import type { Filters } from "./utils/filter";
import { DEFAULT_FILTERS } from "./utils/filter";
import type { SortState } from "./utils/sort";
import { DEFAULT_FILE_SORT } from "./utils/sort";
import type { TagFilterMode } from "./tags";
import type { TypeBrowseCategory } from "./drive/type-browse";
import { TYPE_BROWSE_META } from "./drive/type-browse";
import { openLocalDb, STORE_VIEWS, withStore } from "./local-db";

export type ViewLayout = "grid" | "list";

export interface ViewScope {
  view: Exclude<SidebarView, "activity" | "saved" | "inbox" | "cleanup" | "spaces" | "shared-links">;
  folderId: string | null;
  tagIds: string[];
  tagMode: TagFilterMode;
  typeCategory?: TypeBrowseCategory | null;
}

export interface SavedView {
  id: string;
  name: string;
  emoji?: string;
  icon?: ViewIconId;
  order: number;
  builtIn?: boolean;
  scope: ViewScope;
  filters: Filters;
  search: string;
  sort: SortState;
  layout: ViewLayout;
  createdAt: number;
}

export const BUILTIN_VIEW_IDS = {
  MODIFIED_TODAY: "builtin:modified-today",
  LARGEST_FILES: "builtin:largest-files",
  UNTAGGED: "builtin:untagged",
  SHARED: "builtin:shared-with-me",
} as const;

type ViewsListener = () => void;
const listeners = new Set<ViewsListener>();
let idCounter = 0;
let builtinsEnsured = false;

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeViews(fn: ViewsListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getBuiltinViews(): SavedView[] {
  return [
    {
      id: BUILTIN_VIEW_IDS.MODIFIED_TODAY,
      name: "Modified today",
      emoji: "📅",
      order: 0,
      builtIn: true,
      scope: { view: "recent", folderId: null, tagIds: [], tagMode: "or" },
      filters: { ...DEFAULT_FILTERS, modified: "today" },
      search: "",
      sort: { field: "modified", dir: "desc" },
      layout: "list",
      createdAt: 0,
    },
    {
      id: BUILTIN_VIEW_IDS.LARGEST_FILES,
      name: "Largest files",
      emoji: "📦",
      order: 1,
      builtIn: true,
      scope: { view: "recent", folderId: null, tagIds: [], tagMode: "or" },
      filters: DEFAULT_FILTERS,
      search: "",
      sort: { field: "size", dir: "desc" },
      layout: "list",
      createdAt: 0,
    },
    {
      id: BUILTIN_VIEW_IDS.UNTAGGED,
      name: "Untagged",
      emoji: "🏷️",
      order: 2,
      builtIn: true,
      scope: { view: "recent", folderId: null, tagIds: [], tagMode: "or" },
      filters: { ...DEFAULT_FILTERS, untaggedOnly: true },
      search: "",
      sort: { field: "modified", dir: "desc" },
      layout: "list",
      createdAt: 0,
    },
    {
      id: BUILTIN_VIEW_IDS.SHARED,
      name: "Shared with me",
      emoji: "👥",
      order: 3,
      builtIn: true,
      scope: { view: "recent", folderId: null, tagIds: [], tagMode: "or" },
      filters: { ...DEFAULT_FILTERS, sharedOnly: true },
      search: "",
      sort: { field: "modified", dir: "desc" },
      layout: "list",
      createdAt: 0,
    },
  ];
}

async function ensureBuiltinViews(): Promise<void> {
  if (typeof window === "undefined" || builtinsEnsured) return;
  builtinsEnsured = true;
  const builtins = getBuiltinViews();
  for (const builtin of builtins) {
    const existing = await withStore(STORE_VIEWS, "readonly", (s) => s.get(builtin.id)) as SavedView | undefined;
    if (!existing) {
      await withStore(STORE_VIEWS, "readwrite", (s) => s.put(builtin));
    }
  }
}

export async function listViews(): Promise<SavedView[]> {
  if (typeof window === "undefined") return getBuiltinViews();
  await ensureBuiltinViews();
  const all = await withStore(STORE_VIEWS, "readonly", (s) => s.getAll()) as SavedView[];
  return all.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export async function getView(id: string): Promise<SavedView | null> {
  if (typeof window === "undefined") return getBuiltinViews().find((v) => v.id === id) ?? null;
  await ensureBuiltinViews();
  const view = await withStore(STORE_VIEWS, "readonly", (s) => s.get(id)) as SavedView | undefined;
  return view ?? null;
}

export async function createView(opts: {
  name: string;
  emoji?: string;
  icon?: ViewIconId;
  scope: ViewScope;
  filters: Filters;
  search: string;
  sort: SortState;
  layout: ViewLayout;
}): Promise<SavedView> {
  const trimmed = opts.name.trim();
  if (!trimmed) throw new Error("View name is required");

  const existing = await listViews();
  const maxOrder = existing.reduce((m, v) => Math.max(m, v.order), 0);

  const view: SavedView = {
    id: `view-${Date.now()}-${++idCounter}`,
    name: trimmed,
    emoji: opts.emoji,
    icon: opts.icon,
    order: maxOrder + 1,
    scope: opts.scope,
    filters: opts.filters,
    search: opts.search,
    sort: opts.sort,
    layout: opts.layout,
    createdAt: Date.now(),
  };

  await withStore(STORE_VIEWS, "readwrite", (s) => s.put(view));
  notify();
  return view;
}

export async function updateView(
  id: string,
  patch: Partial<Pick<SavedView, "name" | "emoji" | "icon">>
): Promise<SavedView | null> {
  const existing = await getView(id);
  if (!existing || existing.builtIn) return null;

  const updated: SavedView = { ...existing, ...patch };
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) throw new Error("View name is required");
    updated.name = trimmed;
  }

  await withStore(STORE_VIEWS, "readwrite", (s) => s.put(updated));
  notify();
  return updated;
}

export async function deleteView(id: string): Promise<boolean> {
  const existing = await getView(id);
  if (!existing || existing.builtIn) return false;

  const db = await openLocalDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_VIEWS, "readwrite");
    tx.objectStore(STORE_VIEWS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notify();
  return true;
}

export async function reorderViews(orderedIds: string[]): Promise<void> {
  const all = await listViews();
  const map = new Map(all.map((v) => [v.id, v]));

  await new Promise<void>((resolve, reject) => {
    openLocalDb().then((db) => {
      const tx = db.transaction(STORE_VIEWS, "readwrite");
      const store = tx.objectStore(STORE_VIEWS);
      orderedIds.forEach((id, index) => {
        const view = map.get(id);
        if (view) store.put({ ...view, order: index });
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }).catch(reject);
  });
  notify();
}

export function filtersAreDefault(filters: Filters): boolean {
  return filters.type === "all"
    && filters.modified === "any"
    && filters.source === "all"
    && !filters.sharedOnly
    && !filters.untaggedOnly;
}

export function describeViewScope(scope: ViewScope, tagNames?: string[]): string {
  const parts: string[] = [];
  switch (scope.view) {
    case "drive":
      parts.push(scope.folderId ? "In folder" : "My Drive");
      break;
    case "dashboard":
      parts.push("Dashboard");
      break;
    case "starred":
      parts.push("Starred");
      break;
    case "recent":
      parts.push("Recent");
      break;
    case "trash":
      parts.push("Trash");
      break;
    case "hidden":
      parts.push("Hidden");
      break;
    case "type":
      parts.push(scope.typeCategory ? TYPE_BROWSE_META[scope.typeCategory].label : "Browse by type");
      break;
    case "tags":
      if (tagNames?.length) {
        parts.push(`Tags: ${tagNames.join(scope.tagMode === "and" ? " + " : ", ")}`);
      } else {
        parts.push("Tagged files");
      }
      break;
  }
  return parts.join(" · ");
}
