"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTypeBrowseCounts } from "@/lib/hooks/useTypeBrowseCounts";
import { driveRoutes, parseDriveRoute } from "@/lib/navigation";
import {
  getNavSection,
  NAV_SECTIONS,
  sectionExtras,
  sectionFromRoute,
  sectionLinks,
  type NavActionId,
  type NavSectionId,
} from "@/lib/sidebar-nav";
import { deleteView, reorderViews, type SavedView } from "@/lib/views";
import type { SmartSpace } from "@/lib/spaces";
import { toast } from "@/lib/toast";
import type { StorageQuota } from "@/lib/drive/drive";
import { useTags } from "../../tags/TagsProvider";
import { useViews } from "../../views/ViewsProvider";
import { useSpaces } from "../../spaces/SpacesProvider";
import { ViewContextMenu } from "../../views/ViewContextMenu";
import { ViewRenameModal } from "../../views/ViewRenameModal";
import { ConfirmModal } from "../../ui/Dialogs";
import { AllFoldersModal } from "../AllFoldersModal";
import { CollapseToggle, EmptyHint, NavButton, NavLink } from "./items";
import { renderNavExtra, type SidebarExtrasProps } from "./extras";
import { StorageCard } from "./StorageCard";
import { useFolderShortcuts } from "./use-folder-shortcuts";

interface SidebarProps {
  collapsed: boolean;
  quota: StorageQuota | null;
  token: string | null;
  onFolderDrop?: (e: React.DragEvent, folderId: string) => void;
  onToggleCollapse: () => void;
  onManageTags: () => void;
}

