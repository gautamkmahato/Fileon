import type { DriveFile } from "@/lib/drive/drive";
import { moveFile } from "@/lib/drive/drive-extras";
import { runAsync } from "@/lib/ui/toast";
import { invalidateFolderTreeForMutation } from "@/lib/cache/folder-children-cache";
import { isFolderBrowseView } from "@/lib/drive/browse-scope";
import { useFilesStore, useSelectionStore } from "@/lib/stores";
import { parentIdForFolderTree } from "./core";
import type { DriveActionContext } from "./types";

/** Moving files between folders (single + bulk, with undo). */
export function createMoveActions(ctx: DriveActionContext) {
  const { token, route, filesCtx, clearSelection, previewFile, setPreviewFile, markFolderWork, recordUndoAction, onFileDeleted } = ctx;
  const { sidebarView } = route;
  const { currentFolder, files } = filesCtx;

  async function handleMove(file: DriveFile, newParentId: string) {
    if (!token) return;
    const oldParentId = file.parents?.[0] || (currentFolder.id || "root");
    await moveFile({ token, fileId: file.id, newParentId, oldParentId });
    const isStillHere = newParentId === (currentFolder.id || "root") && isFolderBrowseView(sidebarView);
    if (!isStillHere) {
      onFileDeleted(file.id);
      if (previewFile?.id === file.id) setPreviewFile(null);
    }
  }

  async function handleMoveMany(targets: DriveFile[], newParentId: string, destName?: string) {
    if (!token || !targets.length) return;
    const snapshot = targets.map((file) => ({
      file,
      oldParentId: file.parents?.[0] || (currentFolder.id || "root"),
    }));
    const multi = snapshot.length >= 2;
    if (multi) useSelectionStore.getState().setSelectionBusy(true, "Moving…");
    const destination = destName ?? files.find((f) => f.id === newParentId)?.name ?? "folder";
    const successMsg = snapshot.length === 1
      ? `Moved "${snapshot[0].file.name}" to ${destination}`
      : `Moved ${snapshot.length} files to ${destination}`;
    await runAsync({
      loading: snapshot.length === 1
        ? `Moving "${snapshot[0].file.name}"…`
        : `Moving ${snapshot.length} items…`,
      success: false,
      error: (err) => `Move failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      fn: async () => {
        await Promise.all(snapshot.map(({ file }) => handleMove(file, newParentId)));
        clearSelection();
        const undoFn = async () => {
          for (const { file, oldParentId } of snapshot) {
            await moveFile({ token, fileId: file.id, newParentId: oldParentId, oldParentId: newParentId });
            const currentParent = currentFolder.id || "root";
            if (oldParentId === currentParent && isFolderBrowseView(sidebarView)) {
              useFilesStore.getState().prependFile({ ...file, parents: [oldParentId] });
            }
          }
          invalidateFolderTreeForMutation({
            invalidateParents: [
              parentIdForFolderTree(newParentId),
              ...snapshot.map(({ oldParentId }) => parentIdForFolderTree(oldParentId)),
            ],
          });
        };
        await recordUndoAction({
          activityType: "move",
          undoType: "move",
          description: successMsg,
          fileIds: snapshot.map(({ file }) => file.id),
          fileNames: snapshot.map(({ file }) => file.name),
          undo: undoFn,
          undoData: {
            type: "move",
            fileIds: snapshot.map(({ file }) => file.id),
            oldParentIds: snapshot.map(({ oldParentId }) => oldParentId),
            newParentId,
          },
        });
        markFolderWork(
          snapshot.map(({ file }) => file),
          { destinationFolderId: newParentId !== "root" ? newParentId : null },
        );
        invalidateFolderTreeForMutation({
          invalidateParents: [
            parentIdForFolderTree(newParentId),
            ...snapshot.map(({ oldParentId }) => parentIdForFolderTree(oldParentId)),
          ],
        });
      },
    });
    if (multi) useSelectionStore.getState().setSelectionBusy(false);
  }

  return { handleMoveMany };
}
