import { type DriveFile, isFolder } from "@/lib/drive/drive";
import { driveRoutes } from "@/lib/navigation/routes";
import { computeSelection } from "@/lib/utils/selection";
import { toast } from "@/lib/ui/toast";
import { useCleanupStore } from "@/lib/cleanup/store";
import { useBrowseStore, useSelectionStore } from "@/lib/stores";
import type { TagFilterMode } from "@/lib/tags/repository";
import type { ViewScope } from "@/lib/views/repository";
import type { DriveActionContext } from "./types";

interface NavigationDeps {
  handleRestoreFiles: (targets: DriveFile[]) => Promise<void>;
}

/** Opening items, breadcrumb navigation, selection, and view-scope helpers. */
export function createNavigationActions(ctx: DriveActionContext, deps: NavigationDeps) {
  const { router, route, filesCtx, clearSelection, setPreviewFile } = ctx;
  const {
    sidebarView, routeFolderId, routeTagIds, routeTagMode, typeCategory,
    isSavedView, isTrashView, isTagsView, isCleanupView, scopeTagIds,
  } = route;
  const { folderStack, setFolderStack, canGoBack, files, visibleFolders, visibleFiles, visibleIdsRef } = filesCtx;

  function openFile(file: DriveFile) {
    if (isTrashView && !isFolder(file)) {
      toast.info("Restore this file to open it", {
        action: { label: "Restore", onClick: () => deps.handleRestoreFiles([file]) },
      });
      return;
    }
    if (isFolder(file)) {
      router.push(driveRoutes.folder(file.id));
      setFolderStack((prev) => {
        if (sidebarView === "drive") {
          const last = prev[prev.length - 1];
          if (last?.id === file.id) return prev;
          return [...prev, { id: file.id, name: file.name }];
        }
        return [{ id: null, name: "My Drive" }, { id: file.id, name: file.name }];
      });
      useBrowseStore.getState().setSearch("");
      clearSelection();
    } else {
      setPreviewFile(file);
    }
  }

  function handleItemSelect(file: DriveFile, e: React.MouseEvent) {
    const cleanupIds = useCleanupStore.getState().visibleIds;
    const orderedIds = isCleanupView && cleanupIds.length
      ? cleanupIds
      : visibleIdsRef.current.length
      ? visibleIdsRef.current
      : [...visibleFolders, ...visibleFiles].map((f) => f.id);
    const { selectedIds, lastSelectedId } = useSelectionStore.getState();
    const result = computeSelection(
      file.id,
      orderedIds,
      new Set(selectedIds),
      lastSelectedId,
      { shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey }
    );
    useSelectionStore.getState().applySelectionResult(result);
  }

  function navigateTo(index: number) {
    if (sidebarView === "type") {
      if (index === 0) {
        router.push(driveRoutes.dashboard);
        useBrowseStore.getState().setSearch("");
        clearSelection();
      }
      return;
    }
    const crumb = folderStack[index];
    if (crumb.id === null) {
      router.push(sidebarView === "dashboard" ? driveRoutes.dashboard : driveRoutes.myDrive);
    } else {
      router.push(driveRoutes.folder(crumb.id));
    }
    setFolderStack(folderStack.slice(0, index + 1));
    useBrowseStore.getState().setSearch("");
    clearSelection();
  }

  function goBack() {
    if (sidebarView === "type") {
      router.push(driveRoutes.dashboard);
      useBrowseStore.getState().setSearch("");
      clearSelection();
      return;
    }
    if (!canGoBack) return;
    const parent = folderStack[folderStack.length - 2];
    if (parent.id === null) {
      router.push(sidebarView === "dashboard" ? driveRoutes.dashboard : driveRoutes.myDrive);
    } else {
      router.push(driveRoutes.folder(parent.id));
    }
    setFolderStack(folderStack.slice(0, -1));
    useBrowseStore.getState().setSearch("");
    clearSelection();
  }

  function captureCurrentViewScope(): ViewScope {
    if (isTagsView) {
      return { view: "tags", folderId: null, tagIds: [...routeTagIds], tagMode: routeTagMode };
    }
    if (sidebarView === "starred") return { view: "starred", folderId: null, tagIds: [], tagMode: "or" };
    if (sidebarView === "recent") return { view: "recent", folderId: null, tagIds: [], tagMode: "or" };
    if (sidebarView === "type" && typeCategory) {
      return { view: "type", folderId: null, tagIds: [], tagMode: "or", typeCategory };
    }
    if (sidebarView === "shared-links") {
      return { view: "dashboard", folderId: null, tagIds: [], tagMode: "or" };
    }
    if (sidebarView === "dashboard") return { view: "dashboard", folderId: null, tagIds: [], tagMode: "or" };
    return { view: "drive", folderId: routeFolderId, tagIds: [], tagMode: "or" };
  }

  function setTagFilterMode(mode: TagFilterMode) {
    if (scopeTagIds.length <= 1 || isSavedView) return;
    router.push(driveRoutes.tagFilter(scopeTagIds, mode));
  }

  function handleOpenFileFromActivity(fileId: string, fileName: string) {
    const file = files.find((f) => f.id === fileId);
    if (file) {
      setPreviewFile(file);
      return;
    }
    toast.info(`"${fileName}" is not available in the current view`);
  }

  return {
    openFile,
    handleItemSelect,
    navigateTo,
    goBack,
    captureCurrentViewScope,
    setTagFilterMode,
    handleOpenFileFromActivity,
  };
}
