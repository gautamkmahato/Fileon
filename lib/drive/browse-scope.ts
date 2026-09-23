import type { SidebarView } from "@/lib/navigation";

/** Folder browsing views — upload, pins, cut/paste, folder grid. */
export function isFolderBrowseView(view: SidebarView): boolean {
  return view === "drive" || view === "dashboard";
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
