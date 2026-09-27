import { type DriveFile, uploadFile } from "@/lib/drive/drive";
import { toast, runAsync } from "@/lib/ui/toast";
import type { CoverPosition } from "@/lib/collections/folder-covers";
import type { useFolderCovers } from "../../../folder-covers/FolderCoversProvider";
import type { DriveActionContext } from "./types";

type FolderCoverDeps = Pick<ReturnType<typeof useFolderCovers>, "setCover" | "removeCover">;

/** Folder cover image management. */
export function createFolderCoverActions(ctx: DriveActionContext, deps: FolderCoverDeps) {
  const { token, markFolderWork } = ctx;

  async function handleSetFolderCover(
    folderId: string,
    coverFileId: string,
    position: CoverPosition = "center",
  ) {
    await deps.setCover(folderId, coverFileId, position);
    markFolderWork(undefined, { destinationFolderId: folderId });
    toast.success("Cover image set");
  }

  async function handleRemoveFolderCover(folderId: string) {
    await deps.removeCover(folderId);
    markFolderWork(undefined, { destinationFolderId: folderId });
    toast.success("Cover removed");
  }

  async function handleUploadFolderCover(folder: DriveFile, file: File) {
    if (!token) return;
    await runAsync({
      loading: "Uploading cover…",
      success: "Cover uploaded and set",
      error: "Upload failed",
      fn: async () => {
        const uploaded = await uploadFile({ token, file, parentId: folder.id });
        await deps.setCover(folder.id, uploaded.id, "center");
        markFolderWork(folder);
      },
    });
  }

  return { handleSetFolderCover, handleRemoveFolderCover, handleUploadFolderCover };
}
