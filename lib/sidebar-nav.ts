import type { LucideIcon } from "lucide-react";
import {
  Clock, EyeOff, Folder, HardDrive, History, House, Inbox, Keyboard, Layers,
  LayoutDashboard, LayoutGrid, Link2, Settings, Sparkles, Star, Tag, Trash2, Users,
} from "lucide-react";
import { BUILTIN_VIEW_IDS } from "./views";
import { driveRoutes, type ParsedDriveRoute, type SidebarView } from "./navigation";
import { CLEANUP_KIND_META, CLEANUP_NAV_GROUPS } from "./cleanup/kinds";

export const DEFAULT_NAV_SECTION = "home" as const;

export const NAV_SECTIONS = [
  { id: "home", label: "Home", icon: House },
  { id: "files", label: "Files", icon: HardDrive },
  { id: "browse", label: "Browse", icon: Layers },
  { id: "organize", label: "Organize", icon: Tag },
  { id: "cleanup", label: "Cleanup", icon: Sparkles },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

export type NavSectionId = (typeof NAV_SECTIONS)[number]["id"];
export type NavSection = (typeof NAV_SECTIONS)[number];

export type NavActionId = "open-all-folders";
export type NavExtraId = "browse" | "tags" | "views" | "spaces" | "favorites" | "recent-folders";

export type StaticNavItem =
  | {
      kind: "link";
      id: string;
      label: string;
      href: string;
      icon: LucideIcon;
      match: (route: ParsedDriveRoute) => boolean;
    }
  | {
      kind: "action";
      id: NavActionId;
      label: string;
      icon: LucideIcon;
      trailing?: "chevron";
    }
  | {
      kind: "heading";
      id: string;
      label: string;
    };

const SECTION_BY_ID = new Map<NavSectionId, NavSection>(
  NAV_SECTIONS.map((section) => [section.id, section]),
);

const VIEW_SECTION: Record<SidebarView, NavSectionId> = {
  dashboard: "home",
  recent: "home",
  starred: "home",
  inbox: "home",
  drive: "files",
  trash: "files",
  type: "browse",
  tags: "organize",
  saved: "organize",
  cleanup: "cleanup",
  spaces: "organize",
  "shared-links": "home",
  activity: "settings",
  hidden: "settings",
  controls: "settings",
};

/** Saved views that live outside the default Organize section. */
const SAVED_VIEW_SECTION: Record<string, NavSectionId> = {
  [BUILTIN_VIEW_IDS.SHARED]: "home",
};

export const ORGANIZE_BUILTIN_VIEW_IDS = [
  BUILTIN_VIEW_IDS.MODIFIED_TODAY,
  BUILTIN_VIEW_IDS.LARGEST_FILES,
  BUILTIN_VIEW_IDS.UNTAGGED,
] as const;

export const SECTION_LINKS: Record<NavSectionId, StaticNavItem[]> = {
  home: [
    {
      kind: "link",
      id: "inbox",
      label: "Inbox",
      href: driveRoutes.inbox,
      icon: Inbox,
      match: (r) => r.view === "inbox",
    },
    {
      kind: "link",
      id: "dashboard",
      label: "Dashboard",
      href: driveRoutes.dashboard,
      icon: LayoutDashboard,
      match: (r) => r.view === "dashboard",
    },
    {
      kind: "link",
      id: "recent",
      label: "Recent",
      href: driveRoutes.recent,
      icon: Clock,
      match: (r) => r.view === "recent",
    },
    {
      kind: "link",
      id: "starred",
      label: "Starred",
      href: driveRoutes.starred,
      icon: Star,
      match: (r) => r.view === "starred",
    },
    {
      kind: "link",
      id: "shared",
      label: "Shared with me",
      href: driveRoutes.view(BUILTIN_VIEW_IDS.SHARED),
      icon: Users,
      match: (r) => r.view === "saved" && r.savedViewId === BUILTIN_VIEW_IDS.SHARED,
    },
    {
      kind: "link",
      id: "shared-links",
      label: "Shared links",
      href: driveRoutes.sharedLinks,
      icon: Link2,
      match: (r) => r.view === "shared-links",
    },
  ],
  files: [
    {
      kind: "link",
      id: "my-drive",
      label: "My Drive",
      href: driveRoutes.myDrive,
      icon: HardDrive,
      match: (r) => r.view === "drive" && !r.folderId,
    },
    {
      kind: "action",
      id: "open-all-folders",
      label: "All folders",
      icon: Folder,
      trailing: "chevron",
    },
    {
      kind: "link",
      id: "trash",
      label: "Trash",
      href: driveRoutes.trash,
      icon: Trash2,
      match: (r) => r.view === "trash",
    },
  ],
  browse: [],
  organize: [
    {
      kind: "link",
      id: "spaces",
      label: "Smart Spaces",
      href: driveRoutes.spaces,
      icon: LayoutGrid,
      match: (r) => r.view === "spaces" && !r.spaceId,
    },
  ],
  cleanup: CLEANUP_NAV_GROUPS.flatMap((group) => {
    const links: StaticNavItem[] = group.kinds.map((kind) => {
      const meta = CLEANUP_KIND_META[kind];
      return {
        kind: "link" as const,
        id: `cleanup-${kind}`,
        label: meta.label,
        href: driveRoutes.cleanupKind(kind),
        icon: meta.icon,
        match: (r: ParsedDriveRoute) => r.view === "cleanup" && (r.cleanupKind ?? "overview") === kind,
      };
    });
    if (!group.label) return links;
    return [{ kind: "heading" as const, id: `cleanup-h-${group.id}`, label: group.label }, ...links];
  }),
  settings: [
    {
      kind: "link",
      id: "activity",
      label: "Activity",
      href: driveRoutes.activity,
      icon: History,
      match: (r) => r.view === "activity",
    },
    {
      kind: "link",
      id: "hidden",
      label: "Hidden",
      href: driveRoutes.hidden,
      icon: EyeOff,
      match: (r) => r.view === "hidden",
    },
    {
      kind: "link",
      id: "controls",
      label: "Controls",
      href: driveRoutes.controls,
      icon: Keyboard,
      match: (r) => r.view === "controls",
    },
  ],
};

export const SECTION_EXTRAS: Record<NavSectionId, NavExtraId[]> = {
  home: [],
  files: ["favorites", "recent-folders"],
  browse: ["browse"],
  organize: ["spaces", "tags", "views"],
  cleanup: [],
  settings: [],
};

export function isNavSectionId(value: string | null | undefined): value is NavSectionId {
  return !!value && SECTION_BY_ID.has(value as NavSectionId);
}

export function getNavSection(id: string | null | undefined): NavSection {
  if (isNavSectionId(id)) return SECTION_BY_ID.get(id) ?? NAV_SECTIONS[0];
  return SECTION_BY_ID.get(DEFAULT_NAV_SECTION) ?? NAV_SECTIONS[0];
}

export function sectionFromRoute(view: SidebarView, savedViewId: string | null): NavSectionId {
  if (view === "saved" && savedViewId && isNavSectionId(SAVED_VIEW_SECTION[savedViewId])) {
    return SAVED_VIEW_SECTION[savedViewId];
  }
  return VIEW_SECTION[view] ?? DEFAULT_NAV_SECTION;
}

export function sectionLinks(id: NavSectionId): StaticNavItem[] {
  return SECTION_LINKS[id] ?? [];
}

export function sectionExtras(id: NavSectionId): NavExtraId[] {
  return SECTION_EXTRAS[id] ?? [];
}

export function displayLabel(value: string | null | undefined, fallback = "Untitled"): string {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

export function parseQuotaBytes(value: string | null | undefined): number {
  if (!value) return 0;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
