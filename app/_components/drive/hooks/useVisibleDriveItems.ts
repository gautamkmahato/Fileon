"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchAllFilesByIds, isFolder, type DriveFile } from "@/lib/drive/drive";
import { useDriveRoute } from "@/lib/drive/useDriveRoute";
import { useAuth } from "@/app/_components/auth/AuthProvider";
import { useTags } from "@/app/_components/tags/TagsProvider";
import { usePins } from "@/app/_components/pins/PinsProvider";
import { useHidden } from "@/app/_components/hidden/HiddenProvider";
import { DASHBOARD_PINS_KEY } from "@/lib/pins";
import { applyFilters, filtersAreActive } from "@/lib/utils/filter";
import {
  DEFAULT_FILE_SORT,
  DEFAULT_FOLDER_SORT,
  DEFAULT_TRASH_SORT,
  sortDriveFiles,
  type SortState,
} from "@/lib/utils/sort";
import { isDashboardRoot } from "@/lib/drive/browse-scope";
import { filterRecentFiles } from "@/lib/utils/recent-files";
import { useBrowseStore, useFilesStore } from "@/lib/stores";

const EMPTY_PIN_IDS: string[] = [];

/** Visible folders/files derived from stores — avoids full browse context subscription. */
export function useVisibleDriveItems() {
  const { token } = useAuth();
  const files = useFilesStore((s) => s.files);
  const search = useBrowseStore((s) => s.search);
  const filters = useBrowseStore((s) => s.filters);
  const fileSort = useBrowseStore((s) => s.fileSort);
  const showHidden = useBrowseStore((s) => s.showHidden);
  const {
    isDriveScope, isTrashView, isDashboardView, isHiddenView, isSpacesView, sidebarView, routeFolderId,
  } = useDriveRoute();
  const { tagsByFileId } = useTags();
  const { pinsByFolder } = usePins();
  const { hiddenIds } = useHidden();

  const taggedFileIds = useMemo(() => new Set(tagsByFileId.keys()), [tagsByFileId]);
  const activeFileSort: SortState = isTrashView ? DEFAULT_TRASH_SORT : fileSort;

  const filterOpts = useMemo(
    () => ({
      taggedFileIds,
      hiddenFileIds: hiddenIds,
      showHidden: showHidden || isHiddenView,
      hiddenViewOnly: isHiddenView,
    }),
    [taggedFileIds, hiddenIds, showHidden, isHiddenView],
  );

  const allFolders = useMemo(() => files.filter(isFolder), [files]);
  const allNonFolders = useMemo(() => files.filter((f) => !isFolder(f)), [files]);

  const pinIds = useMemo(() => {
    if (!isDashboardView) return EMPTY_PIN_IDS;
    return (pinsByFolder.get(DASHBOARD_PINS_KEY) ?? []).map((p) => p.fileId);
  }, [isDashboardView, pinsByFolder]);

  const pinIdsKey = pinIds.join(",");
  const pinnedIdSet = useMemo(() => new Set(pinIds), [pinIdsKey]);

  const storedFileIdSet = useMemo(() => new Set(files.map((f) => f.id)), [files]);
  const fileById = useMemo(() => new Map(files.map((f) => [f.id, f])), [files]);

  const missingPinIds = useMemo(() => {
    if (!isDashboardView || pinIds.length === 0) return EMPTY_PIN_IDS;
    return pinIds.filter((id) => !storedFileIdSet.has(id));
  }, [isDashboardView, pinIdsKey, storedFileIdSet]);

  const missingPinIdsKey = missingPinIds.join(",");
  const [fetchedPinFiles, setFetchedPinFiles] = useState<DriveFile[]>([]);

  useEffect(() => {
    if (!isDashboardView || !token || missingPinIds.length === 0) {
      setFetchedPinFiles((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    let cancelled = false;
    fetchAllFilesByIds(token, missingPinIds)
      .then((rows) => {
        if (cancelled) return;
        setFetchedPinFiles((prev) => {
          const byId = new Map(prev.map((f) => [f.id, f]));
          for (const row of rows) byId.set(row.id, row);
          const next = missingPinIds
            .map((id) => byId.get(id))
            .filter((f): f is DriveFile => !!f);
          if (
            next.length === prev.length &&
            next.every((f, i) => f.id === prev[i]?.id)
          ) {
            return prev;
          }
          return next;
        });
      })
      .catch(console.error);

    return () => { cancelled = true; };
  }, [isDashboardView, token, missingPinIdsKey, missingPinIds]);

  const resolvedFileById = useMemo(() => {
    const map = new Map(fileById);
    for (const file of fetchedPinFiles) map.set(file.id, file);
    return map;
  }, [fileById, fetchedPinFiles]);

  const pinnedItems = useMemo(() => {
    if (!isDashboardView) return [];
    return pinIds
      .map((id) => resolvedFileById.get(id))
      .filter((f): f is DriveFile => !!f)
      .filter((f) => !hiddenIds.has(f.id) || showHidden);
  }, [isDashboardView, pinIds, resolvedFileById, hiddenIds, showHidden]);

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

  const hasAnyVisible = isHiddenView
    ? visibleFolders.length > 0 || visibleFiles.length > 0
    : isDashboardView
    ? pinnedItems.length > 0 || visibleFolders.length > 0 || visibleFiles.length > 0
    : myDriveFolders.length > 0 || visibleFiles.length > 0;
  const isFiltering = filtersAreActive(filters, search);

  return {
    pinnedItems,
    pinFolderKey: isDashboardView ? DASHBOARD_PINS_KEY : null,
    visibleFolders,
    myDriveFolders,
    visibleFiles,
    hasAnyVisible,
    isFiltering,
    isDashboardView,
    isHiddenView,
    files,
    showHidden,
  };
}
