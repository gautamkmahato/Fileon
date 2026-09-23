import type { TagFilterMode } from "./tags";
import type { TypeBrowseCategory } from "./drive/type-browse";
import { isTypeBrowseCategory } from "./drive/type-browse";
import { isCleanupKind, type CleanupKind } from "./cleanup/kinds";

export type SidebarView =
  | "dashboard"
  | "drive"
  | "starred"
  | "recent"
  | "trash"
  | "activity"
  | "hidden"
  | "controls"
  | "inbox"
  | "type"
  | "tags"
  | "saved"
  | "cleanup"
  | "spaces"
  | "shared-links";

export const driveRoutes = {
  dashboard: "/dashboard",
  myDrive: "/my-drive",
  /** @deprecated Use dashboard or myDrive */
  drive: "/dashboard",
  folder: (folderId: string) => `/my-drive/folders/${folderId}`,
  starred: "/starred",
  recent: "/recent",
  trash: "/trash",
  activity: "/activity",
  hidden: "/hidden",
  inbox: "/inbox",
  controls: "/controls",
  cleanup: "/cleanup",
  cleanupKind: (kind: CleanupKind) => (kind === "overview" ? "/cleanup" : `/cleanup/${kind}`),
  typeBrowse: (category: TypeBrowseCategory) => `/type/${category}`,
  tags: "/tags",
  tag: (tagId: string) => `/tags/${tagId}`,
  tagFilter: (tagIds: string[], mode: TagFilterMode = "or") => {
    const params = new URLSearchParams({ ids: tagIds.join(","), mode });
    return `/tags?${params.toString()}`;
  },
  view: (viewId: string) => `/views/${viewId}`,
  spaces: "/spaces",
  space: (spaceId: string) => `/spaces/${spaceId}`,
  sharedLinks: "/shared-links",
} as const;

export function routeForView(view: SidebarView, folderId?: string | null): string {
  switch (view) {
    case "dashboard":
      return driveRoutes.dashboard;
    case "drive":
      return folderId ? driveRoutes.folder(folderId) : driveRoutes.myDrive;
    case "starred":
      return driveRoutes.starred;
    case "recent":
      return driveRoutes.recent;
    case "trash":
      return driveRoutes.trash;
    case "activity":
      return driveRoutes.activity;
    case "hidden":
      return driveRoutes.hidden;
    case "inbox":
      return driveRoutes.inbox;
    case "controls":
      return driveRoutes.controls;
    case "cleanup":
      return driveRoutes.cleanup;
    case "spaces":
      return driveRoutes.spaces;
    case "shared-links":
      return driveRoutes.sharedLinks;
    case "type":
      return driveRoutes.typeBrowse("images");
    case "tags":
      return driveRoutes.tags;
    case "saved":
      return driveRoutes.dashboard;
    default:
      return driveRoutes.dashboard;
  }
}

export interface ParsedDriveRoute {
  view: SidebarView;
  folderId: string | null;
  tagIds: string[];
  tagMode: TagFilterMode;
  savedViewId: string | null;
  typeCategory: TypeBrowseCategory | null;
  cleanupKind: CleanupKind | null;
  spaceId: string | null;
}

function route(view: SidebarView, extra: Partial<ParsedDriveRoute> = {}): ParsedDriveRoute {
  return {
    view,
    folderId: null,
    tagIds: [],
    tagMode: "or",
    savedViewId: null,
    typeCategory: null,
    cleanupKind: null,
    spaceId: null,
    ...extra,
  };
}

export function parseDriveRoute(pathname: string, search = ""): ParsedDriveRoute {
  const params = new URLSearchParams(search);

  if (pathname === driveRoutes.starred) return route("starred");
  if (pathname === driveRoutes.recent) return route("recent");
  if (pathname === driveRoutes.trash) return route("trash");
  if (pathname === driveRoutes.activity) return route("activity");
  if (pathname === driveRoutes.hidden) return route("hidden");
  if (pathname === driveRoutes.inbox) return route("inbox");
  if (pathname === driveRoutes.controls) return route("controls");
  if (pathname === driveRoutes.cleanup) return route("cleanup", { cleanupKind: "overview" });
  if (pathname === driveRoutes.dashboard || pathname === "/drive") {
    return route("dashboard");
  }
  if (pathname === driveRoutes.myDrive) {
    return route("drive");
  }

  const cleanupMatch = pathname.match(/^\/cleanup\/([^/]+)$/);
  if (cleanupMatch) {
    const kind = isCleanupKind(cleanupMatch[1]) ? cleanupMatch[1] : "overview";
    return route("cleanup", { cleanupKind: kind });
  }

  if (pathname === driveRoutes.spaces) return route("spaces");
  const spaceMatch = pathname.match(/^\/spaces\/([^/]+)$/);
  if (spaceMatch) return route("spaces", { spaceId: spaceMatch[1] });

  if (pathname === driveRoutes.sharedLinks) return route("shared-links");

  const typeMatch = pathname.match(/^\/type\/([^/]+)$/);
  if (typeMatch && isTypeBrowseCategory(typeMatch[1])) {
    return route("type", { typeCategory: typeMatch[1] });
  }

  const viewMatch = pathname.match(/^\/views\/([^/]+)$/);
  if (viewMatch) {
    return route("saved", { savedViewId: viewMatch[1] });
  }

  const folderMatch = pathname.match(/^\/my-drive\/folders\/([^/]+)$/);
  if (folderMatch) return route("drive", { folderId: folderMatch[1] });

  const legacyFolderMatch = pathname.match(/^\/drive\/folders\/([^/]+)$/);
  if (legacyFolderMatch) return route("drive", { folderId: legacyFolderMatch[1] });

  if (pathname === driveRoutes.tags) {
    const ids = params.get("ids")?.split(",").filter(Boolean) ?? [];
    const mode = params.get("mode") === "and" ? "and" : "or";
    return route("tags", { tagIds: ids, tagMode: mode });
  }

  const tagMatch = pathname.match(/^\/tags\/([^/]+)$/);
  if (tagMatch) {
    return route("tags", { tagIds: [tagMatch[1]] });
  }

  return route("dashboard");
}
