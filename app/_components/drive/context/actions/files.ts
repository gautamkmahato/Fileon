import { type DriveFile, createFolder, isFolder, renameFile, uploadFile } from "@/lib/drive/drive";
import { downloadFilesAsZip } from "@/lib/utils/bulk-download";
import { toast, runAsync, updateLoading } from "@/lib/ui/toast";
import { logActivity } from "@/lib/activity/log";
import { addToInbox } from "@/lib/collections/inbox";
import { invalidateFolderTreeForMutation } from "@/lib/cache/folder-children-cache";
import { invalidateTypeBrowseCountsCache } from "@/lib/cache/type-browse-counts-cache";
import { isFolderBrowseView } from "@/lib/drive/browse-scope";
import { getSelectedDriveFiles, useFilesStore, useSelectionStore } from "@/lib/stores";
import { downloadToBrowser } from "./core";
import type { DriveActionContext } from "./types";

interface FileActionDeps {
  /** Whether an upload batch is already running (from the files store). */
  uploading: boolean;
}

/** Create, upload, download, and rename. */
export function createFileActions(ctx: DriveActionContext, deps: FileActionDeps) {
  const { token, route, filesCtx, markFolderWork, recordUndoAction, onFileChanged } = ctx;
  const { sidebarView } = route;
  const { currentFolder, folderContext } = filesCtx;

  async function handleCreateFolder(name: string) {
    if (!token) return;
    await runAsync({
      loading: `Creating folder "${name}"…`,
      success: `Created folder "${name}"`,
      error: "Failed to create folder",
      fn: async () => {
        const created = await createFolder(token, name, currentFolder.id);
        useFilesStore.getState().prependFile(created);
        await logActivity({
          type: "create-folder",
          description: `Created folder "${name}"`,
          fileIds: [created.id],
          fileNames: [name],
          folderContext,
        });
        markFolderWork();
        invalidateFolderTreeForMutation({
          invalidateParents: [currentFolder.id ?? null],
        });
        return created;
      },
    });
  }

  async function handleUpload(fileList: FileList | null) {
    if (!token || !fileList?.length || !isFolderBrowseView(sidebarView) || deps.uploading) return;
    const toUpload = Array.from(fileList);
    useFilesStore.getState().setUploading(true);
    const toastId = toast.loading(
      toUpload.length === 1
        ? `Uploading "${toUpload[0].name}"…`
        : `Uploading 1 of ${toUpload.length}…`
    );
    let succeeded = 0;
    const uploadedFiles: DriveFile[] = [];
    try {
      for (let i = 0; i < toUpload.length; i++) {
        const f = toUpload[i];
        const label = toUpload.length === 1
          ? `Uploading "${f.name}"…`
          : `Uploading ${i + 1} of ${toUpload.length}: ${f.name}`;
        useFilesStore.getState().setUploading(true, label);
        updateLoading(label, toastId);
        try {
          const uploaded = await uploadFile({ token, file: f, parentId: currentFolder.id });
          useFilesStore.getState().prependFile(uploaded);
          uploadedFiles.push(uploaded);
          succeeded++;
        } catch (err) {
          console.error(err);
          toast.error(`Upload failed: ${f.name}`);
        }
      }
      if (succeeded > 0) {
        const uploadDesc = succeeded === 1 && toUpload.length === 1
          ? `Uploaded "${toUpload[0].name}" to ${folderContext}`
          : `Uploaded ${succeeded} file${succeeded === 1 ? "" : "s"} to ${folderContext}`;
        await logActivity({
          type: "upload",
          description: uploadDesc,
          fileIds: uploadedFiles.map((f) => f.id),
          fileNames: uploadedFiles.map((f) => f.name),
          folderContext,
        });
        markFolderWork(uploadedFiles);
        invalidateTypeBrowseCountsCache({ refreshToken: token });
        const inboxIds = uploadedFiles.filter((f) => !isFolder(f)).map((f) => f.id);
        if (inboxIds.length) {
          try { await addToInbox(inboxIds); } catch { /* inbox is best-effort */ }
        }
        toast.success(
          succeeded === 1 && toUpload.length === 1
            ? `Uploaded "${toUpload[0].name}"`
            : `Uploaded ${succeeded} file${succeeded === 1 ? "" : "s"}`,
          { id: toastId }
        );
      } else {
        toast.dismiss(toastId);
      }
    } finally {
      useFilesStore.getState().setUploading(false);
    }
  }

  async function handleDownload(file: DriveFile) {
    if (!token) return;
    await runAsync({
      loading: `Downloading "${file.name}"…`,
      success: "Download started",
      error: "Download failed",
      fn: async () => {
        await downloadToBrowser(token, file);
        markFolderWork(file);
      },
    });
  }

  async function handleBulkDownload() {
    if (!token) return;
    const targets = getSelectedDriveFiles().filter((f) => !isFolder(f));
    if (!targets.length) return;
    useSelectionStore.getState().setSelectionBusy(
      true,
      targets.length === 1 ? "Downloading…" : `Preparing ${targets.length} files…`
    );
    await runAsync({
      loading: targets.length === 1
        ? `Downloading "${targets[0].name}"…`
        : `Preparing download (${targets.length} files)…`,
      success: "Download started",
      error: "Download failed",
      fn: async () => {
        if (targets.length === 1) {
          await downloadToBrowser(token, targets[0]);
        } else {
          await downloadFilesAsZip(token, targets);
        }
        markFolderWork(targets);
      },
    });
    useSelectionStore.getState().setSelectionBusy(false);
  }

  async function handleRename(file: DriveFile, newName: string) {
    if (!token) return;
    const oldName = file.name;
    if (newName === oldName) return;
    await runAsync({
      loading: "Renaming…",
      success: false,
      error: "Rename failed",
      fn: async () => {
        const updated = await renameFile(token, file.id, newName);
        onFileChanged(updated);
        const desc = `Renamed ${oldName} → ${newName}`;
        const undoFn = async () => {
          const reverted = await renameFile(token, file.id, oldName);
          onFileChanged(reverted);
          if (isFolder(file)) {
            invalidateFolderTreeForMutation({
              renamed: [{ id: file.id, name: oldName }],
            });
          }
        };
        await recordUndoAction({
          activityType: "rename",
          undoType: "rename",
          description: desc,
          fileIds: [file.id],
          fileNames: [newName],
          undo: undoFn,
          undoData: { type: "rename", fileIds: [file.id], oldNames: [oldName], newNames: [newName] },
        });
        markFolderWork(file);
        if (isFolder(file)) {
          invalidateFolderTreeForMutation({
            renamed: [{ id: file.id, name: newName }],
          });
        }
        return updated;
      },
    });
  }

  return { handleCreateFolder, handleUpload, handleDownload, handleBulkDownload, handleRename };
}
