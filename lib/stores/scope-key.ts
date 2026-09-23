/** Stable key for selection persistence — one scope = one folder/view context. */
export function buildSelectionScopeKey(opts: {
  sidebarView: string;
  routeFolderId: string | null;
  routeTagIdsKey: string;
  savedViewId: string | null;
  typeCategory?: string | null;
  cleanupKind?: string | null;
  spaceId?: string | null;
}): string {
  if (opts.savedViewId) return `saved:${opts.savedViewId}`;
  if (opts.sidebarView === "tags") return `tags:${opts.routeTagIdsKey || "none"}`;
  if (opts.sidebarView === "type") return `type:${opts.typeCategory ?? "unknown"}`;
  if (opts.sidebarView === "cleanup") return `cleanup:${opts.cleanupKind ?? "overview"}`;
  if (opts.sidebarView === "spaces") return `spaces:${opts.spaceId ?? "index"}`;
  if (opts.sidebarView === "drive") return `drive:${opts.routeFolderId ?? "root"}`;
  if (opts.sidebarView === "dashboard") return "dashboard:root";
  return opts.sidebarView;
}
