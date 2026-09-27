import type { DriveFile } from "@/lib/drive/drive";
import { copyFile } from "@/lib/drive/drive-extras";
import { toast, runAsync } from "@/lib/ui/toast";
import { isFolderBrowseView } from "@/lib/drive/browse-scope";
import { getSelectedDriveFiles, useClipboardStore, useFilesStore, useSelectionStore } from "@/lib/stores";
import type { DriveActionContext } from "./types";

interface ClipboardDeps {
  handleMoveMany: (targets: DriveFile[], newParentId: string, destName?: string) => Promise<void>;
}

/** Cut / copy / paste between folders. */
export function createClipboardActions(ctx: DriveActionContext, deps: ClipboardDeps) {
  const { token, route, filesCtx, clearSelection, markFolderWork } = ctx;
  const { sidebarView, isTrashView } = route;
  const { currentFolder, loadFiles } = filesCtx;

  function folderKeyForClipboard(): string {
    return currentFolder.id ?? "root";
  }

  function handleCut() {
    if (isTrashView || !isFolderBrowseView(sidebarView)) {
      toast.info("Cut is only available in folder view");
      return;
    }
    const items = getSelectedDriveFiles();
    if (!items.length) return;
    useClipboardStore.getState().setCut(items, folderKeyForClipboard());
    toast.success(
      items.length === 1
        ? `Cut "${items[0].name}" — ⌘V to paste`
        : `${items.length} files cut — ⌘V to paste`
    );
  }

  function handleCopy() {
    if (isTrashView || !isFolderBrowseView(sidebarView)) {
      toast.info("Copy is only available in folder view");
      return;
    }
    const items = getSelectedDriveFiles();
    if (!items.length) return;
    useClipboardStore.getState().setCopy(items, folderKeyForClipboard());
    toast.success(
      items.length === 1
        ? `Copied "${items[0].name}"`
        : `Copied ${items.length} files`
    );
  }

  function handleCancelClipboard() {
    useClipboardStore.getState().clear();
  }

  async function handlePaste() {
    if (!token) return;
    const { mode, items } = useClipboardStore.getState();
    if (!mode || !items.length) return;
    if (isTrashView || !isFolderBrowseView(sidebarView)) {
      toast.info("Paste into a folder in My Drive");
      return;
    }

    const destId = currentFolder.id ?? "root";
    const asFiles: DriveFile[] = items.map((item) => ({
      id: item.id,
      name: item.name,
      mimeType: item.mimeType,
      parents: item.parents,
    }));

    if (mode === "cut") {
      const allSameFolder = items.every(
        (item) => (item.parents?.[0] ?? "root") === destId
      );
      if (allSameFolder) {
        toast.info("Items are already in this folder");
        useClipboardStore.getState().clear();
        return;
      }
      await deps.handleMoveMany(asFiles, destId, currentFolder.name);
      await loadFiles();
      useClipboardStore.getState().clear();
      return;
    }

    const multi = items.length >= 2;
    if (multi) useSelectionStore.getState().setSelectionBusy(true, "Copying…");
    let copied: DriveFile[] = [];
    await runAsync({
      loading: items.length === 1
        ? `Copying "${items[0].name}"…`
        : `Copying ${items.length} items…`,
      success: items.length === 1
        ? `Copied "${items[0].name}" here`
        : `Copied ${items.length} items here`,
      error: "Copy failed",
      fn: async () => {
        copied = await Promise.all(
          items.map((item) => copyFile({ token, fileId: item.id, newParentId: destId }))
        );
        if (destId === folderKeyForClipboard()) {
          copied.forEach((f) => useFilesStore.getState().prependFile(f));
        } else {
          await loadFiles();
        }
        clearSelection();
      },
    });
    if (copied.length) {
      markFolderWork(copied, {
        destinationFolderId: destId !== "root" ? destId : null,
      });
    }
    if (multi) useSelectionStore.getState().setSelectionBusy(false);
    useClipboardStore.getState().clear();
  }

  return { handleCut, handleCopy, handleCancelClipboard, handlePaste };
}
