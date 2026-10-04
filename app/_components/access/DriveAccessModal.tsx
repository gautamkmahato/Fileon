"use client";

import { useCallback } from "react";
import { Modal } from "../ui/Modal";
import { useAuth } from "../auth/AuthProvider";
import { useDriveBrowse } from "../drive/context/DriveBrowseProvider";
import { invalidateFilesCache, useAccessStore } from "@/lib/stores";
import { clearFolderChildrenCache } from "@/lib/cache/folder-children-cache";
import { invalidateTypeBrowseCountsCache } from "@/lib/cache/type-browse-counts-cache";
import { clearFolderItemCountCache } from "@/lib/cache/folder-item-count-cache";
import { toast } from "@/lib/ui/toast";
import { DriveAccessSetup } from "./DriveAccessSetup";

/** "Add from Google Drive" inside the app. Refreshes lists once new files are granted. */
export function DriveAccessModal() {
  const { token } = useAuth();
  const { loadFiles } = useDriveBrowse();
  const open = useAccessStore((s) => s.setupOpen);
  const close = useAccessStore((s) => s.closeSetup);

  const handleFinished = useCallback(
    (summary: { filesGranted: number; foldersGranted: number }) => {
      close();
      const total = summary.filesGranted + summary.foldersGranted;
      if (total === 0) return;
      invalidateFilesCache();
      clearFolderChildrenCache();
      clearFolderItemCountCache();
      invalidateTypeBrowseCountsCache({ refreshToken: token });
      void loadFiles();
      toast.success(`Added ${summary.filesGranted} file${summary.filesGranted === 1 ? "" : "s"} and ${summary.foldersGranted} folder${summary.foldersGranted === 1 ? "" : "s"}`);
    },
    [close, loadFiles, token],
  );

  return (
    <Modal open={open} onClose={close} title="Add from Google Drive" width="max-w-lg">
      <DriveAccessSetup token={token} mode="add" onFinished={handleFinished} />
    </Modal>
  );
}
