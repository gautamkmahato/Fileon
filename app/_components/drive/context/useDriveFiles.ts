"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type DriveFile,
  type StorageQuota,
  fetchAllFilesByIds,
  getFile,
  getStorageQuota,
  isFolder,
  listFiles,
  listRecentFiles,
  listStarredFiles,
  listTrashFiles,
} from "@/lib/drive/drive";
import { listFilesByType, TYPE_BROWSE_META, type TypeBrowseCategory } from "@/lib/drive/type-browse";
import { toast } from "@/lib/toast";
import { driveRoutes } from "@/lib/navigation";
import { rootCrumbLabel, isDashboardRoot } from "@/lib/drive/browse-scope";
import type { FolderCrumb } from "@/lib/drive/types";
import { getFileIdsForTags, fileMatchesTagScope } from "@/lib/tags";
import { displayTagName } from "@/lib/tag-kinds";
import { getTagFileIdsCache, setTagFileIdsCache } from "@/lib/cache/tag-file-ids-cache";
import {
  cacheFolderName,
  cacheFolderNamesFromFiles,
  getCachedFolderName,
} from "@/lib/drive/folder-name-cache";
import {
  needsFullFolderPathResolve,
  resolveFolderBreadcrumbs,
} from "@/lib/drive/folder-breadcrumbs";
import {
  applyFilters,
  DEFAULT_FILTERS,
  filtersAreActive,
} from "@/lib/utils/filter";
import {
  DEFAULT_FILE_SORT,
  DEFAULT_FOLDER_SORT,
  DEFAULT_TRASH_SORT,
  sortDriveFiles,
  sortStateKey,
} from "@/lib/utils/sort";
import {
  buildSelectionScopeKey,
  getFilesCache,
  isFilesCacheFresh,
  setFilesCache,
  useBrowseStore,
  useFilesStore,
  useSelectionStore,
} from "@/lib/stores";
import { filterRecentFiles } from "@/lib/utils/recent-files";
import { DASHBOARD_PINS_KEY } from "@/lib/pins";
import { listHiddenFileIds } from "@/lib/hidden";
import { listInboxFileIds, removeFromInbox } from "@/lib/inbox";
import { usePins } from "@/app/_components/pins/PinsProvider";
import { useHidden } from "@/app/_components/hidden/HiddenProvider";
import { useInbox } from "@/app/_components/inbox/InboxProvider";
import { useSpaces } from "@/app/_components/spaces/SpacesProvider";
import { getSpace } from "@/lib/spaces/repository";
import { querySmartSpace } from "@/lib/spaces/query";
import { updateSpaceStats } from "@/lib/spaces/repository";
import { fileMatchesSpace } from "@/lib/spaces/rules";
import type { DriveFilesContext, UseDriveFilesParams } from "./drive-files-types";

