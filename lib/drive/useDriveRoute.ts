"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { parseDriveRoute } from "@/lib/navigation";
import { useViews } from "@/app/_components/views/ViewsProvider";
import { useSpaces } from "@/app/_components/spaces/SpacesProvider";
import type { SavedView } from "@/lib/views";
import type { SmartSpace } from "@/lib/spaces";

export function useDriveRoute() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchString = searchParams.toString();
  const { views } = useViews();
  const { spaces, loading: spacesLoading } = useSpaces();

  const route = useMemo(
    () => parseDriveRoute(pathname, searchString ? `?${searchString}` : ""),
    [pathname, searchString]
  );

  const {
    view: sidebarView,
    folderId: routeFolderId,
    tagIds: routeTagIds,
    tagMode: routeTagMode,
    savedViewId,
    typeCategory,
    cleanupKind,
    spaceId: routeSpaceId,
  } = route;

  const routeTagIdsKey = routeTagIds.join(",");
  const isSavedView = sidebarView === "saved";
  const isActivityView = sidebarView === "activity";
  const isControlsView = sidebarView === "controls";

  const activeSavedView = useMemo(
    () => (savedViewId ? views.find((v) => v.id === savedViewId) ?? null : null),
    [views, savedViewId]
  );

  const activeSpace = useMemo(
    () => (routeSpaceId ? spaces.find((s) => s.id === routeSpaceId) ?? null : null),
    [spaces, routeSpaceId],
  );

  const scopeView = isSavedView ? (activeSavedView?.scope.view ?? "drive") : sidebarView;
  const scopeTagIds = isSavedView ? (activeSavedView?.scope.tagIds ?? []) : routeTagIds;
  const scopeTagMode = isSavedView ? (activeSavedView?.scope.tagMode ?? "or") : routeTagMode;
  const scopeTagIdsKey = scopeTagIds.join(",");

  const isTrashView = scopeView === "trash";
  const isTagsView = scopeView === "tags";
  const isHiddenView = sidebarView === "hidden";
  const isInboxView = sidebarView === "inbox";
  const isCleanupView = sidebarView === "cleanup";
  const isSpacesView = sidebarView === "spaces";
  const isSpacesHome = isSpacesView && !routeSpaceId;
  const isSharedLinksView = sidebarView === "shared-links";
  const isTypeView = scopeView === "type";
  const isDriveScope = scopeView === "drive" || scopeView === "dashboard";
  const isDashboardView = sidebarView === "dashboard";

  return {
    route,
    sidebarView,
    routeFolderId,
    routeTagIds,
    routeTagMode,
    routeTagIdsKey,
    savedViewId,
    typeCategory,
    cleanupKind,
    routeSpaceId,
    isSavedView,
    isActivityView,
    isControlsView,
    isDashboardView,
    activeSavedView: activeSavedView as SavedView | null,
    activeSpace: activeSpace as SmartSpace | null,
    spaces,
    spacesLoading,
    scopeView,
    scopeTagIds,
    scopeTagMode,
    scopeTagIdsKey,
    isTrashView,
    isTagsView,
    isHiddenView,
    isInboxView,
    isCleanupView,
    isSpacesView,
    isSpacesHome,
    isSharedLinksView,
    isTypeView,
    isDriveScope,
    views,
  };
}
