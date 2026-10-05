import type { SidebarView } from "@/lib/navigation/routes";

/** Folder browsing views — upload, pins, cut/paste, folder grid. */
export function isFolderBrowseView(view: SidebarView): boolean {
  return view === "drive" || view === "dashboard";
}

/** Views where window drag-drop and command-palette upload are allowed. */
export function canUploadToDrive(opts: {
  isTrashView: boolean;
  isActivityView: boolean;
  isInboxView: boolean;
  isControlsView: boolean;
  isCleanupView: boolean;
  isSpacesHome: boolean;
  isSharedLinksView: boolean;
}): boolean {
  if (
    opts.isTrashView
    || opts.isActivityView
    || opts.isInboxView
    || opts.isControlsView
    || opts.isCleanupView
    || opts.isSpacesHome
    || opts.isSharedLinksView
  ) {
    return false;
  }
  return true;
}

/** Drive parent folder for uploads from the current route. */
export function resolveUploadParentId(opts: {
  sidebarView: SidebarView;
  routeFolderId: string | null;
  isSavedView: boolean;
  savedFolderId: string | null;
}): string | null {
  if (opts.sidebarView === "drive") return opts.routeFolderId;
  if (opts.isSavedView && opts.savedFolderId) return opts.savedFolderId;
  return null;
}

export function isDashboardRoot(view: SidebarView, folderId: string | null): boolean {
  return view === "dashboard" && !folderId;
}

export function rootCrumbLabel(view: SidebarView): string {
  if (view === "dashboard") return "Dashboard";
  if (view === "hidden") return "Hidden";
  if (view === "inbox") return "Inbox";
  return "My Drive";
}