export function useDriveFiles({
  token,
  routeState,
  tags,
  tagsByFileId,
  scopeKey,
  clearSelection,
  onClearPreview,
}: UseDriveFilesParams): DriveFilesContext {
  const router = useRouter();
  const {
    sidebarView, routeFolderId, routeTagIds, routeTagMode, routeTagIdsKey, savedViewId,
    typeCategory: routeTypeCategory,
    isSavedView, isActivityView, isHiddenView, isInboxView, isCleanupView, isTypeView, activeSavedView, scopeView, scopeTagIds, scopeTagMode,
    isTrashView, isTagsView, isDriveScope, isDashboardView,
    isSpacesView, isSpacesHome, isSharedLinksView, routeSpaceId, activeSpace, spacesLoading,
    views,
    scopeTagIdsKey,
  } = routeState;

  const { getOrderedPinIds } = usePins();
  const { hiddenIds } = useHidden();
  const { inboxIds } = useInbox();
  const { userId, setQueryWarnings } = useSpaces();

  const showHidden = useBrowseStore((s) => s.showHidden);
  const hiddenIdsKey = useMemo(
    () => [...hiddenIds].sort().join(","),
    [hiddenIds],
  );
  const inboxIdsKey = useMemo(
    () => [...inboxIds].sort().join(","),
    [inboxIds],
  );
  const spaceRulesKey = useMemo(() => {
    if (!activeSpace) return "";
    return `${activeSpace.id}:${activeSpace.matchMode}:${activeSpace.rules.map((r) => `${r.field}:${r.op}:${r.value}`).join("|")}`;
  }, [activeSpace]);

  const loadIdRef = useRef(0);
  const hydratedViewIdRef = useRef<string | null>(null);
  const prevRouteRef = useRef({
    view: sidebarView,
    folderId: routeFolderId,
    tagIds: routeTagIdsKey,
    savedViewId,
    typeCategory: routeTypeCategory,
    spaceId: routeSpaceId,
  });

  function resolveTypeCategory(): TypeBrowseCategory | null {
    if (isSavedView && activeSavedView?.scope.view === "type") {
      return activeSavedView.scope.typeCategory ?? null;
    }
    if (sidebarView === "type") return routeTypeCategory;
    return null;
  }

  const [folderStack, setFolderStack] = useState<FolderCrumb[]>([
    { id: null, name: rootCrumbLabel(sidebarView) },
  ]);
  const [quota, setQuota] = useState<StorageQuota | null>(null);

  const files = useFilesStore((s) => s.files);
  const nextPageToken = useFilesStore((s) => s.nextPageToken);
  const loading = useFilesStore((s) => s.loading);
  const error = useFilesStore((s) => s.error);
  const loadingMore = useFilesStore((s) => s.loadingMore);

  const search = useBrowseStore((s) => s.search);
  const filters = useBrowseStore((s) => s.filters);
  const fileSort = useBrowseStore((s) => s.fileSort);
  const view = useBrowseStore((s) => s.view);

  const currentFolder = folderStack[folderStack.length - 1];
  const canGoBack = folderStack.length > 1;
  const folderContext = currentFolder.name;
  const taggedFileIds = useMemo(() => new Set(tagsByFileId.keys()), [tagsByFileId]);
  const filterOpts = useMemo(
    () => ({
      taggedFileIds,
      hiddenFileIds: hiddenIds,
      showHidden: showHidden || isHiddenView,
      hiddenViewOnly: isHiddenView,
    }),
    [taggedFileIds, hiddenIds, showHidden, isHiddenView],
  );

  const visibleIdsRef = useRef<string[]>([]);
  const visibleFilesRef = useRef<DriveFile[]>([]);

  const loadFiles = useCallback(async () => {
    if (!token || sidebarView === "activity" || sidebarView === "controls" || sidebarView === "cleanup" || isSpacesHome || isSharedLinksView) {
      loadIdRef.current += 1;
      return;
    }
    if (isSavedView && !activeSavedView) return;

    const dataView = isSavedView ? activeSavedView!.scope.view : sidebarView;
    const cacheKey = buildSelectionScopeKey({
      sidebarView,
      routeFolderId,
      routeTagIdsKey,
      savedViewId,
      typeCategory: resolveTypeCategory(),
      spaceId: routeSpaceId,
    });

    const cached = getFilesCache(cacheKey);
    const cacheFresh = cached ? isFilesCacheFresh(cached) : false;

    if (cached) {
      useFilesStore.getState().hydrateFromCache(
        cached.files,
        cached.nextPageToken,
        cacheKey,
        !cacheFresh
      );
      if (cacheFresh && dataView !== "inbox" && dataView !== "spaces") return;
    } else {
      useFilesStore.getState().beginLoad(cacheKey);
    }

    const loadId = ++loadIdRef.current;
    const folderIdForList =
      dataView === "drive" || dataView === "dashboard"
        ? (isSavedView ? activeSavedView!.scope.folderId : dataView === "dashboard" ? null : routeFolderId)
        : null;

    try {
      if (dataView === "tags") {
        const tagIds = isSavedView
          ? activeSavedView!.scope.tagIds
          : routeTagIdsKey ? routeTagIdsKey.split(",") : [];
        if (!tagIds.length) {
          if (loadId === loadIdRef.current) {
            useFilesStore.getState().setFiles([], undefined);
          }
          return;
        }
        const tagMode = isSavedView ? activeSavedView!.scope.tagMode : routeTagMode;
        const tagCacheKey = `${[...tagIds].sort().join(",")}:${tagMode}`;
        let fileIds = getTagFileIdsCache(tagCacheKey);
        if (!fileIds) {
          fileIds = await getFileIdsForTags(tagIds, tagMode);
          setTagFileIdsCache(tagCacheKey, fileIds);
        }
        if (!fileIds.length) {
          if (loadId === loadIdRef.current) useFilesStore.getState().setFiles([], undefined);
          return;
        }
        const fetched = await fetchAllFilesByIds(token, fileIds);
        if (loadId !== loadIdRef.current) return;
        cacheFolderNamesFromFiles(fetched);
        useFilesStore.getState().setFiles(fetched);
        setFilesCache(cacheKey, { files: fetched });
        return;
      }
      if (dataView === "hidden") {
        const fileIds = await listHiddenFileIds();
        if (!fileIds.length) {
          if (loadId === loadIdRef.current) useFilesStore.getState().setFiles([], undefined);
          return;
        }
        const fetched = await fetchAllFilesByIds(token, fileIds);
        if (loadId !== loadIdRef.current) return;
        cacheFolderNamesFromFiles(fetched);
        useFilesStore.getState().setFiles(fetched);
        setFilesCache(cacheKey, { files: fetched });
        return;
      }
      if (dataView === "inbox") {
        const fileIds = await listInboxFileIds();
        if (!fileIds.length) {
          if (loadId === loadIdRef.current) useFilesStore.getState().setFiles([], undefined);
          return;
        }
        const fetched = await fetchAllFilesByIds(token, fileIds);
        if (loadId !== loadIdRef.current) return;
        const byId = new Map(fetched.map((f) => [f.id, f]));
        const ordered = fileIds.map((id) => byId.get(id)).filter((f): f is DriveFile => !!f);
        const missing = fileIds.filter((id) => !byId.has(id));
        if (missing.length) void removeFromInbox(missing);
        cacheFolderNamesFromFiles(ordered);
        useFilesStore.getState().setFiles(ordered);
        setFilesCache(cacheKey, { files: ordered });
        return;
      }
      if (dataView === "spaces") {
        if (!userId || !routeSpaceId) {
          if (loadId === loadIdRef.current) useFilesStore.getState().setFiles([], undefined);
          return;
        }
        const space = await getSpace(userId, routeSpaceId);
        if (!space) {
          if (loadId === loadIdRef.current) useFilesStore.getState().setFiles([], undefined);
          return;
        }
        const result = await querySmartSpace({
          token,
          space,
          tags,
          tagsByFileId,
        });
        if (loadId !== loadIdRef.current) return;
        setQueryWarnings(result.warnings);
        cacheFolderNamesFromFiles(result.files);
        useFilesStore.getState().setFiles(result.files);
        setFilesCache(cacheKey, { files: result.files });
        if (
          space.cachedFileCount !== result.files.length
          || space.cachedSizeBytes !== result.totalSizeBytes
          || space.cachedTruncated !== result.truncated
        ) {
          void updateSpaceStats(userId, space.id, {
            fileCount: result.files.length,
            sizeBytes: result.totalSizeBytes,
            truncated: result.truncated,
          });
        }
        return;
      }
      let res;
      const typeCat = resolveTypeCategory();
      switch (dataView) {
        case "starred":
          res = await listStarredFiles(token);
          break;
        case "recent":
          res = await listRecentFiles(token);
          break;
        case "trash":
          res = await listTrashFiles(token);
          break;
        case "type":
          if (!typeCat) {
            if (loadId === loadIdRef.current) useFilesStore.getState().setFiles([], undefined);
            return;
          }
          res = await listFilesByType(token, typeCat);
          break;
        default:
          res = await listFiles({ token, folderId: folderIdForList });
      }
      if (loadId !== loadIdRef.current) return;
      cacheFolderNamesFromFiles(res.files);
      useFilesStore.getState().setFiles(res.files, res.nextPageToken);
      setFilesCache(cacheKey, { files: res.files, nextPageToken: res.nextPageToken });
    } catch (err) {
      if (loadId !== loadIdRef.current) return;
      console.error(err);
      useFilesStore.getState().setLoadError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      if (loadId === loadIdRef.current) {
        useFilesStore.getState().setLoading(false);
        useFilesStore.getState().setRevalidating(false);
      }
    }
  }, [token, sidebarView, isSavedView, activeSavedView, routeFolderId, routeTagIdsKey, routeTagMode, savedViewId, routeTypeCategory, isSpacesHome, isSharedLinksView, routeSpaceId, userId, tags, tagsByFileId, spaceRulesKey]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  useEffect(() => {
    if (isHiddenView) void loadFiles();
  }, [isHiddenView, hiddenIdsKey, loadFiles]);

  useEffect(() => {
    if (isInboxView) void loadFiles();
  }, [isInboxView, inboxIdsKey, loadFiles]);

  const hydratedSpaceIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isSpacesView || !activeSpace) {
      hydratedSpaceIdRef.current = null;
      return;
    }
    if (hydratedSpaceIdRef.current === activeSpace.id) return;
    hydratedSpaceIdRef.current = activeSpace.id;
    useBrowseStore.getState().hydrateFromSavedView({
      filters: DEFAULT_FILTERS,
      search: "",
      sort: { field: activeSpace.sortField, dir: activeSpace.sortDir },
      layout: activeSpace.layout,
    });
    onClearPreview();
    useSelectionStore.getState().clearSelection();
  }, [isSpacesView, activeSpace, onClearPreview]);

  useEffect(() => {
    if (!isSpacesView || isSpacesHome || spacesLoading) return;
    if (routeSpaceId && !activeSpace) {
      toast.error("Smart Space not found");
      router.replace(driveRoutes.spaces);
    }
  }, [isSpacesView, isSpacesHome, spacesLoading, routeSpaceId, activeSpace, router]);

  useEffect(() => {
    if (!isSpacesView || !activeSpace || activeSpace.rules.length === 0) return;
    const { files: current, nextPageToken: pageToken } = useFilesStore.getState();
    if (current.length === 0) return;
    const matching = current.filter((f) =>
      fileMatchesSpace(f, activeSpace, tagsByFileId),
    );
    if (matching.length === current.length) return;
    useFilesStore.getState().setFiles(matching, pageToken);
  }, [isSpacesView, activeSpace, tagsByFileId]);

  useEffect(() => {
    const prev = prevRouteRef.current;
    prevRouteRef.current = { view: sidebarView, folderId: routeFolderId, tagIds: routeTagIdsKey, savedViewId, typeCategory: routeTypeCategory, spaceId: routeSpaceId };

    const storedScope = useSelectionStore.getState().scopeKey;
    const scopeMatches = storedScope === scopeKey;

    if (sidebarView === "saved") {
      if (!scopeMatches || prev.savedViewId !== savedViewId) {
        useSelectionStore.getState().syncScope(scopeKey, { clearSelection: true });
      } else {
        useSelectionStore.getState().syncScope(scopeKey, { clearSelection: false });
      }
      return;
    }

    if (prev.view !== sidebarView || prev.tagIds !== routeTagIdsKey || prev.typeCategory !== routeTypeCategory || prev.spaceId !== routeSpaceId) {
      useBrowseStore.getState().resetBrowse();
      if (prev.view === "spaces" && useBrowseStore.getState().view === "gallery") {
        useBrowseStore.getState().setView("grid");
      }
      onClearPreview();
      useSelectionStore.getState().syncScope(scopeKey, { clearSelection: true });
      return;
    }

    if (!scopeMatches) {
      useSelectionStore.getState().syncScope(scopeKey, { clearSelection: true });
    } else {
      useSelectionStore.getState().syncScope(scopeKey, { clearSelection: false });
    }

    if (sidebarView === "drive" && prev.folderId !== routeFolderId) {
      useBrowseStore.getState().resetBrowse();
      useSelectionStore.getState().syncScope(scopeKey, { clearSelection: true });
    }

    if (sidebarView === "dashboard" && prev.view !== "dashboard") {
      useBrowseStore.getState().resetBrowse();
      useSelectionStore.getState().syncScope(scopeKey, { clearSelection: true });
    }
  }, [sidebarView, routeFolderId, routeTagIdsKey, savedViewId, routeSpaceId, scopeKey, clearSelection, onClearPreview]);

  useEffect(() => {
    if (!isSavedView) {
      hydratedViewIdRef.current = null;
      return;
    }
    if (!activeSavedView) return;
    if (hydratedViewIdRef.current === activeSavedView.id) return;
    hydratedViewIdRef.current = activeSavedView.id;
    useBrowseStore.getState().hydrateFromSavedView(activeSavedView);
    onClearPreview();
    useSelectionStore.getState().clearSelection();
  }, [isSavedView, activeSavedView, clearSelection, onClearPreview]);

  useEffect(() => {
    if (!isSavedView || !activeSavedView) return;
    const { scope } = activeSavedView;
    if (scope.view !== "drive") return;

    if (!scope.folderId) {
      setFolderStack([{ id: null, name: "My Drive" }]);
      return;
    }

    const folderId = scope.folderId;

    setFolderStack((prev) => {
      const last = prev[prev.length - 1];
      if (last?.id === folderId) return prev;
      const cached = getCachedFolderName(folderId);
      return [
        { id: null, name: "My Drive" },
        { id: folderId, name: cached ?? "…" },
      ];
    });

    if (getCachedFolderName(folderId)) return;
    if (!token) return;
    getFile(token, folderId)
      .then((file) => {
        cacheFolderName(folderId, file.name);
        setFolderStack((prev) => {
          const last = prev[prev.length - 1];
          if (last?.id !== folderId) return prev;
          if (last.name === file.name) return prev;
          return prev.map((c, i) =>
            i === prev.length - 1 ? { ...c, name: file.name } : c
          );
        });
      })
      .catch(() => {});
  }, [isSavedView, activeSavedView, token]);

  useEffect(() => {
    if (!isSavedView || !savedViewId || views.length === 0) return;
    if (!activeSavedView) {
      toast.error("Saved view not found");
      router.replace(driveRoutes.dashboard);
    }
  }, [isSavedView, savedViewId, views, activeSavedView, router]);

  useEffect(() => {
    if (sidebarView === "type" && routeTypeCategory) {
      setFolderStack([
        { id: null, name: "Dashboard" },
        { id: null, name: TYPE_BROWSE_META[routeTypeCategory].label },
      ]);
      return;
    }

    if (sidebarView === "dashboard") {
      setFolderStack([{ id: null, name: "Dashboard" }]);
      return;
    }

    if (sidebarView !== "drive") return;

    if (!routeFolderId) {
      setFolderStack([{ id: null, name: "My Drive" }]);
      return;
    }

    let shouldResolve = false;

    setFolderStack((prev) => {
      const last = prev[prev.length - 1];
      if (last?.id === routeFolderId && !needsFullFolderPathResolve(prev, routeFolderId)) {
        return prev;
      }
      const idx = prev.findIndex((c) => c.id === routeFolderId);
      if (idx >= 0) {
        const sliced = prev.slice(0, idx + 1);
        shouldResolve = needsFullFolderPathResolve(sliced, routeFolderId);
        return sliced;
      }
      const cached = getCachedFolderName(routeFolderId);
      shouldResolve = true;
      return [
        { id: null, name: "My Drive" },
        { id: routeFolderId, name: cached ?? "…" },
      ];
    });

    if (!token || !shouldResolve) return;

    let cancelled = false;

    void resolveFolderBreadcrumbs(token, routeFolderId)
      .then((stack) => {
        if (cancelled) return;
        setFolderStack((prev) => {
          if (prev[prev.length - 1]?.id !== routeFolderId) return prev;
          if (!needsFullFolderPathResolve(prev, routeFolderId)) return prev;
          return stack;
        });
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("Folder not found");
        router.replace(driveRoutes.myDrive);
      });

    return () => {
      cancelled = true;
    };
  }, [sidebarView, routeFolderId, routeTypeCategory, token, router]);

  useEffect(() => {
    useBrowseStore.getState().initFromStorage();
  }, []);

  useEffect(() => {
    if (!token) return;
    getStorageQuota(token).then(setQuota).catch(console.error);
  }, [token]);

  const loadMore = useCallback(async () => {
    if (!token || !nextPageToken || loadingMore || isSavedView) return;
    const folderIdForList = scopeView === "drive" || scopeView === "dashboard"
      ? (isSavedView && activeSavedView ? activeSavedView.scope.folderId : scopeView === "dashboard" ? null : routeFolderId)
      : null;
    useFilesStore.getState().setLoadingMore(true);
    try {
      let res;
      const typeCat = isSavedView && activeSavedView?.scope.view === "type"
        ? activeSavedView.scope.typeCategory ?? null
        : scopeView === "type"
        ? routeTypeCategory
        : null;
      switch (scopeView) {
        case "starred": res = await listStarredFiles(token, nextPageToken); break;
        case "recent": res = await listRecentFiles(token, nextPageToken); break;
        case "trash": res = await listTrashFiles(token, nextPageToken); break;
        case "type":
          if (!typeCat) return;
          res = await listFilesByType(token, typeCat, nextPageToken);
          break;
        case "dashboard":
        default: res = await listFiles({ token, folderId: folderIdForList, pageToken: nextPageToken });
      }
      useFilesStore.getState().appendFiles(res.files, res.nextPageToken);
    } finally {
      useFilesStore.getState().setLoadingMore(false);
    }
  }, [token, nextPageToken, loadingMore, isSavedView, scopeView, routeFolderId, routeTypeCategory, activeSavedView]);

  const allFolders = useMemo(() => files.filter(isFolder), [files]);
  const allNonFolders = useMemo(() => files.filter((f) => !isFolder(f)), [files]);
  const activeFileSort = isTrashView ? DEFAULT_TRASH_SORT : fileSort;

  const pinnedIdSet = useMemo(() => {
    if (!isDashboardView) return new Set<string>();
    return new Set(getOrderedPinIds(DASHBOARD_PINS_KEY));
  }, [isDashboardView, getOrderedPinIds]);

  const visibleFolders = useMemo(() => {
    if (isHiddenView) {
      const filtered = applyFilters(allFolders, filters, search, filterOpts);
      return sortDriveFiles(filtered, DEFAULT_FOLDER_SORT);
    }
    if (!isDashboardView || !isDriveScope) return [];
    if (filters.type !== "all" && filters.type !== "folder") return [];
    const filtered = applyFilters(
      allFolders, { ...filters, type: "all" }, "", filterOpts,
    );
    return sortDriveFiles(filtered, DEFAULT_FOLDER_SORT)
      .filter((f) => !pinnedIdSet.has(f.id));
  }, [allFolders, filters, search, isDashboardView, isDriveScope, filterOpts, pinnedIdSet, isHiddenView]);

  const myDriveFolders = useMemo(() => {
    if (isHiddenView || isSpacesView) {
      const filtered = applyFilters(allFolders, filters, search, filterOpts);
      return sortDriveFiles(filtered, DEFAULT_FOLDER_SORT);
    }
    if (isDashboardView || !isDriveScope) return [];
    if (filters.type !== "all" && filters.type !== "folder") return [];
    const filtered = applyFilters(
      allFolders, { ...filters, type: "all" }, "", filterOpts,
    );
    return sortDriveFiles(filtered, DEFAULT_FOLDER_SORT);
  }, [allFolders, filters, search, isDashboardView, isDriveScope, filterOpts, isHiddenView, isSpacesView]);

  const visibleFiles = useMemo(() => {
    if (isHiddenView) {
      const filtered = applyFilters(allNonFolders, filters, search, filterOpts);
      return sortDriveFiles(filtered, activeFileSort);
    }
    const filtered = applyFilters(allNonFolders, filters, search, filterOpts);
    const sorted = sortDriveFiles(filtered, activeFileSort);
    const withoutPins = isDashboardView
      ? sorted.filter((f) => !pinnedIdSet.has(f.id))
      : sorted;
    if (isDashboardRoot(sidebarView, routeFolderId)) {
      return filterRecentFiles(withoutPins);
    }
    return withoutPins;
  }, [
    allNonFolders, filters, search, activeFileSort, filterOpts, pinnedIdSet,
    isDashboardView, sidebarView, routeFolderId, isHiddenView,
  ]);

  const previewableFiles = useMemo(() => {
    if (!isDashboardView || pinnedIdSet.size === 0) return visibleFiles;
    const extras = allNonFolders.filter(
      (f) => pinnedIdSet.has(f.id) && !visibleFiles.some((v) => v.id === f.id),
    );
    return extras.length > 0 ? [...visibleFiles, ...extras] : visibleFiles;
  }, [visibleFiles, allNonFolders, pinnedIdSet, isDashboardView]);

  useEffect(() => {
    visibleFilesRef.current = previewableFiles;
  }, [previewableFiles]);

  /** Drop files from tag views when they no longer match the active tag filter. */
  useEffect(() => {
    if (!isTagsView || scopeTagIds.length === 0) return;

    const { files: current, nextPageToken: token } = useFilesStore.getState();
    if (current.length === 0) return;

    const matching = current.filter((f) =>
      fileMatchesTagScope(f.id, tagsByFileId, scopeTagIds, scopeTagMode),
    );
    if (matching.length === current.length) return;

    useFilesStore.getState().setFiles(matching, token);
  }, [isTagsView, scopeTagIdsKey, scopeTagMode, tagsByFileId, scopeTagIds]);

  useEffect(() => {
    const list = isHiddenView
      ? [...visibleFolders, ...visibleFiles]
      : isDashboardView
      ? [...visibleFolders, ...visibleFiles]
      : [...myDriveFolders, ...visibleFiles];
    visibleIdsRef.current = list.map((f) => f.id);
  }, [visibleFolders, myDriveFolders, visibleFiles, isDashboardView, isHiddenView]);

  useEffect(() => {
    const ids = visibleIdsRef.current;
    if (ids.length > 0 && !isCleanupView) {
      useSelectionStore.getState().pruneToValidIds(ids);
    }
  }, [visibleFolders, visibleFiles, files, isCleanupView]);

  const hasAnyVisible = isHiddenView
    ? visibleFolders.length > 0 || visibleFiles.length > 0
    : isDashboardView
    ? visibleFolders.length > 0 || visibleFiles.length > 0
    : myDriveFolders.length > 0 || visibleFiles.length > 0;
  const isFiltering = filtersAreActive(filters, search);

  const isViewSavable = useMemo(() => {
    if (isActivityView || isTrashView || isSavedView || isHiddenView || isInboxView || isCleanupView || isSpacesView || isSharedLinksView) return false;
    const hasCustomSort = sortStateKey(fileSort) !== sortStateKey(DEFAULT_FILE_SORT);
    const hasTags = isTagsView && routeTagIds.length > 0;
    const hasFolder = sidebarView === "drive" && routeFolderId !== null;
    const hasScope = sidebarView !== "drive" && sidebarView !== "dashboard" && !isTagsView;
    const hasLayout = view !== "grid";
    return isFiltering || hasCustomSort || hasTags || hasFolder || hasScope || hasLayout;
  }, [isActivityView, isTrashView, isSavedView, isHiddenView, isInboxView, isCleanupView, isSpacesView, isSharedLinksView, isFiltering, fileSort, isTagsView, routeTagIds, sidebarView, routeFolderId, view]);

  const effectiveTypeCategory = resolveTypeCategory();
  const pageTitle = isSavedView && activeSavedView
    ? activeSavedView.name
    : isTypeView && effectiveTypeCategory
    ? TYPE_BROWSE_META[effectiveTypeCategory].label
    : sidebarView === "dashboard" ? "Dashboard"
    : sidebarView === "starred" ? "Starred"
    : sidebarView === "recent" ? "Recent"
    : sidebarView === "trash" ? "Trash"
    : sidebarView === "hidden" ? "Hidden"
    : sidebarView === "inbox" ? "Inbox"
    : sidebarView === "cleanup" ? "Cleanup"
    : sidebarView === "spaces" ? (activeSpace?.name ?? "Smart Spaces")
    : sidebarView === "shared-links" ? "Shared links"
    : sidebarView === "activity" ? "Activity"
    : sidebarView === "controls" ? "Controls"
    : isTagsView
    ? (scopeTagIds.length === 0
      ? "Tags"
      : scopeTagIds.map((id) => {
          const tag = tags.find((t) => t.id === id);
          return tag ? displayTagName(tag) : "Tag";
        }).join(scopeTagMode === "and" ? " + " : ", "))
    : currentFolder.name;

  return {
    folderStack,
    setFolderStack,
    currentFolder,
    canGoBack,
    folderContext,
    files,
    loading,
    error,
    loadingMore,
    nextPageToken,
    loadFiles,
    loadMore,
    visibleFolders,
    visibleFiles,
    visibleIdsRef,
    visibleFilesRef,
    hasAnyVisible,
    isFiltering,
    isViewSavable,
    pageTitle,
    quota,
    taggedFileIds,
  };
}
