import { type DriveFile, deleteForever, emptyTrash, isFolder, restoreFile, trashFile } from "@/lib/drive/drive";
import { runAsync } from "@/lib/ui/toast";
import { logActivity } from "@/lib/activity/log";
import { removeAllPinsForFile } from "@/lib/collections/pins";
import { removeFavoriteForFolder } from "@/lib/collections/favorites";
import { removeHiddenForFile } from "@/lib/collections/hidden";
import { removeInboxForFile } from "@/lib/collections/inbox";
import { removeCoversForFile, removeFolderCover } from "@/lib/collections/folder-covers";
import { invalidateFolderTreeForMutation } from "@/lib/cache/folder-children-cache";
import { invalidateTypeBrowseCountsCache } from "@/lib/cache/type-browse-counts-cache";
import { useFilesStore, useSelectionStore } from "@/lib/stores";
import { parentsFromFiles } from "./core";
import type { DriveActionContext } from "./types";

/** Trash, restore, delete forever, and empty trash. */
export function createTrashActions(ctx: DriveActionContext) {
  const { token, clearSelection, previewFile, setPreviewFile, markFolderWork, recordUndoAction, onFileDeleted } = ctx;

  async function handleTrashFiles(targets: DriveFile[]) {
    if (!token || !targets.length) return;
    const snapshot = [...targets];
    const multi = snapshot.length >= 2;
    if (multi) useSelectionStore.getState().setSelectionBusy(true, "Moving to trash…");
    const successMsg = snapshot.length === 1
      ? `Moved "${snapshot[0].name}" to trash`
      : `Moved ${snapshot.length} items to trash`;
    await runAsync({
      loading: snapshot.length === 1
        ? `Moving "${snapshot[0].name}" to trash…`
        : `Moving ${snapshot.length} items to trash…`,
      success: false,
      error: "Move to trash failed",
      fn: async () => {
        await Promise.all(snapshot.map((f) => trashFile(token, f.id)));
        await Promise.all(snapshot.map((f) => removeAllPinsForFile(f.id)));
        await Promise.all(snapshot.filter(isFolder).map((f) => removeFavoriteForFolder(f.id)));
        await Promise.all(snapshot.map((f) => removeHiddenForFile(f.id)));
        await Promise.all(snapshot.map((f) => removeInboxForFile(f.id)));
        await Promise.all(snapshot.map((f) => removeCoversForFile(f.id)));
        await Promise.all(
          snapshot.filter(isFolder).map((f) => removeFolderCover(f.id)),
        );
        snapshot.forEach((f) => onFileDeleted(f.id));
        if (previewFile && snapshot.some((f) => f.id === previewFile.id)) setPreviewFile(null);
        clearSelection();
        const undoFn = async () => {
          const restored = await Promise.all(snapshot.map((f) => restoreFile(token, f.id)));
          restored.forEach((f) => useFilesStore.getState().prependFile(f));
          invalidateFolderTreeForMutation({
            invalidateParents: parentsFromFiles(restored),
          });
          invalidateTypeBrowseCountsCache({ refreshToken: token });
        };
        await recordUndoAction({
          activityType: "trash",
          undoType: "trash",
          description: successMsg,
          fileIds: snapshot.map((f) => f.id),
          fileNames: snapshot.map((f) => f.name),
          undo: undoFn,
          undoData: { type: "trash", fileIds: snapshot.map((f) => f.id) },
        });
        markFolderWork(snapshot);
        invalidateFolderTreeForMutation({
          invalidateParents: parentsFromFiles(snapshot),
          removedFolderIds: snapshot.filter(isFolder).map((f) => f.id),
        });
        invalidateTypeBrowseCountsCache({ refreshToken: token });
      },
    });
    if (multi) useSelectionStore.getState().setSelectionBusy(false);
  }

  async function handleRestoreFiles(targets: DriveFile[]) {
    if (!token || !targets.length) return;
    const multi = targets.length >= 2;
    if (multi) useSelectionStore.getState().setSelectionBusy(true, "Restoring…");
    await runAsync({
      loading: targets.length === 1
        ? `Restoring "${targets[0].name}"…`
        : `Restoring ${targets.length} items…`,
      success: targets.length === 1
        ? `Restored "${targets[0].name}"`
        : `Restored ${targets.length} items`,
      error: "Restore failed",
      fn: async () => {
        await Promise.all(targets.map((f) => restoreFile(token, f.id)));
        targets.forEach((f) => onFileDeleted(f.id));
        clearSelection();
        const desc = targets.length === 1
          ? `Restored ${targets[0].name} from trash`
          : `Restored ${targets.length} files from trash`;
        await logActivity({
          type: "restore",
          description: desc,
          fileIds: targets.map((f) => f.id),
          fileNames: targets.map((f) => f.name),
          folderContext: "Trash",
        });
        invalidateFolderTreeForMutation({
          invalidateParents: parentsFromFiles(targets),
        });
        invalidateTypeBrowseCountsCache({ refreshToken: token });
      },
    });
    if (multi) useSelectionStore.getState().setSelectionBusy(false);
  }

  async function handleDeleteForever(targets: DriveFile[]) {
    if (!token || !targets.length) return;
    const multi = targets.length >= 2;
    if (multi) useSelectionStore.getState().setSelectionBusy(true, "Deleting…");
    await runAsync({
      loading: targets.length === 1
        ? `Deleting "${targets[0].name}"…`
        : `Deleting ${targets.length} items…`,
      success: targets.length === 1
        ? `"${targets[0].name}" deleted forever`
        : `${targets.length} items deleted forever`,
      error: "Delete failed",
      fn: async () => {
        await Promise.all(targets.map((f) => deleteForever(token, f.id)));
        await Promise.all(targets.map((f) => removeInboxForFile(f.id)));
        targets.forEach((f) => onFileDeleted(f.id));
        if (previewFile && targets.some((f) => f.id === previewFile.id)) setPreviewFile(null);
        clearSelection();
        const desc = targets.length === 1
          ? `Permanently deleted ${targets[0].name}`
          : `Permanently deleted ${targets.length} files`;
        await logActivity({
          type: "delete-forever",
          description: desc,
          fileIds: targets.map((f) => f.id),
          fileNames: targets.map((f) => f.name),
          folderContext: "Trash",
        });
        invalidateTypeBrowseCountsCache({ refreshToken: token });
      },
    });
    if (multi) useSelectionStore.getState().setSelectionBusy(false);
  }

  async function handleEmptyTrash() {
    if (!token) return;
    await runAsync({
      loading: "Emptying trash…",
      success: "Trash emptied",
      error: "Failed to empty trash",
      fn: async () => {
        await emptyTrash(token);
        useFilesStore.getState().clearFiles();
        clearSelection();
        invalidateTypeBrowseCountsCache({ refreshToken: token });
      },
    });
  }

  return { handleTrashFiles, handleRestoreFiles, handleDeleteForever, handleEmptyTrash };
}