export function Sidebar({
  collapsed, quota, token, onFolderDrop, onToggleCollapse, onManageTags,
}: SidebarProps) {
  const pathname = usePathname() || "/";
  const search = useSearchParams()?.toString() ?? "";
  const router = useRouter();
  const route = parseDriveRoute(pathname, search ? `?${search}` : "");
  const { tags, counts } = useTags();
  const { views } = useViews();
  const { spaces, openCreate, openEdit, deleteSpace } = useSpaces();
  const typeCounts = useTypeBrowseCounts(token);
  const { favoriteFolders, recentFolders } = useFolderShortcuts(token, pathname);

  const routeSection = sectionFromRoute(route.view, route.savedViewId);
  const [activeSection, setActiveSection] = useState<NavSectionId>(routeSection);
  const [allFoldersOpen, setAllFoldersOpen] = useState(false);
  const [viewMenu, setViewMenu] = useState<{ view: SavedView; x: number; y: number } | null>(null);
  const [renameView, setRenameView] = useState<SavedView | null>(null);
  const [deleteViewTarget, setDeleteViewTarget] = useState<SavedView | null>(null);
  const [spaceMenu, setSpaceMenu] = useState<{ space: SmartSpace; x: number; y: number } | null>(null);
  const [deleteSpaceTarget, setDeleteSpaceTarget] = useState<SmartSpace | null>(null);

  useEffect(() => {
    setActiveSection(routeSection);
  }, [routeSection]);

  const section = getNavSection(activeSection);

  const handleSectionClick = useCallback((id: string) => {
    const next = getNavSection(id);
    setActiveSection(next.id);
    if (collapsed) onToggleCollapse();
  }, [collapsed, onToggleCollapse]);

  const handleAction = useCallback((id: NavActionId) => {
    switch (id) {
      case "open-all-folders":
        setAllFoldersOpen(true);
        return;
      default:
        return;
    }
  }, []);

  const handleTagClick = useCallback((tagId: string, e: React.MouseEvent) => {
    if (!tagId) return;
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      const current = route.view === "tags" ? [...route.tagIds] : [];
      const idx = current.indexOf(tagId);
      if (idx >= 0) current.splice(idx, 1);
      else current.push(tagId);
      if (current.length === 0) router.push(driveRoutes.dashboard);
      else if (current.length === 1) router.push(driveRoutes.tag(current[0]));
      else router.push(driveRoutes.tagFilter(current, route.tagMode));
      return;
    }
    router.push(driveRoutes.tag(tagId));
  }, [route.view, route.tagIds, route.tagMode, router]);

  const handleViewReorder = useCallback((sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const ids = views.map((v) => v.id).filter(Boolean);
    const from = ids.indexOf(sourceId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, sourceId);
    void reorderViews(next);
  }, [views]);

  const handleDeleteView = useCallback(async () => {
    const target = deleteViewTarget;
    if (!target?.id) {
      setDeleteViewTarget(null);
      return;
    }
    setDeleteViewTarget(null);
    try {
      const ok = await deleteView(target.id);
      if (ok) toast.success(`Deleted "${target.name || "Untitled view"}"`);
      if (route.savedViewId === target.id) router.push(driveRoutes.dashboard);
    } catch {
      toast.error("Couldn't delete that view");
    }
  }, [deleteViewTarget, route.savedViewId, router]);

  const handleDeleteSpace = useCallback(async () => {
    const target = deleteSpaceTarget;
    if (!target?.id) {
      setDeleteSpaceTarget(null);
      return;
    }
    setDeleteSpaceTarget(null);
    try {
      const ok = await deleteSpace(target.id);
      if (ok) toast.success(`Deleted "${target.name || "Untitled space"}"`);
      if (route.spaceId === target.id) router.push(driveRoutes.spaces);
    } catch {
      toast.error("Couldn't delete that Smart Space");
    }
  }, [deleteSpaceTarget, deleteSpace, route.spaceId, router]);

  const extrasProps: SidebarExtrasProps = {
    route,
    typeCounts,
    tags: tags ?? [],
    tagCounts: counts ?? new Map(),
    views: views ?? [],
    spaces: spaces ?? [],
    favoriteFolders,
    recentFolders,
    onManageTags,
    onTagClick: handleTagClick,
    onOpenView: (viewId) => { if (viewId) router.push(driveRoutes.view(viewId)); },
    onReorderViews: handleViewReorder,
    onViewMenu: (view, x, y) => { if (view) setViewMenu({ view, x, y }); },
    onCreateSpace: openCreate,
    onOpenSpace: (spaceId) => { if (spaceId) router.push(driveRoutes.space(spaceId)); },
    onSpaceMenu: (space, x, y) => { if (space) setSpaceMenu({ space, x, y }); },
    onFolderDrop,
  };

  const links = sectionLinks(section.id);
  const extras = sectionExtras(section.id);

  return (
    <aside className="h-full shrink-0 flex">
      <div className="h-full w-[60px] shrink-0 border-r border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col">
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1" aria-label="Primary">
          {NAV_SECTIONS.map((item) => {
            const Icon = item.icon;
            if (!Icon) return null;
            const isActive = section.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                title={item.label}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                onClick={() => handleSectionClick(item.id)}
                className={`w-full flex items-center justify-center p-2 rounded-lg transition-colors ${
                  isActive
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                    : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                }`}
              >
                <Icon className="w-4 h-4" strokeWidth={isActive ? 2 : 1.75} />
              </button>
            );
          })}
        </nav>
        <CollapseToggle collapsed={collapsed} onClick={onToggleCollapse} />
      </div>

      {!collapsed && (
        <div className="h-full w-[220px] shrink-0 border-r border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex flex-col">
          <div className="px-4 pt-5 pb-3">
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {section.label || "Home"}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-5 space-y-6">
            {links.length > 0 && (
              <ul className="space-y-0.5">
                {links.map((item) => {
                  if (item.kind === "heading") {
                    return (
                      <li key={item.id} className="pt-3 first:pt-0">
                        <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">
                          {item.label}
                        </p>
                      </li>
                    );
                  }
                  if (item.kind === "link") {
                    if (!item.href || !item.icon) return null;
                    return (
                      <li key={item.id}>
                        <NavLink
                          href={item.href}
                          label={item.label}
                          icon={item.icon}
                          active={item.match(route)}
                        />
                      </li>
                    );
                  }
                  if (!item.icon) return null;
                  return (
                    <li key={item.id}>
                      <NavButton
                        label={item.label}
                        icon={item.icon}
                        trailing={item.trailing}
                        onClick={() => handleAction(item.id)}
                      />
                    </li>
                  );
                })}
              </ul>
            )}

            {extras.map((id) => renderNavExtra(id, extrasProps)).filter(Boolean)}

            {links.length === 0 && extras.length === 0 && (
              <EmptyHint>Nothing in this section yet</EmptyHint>
            )}
          </div>

          <StorageCard quota={quota} />
        </div>
      )}

      {viewMenu && (
        <ViewContextMenu
          x={viewMenu.x}
          y={viewMenu.y}
          canDelete={!viewMenu.view.builtIn}
          onRename={() => setRenameView(viewMenu.view)}
          onDelete={() => setDeleteViewTarget(viewMenu.view)}
          onClose={() => setViewMenu(null)}
        />
      )}

      <ViewRenameModal
        open={renameView !== null}
        viewId={renameView?.id ?? ""}
        currentName={renameView?.name ?? ""}
        onClose={() => setRenameView(null)}
        onRenamed={() => setRenameView(null)}
      />

      <ConfirmModal
        open={deleteViewTarget !== null}
        title="Delete saved view?"
        message={`"${deleteViewTarget?.name ?? ""}" will be removed from your sidebar.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onClose={() => setDeleteViewTarget(null)}
        onConfirm={handleDeleteView}
      />

      {spaceMenu && (
        <ViewContextMenu
          x={spaceMenu.x}
          y={spaceMenu.y}
          canDelete
          onRename={() => openEdit(spaceMenu.space)}
          renameLabel="Edit"
          onDelete={() => setDeleteSpaceTarget(spaceMenu.space)}
          onClose={() => setSpaceMenu(null)}
        />
      )}

      <ConfirmModal
        open={deleteSpaceTarget !== null}
        title="Delete Smart Space?"
        message={`"${deleteSpaceTarget?.name ?? ""}" will be removed. Files in Drive are not affected.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onClose={() => setDeleteSpaceTarget(null)}
        onConfirm={handleDeleteSpace}
      />

      <AllFoldersModal
        open={allFoldersOpen}
        token={token}
        onClose={() => setAllFoldersOpen(false)}
      />
    </aside>
  );
}
