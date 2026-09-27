import type { useRouter } from "next/navigation";
import type { DriveFile } from "@/lib/drive/drive";
import type { ActivityType, ActivityUndoData } from "@/lib/activity/log";
import type { UndoActionType } from "@/lib/activity/undo";
import type { DriveRouteState } from "../drive-browse-types";
import type { DriveFilesContext } from "../drive-files-types";

export interface RecordUndoOptions {
  activityType: ActivityType;
  undoType: UndoActionType;
  description: string;
  fileIds: string[];
  fileNames: string[];
  undo: () => Promise<void>;
  undoData?: ActivityUndoData;
  ctx?: string;
}

/** Everything an action group needs; built once per render in `useDriveActions`. */
export interface DriveActionContext {
  token: string | null;
  router: ReturnType<typeof useRouter>;
  route: DriveRouteState;
  filesCtx: DriveFilesContext;
  clearSelection: () => void;
  previewFile: DriveFile | null;
  setPreviewFile: (file: DriveFile | null) => void;
  /** Track "recently worked in" folders for the sidebar shortcuts. */
  markFolderWork: (items?: DriveFile | DriveFile[], opts?: { destinationFolderId?: string | null }) => void;
  /** Log an activity entry and push an undo toast for it. */
  recordUndoAction: (opts: RecordUndoOptions) => Promise<void>;
  /** Propagate a file update to every store that mirrors file metadata. */
  onFileChanged: (updated: DriveFile) => void;
  /** Remove a file from every store after trash/delete/move-away. */
  onFileDeleted: (id: string) => void;
}
