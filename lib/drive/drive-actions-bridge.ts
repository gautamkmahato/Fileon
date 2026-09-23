import type { DriveFile } from "@/lib/drive/drive";

/** Latest handler implementations — updated each browse logic render. */
export interface DriveActionHandlers {
  openFile: (file: DriveFile) => void;
  openQuickLook: (file: DriveFile) => void;
  handleItemSelect: (file: DriveFile, e: React.MouseEvent) => void;
  openMenu: (file: DriveFile, anchor: HTMLElement, e?: React.MouseEvent) => void;
  handleToggleStar: (file: DriveFile) => void;
  handleRestoreFiles: (targets: DriveFile[]) => void;
  setDeleteForeverTargets: (files: DriveFile[] | null) => void;
  onItemDragStart: (e: React.DragEvent, fileId: string) => void;
  onFolderDragOver: (e: React.DragEvent) => void;
  onFolderDrop: (e: React.DragEvent, folderId: string) => void;
  setFolderDropTarget: (id: string | null) => void;
}

const handlers: { current: DriveActionHandlers | null } = { current: null };

export function syncDriveActionHandlers(next: DriveActionHandlers): void {
  handlers.current = next;
}

function call<K extends keyof DriveActionHandlers>(
  key: K,
  ...args: Parameters<DriveActionHandlers[K]>
): void {
  const fn = handlers.current?.[key];
  if (!fn) return;
  (fn as (...a: Parameters<DriveActionHandlers[K]>) => void)(...args);
}

/** Stable function identities for memoized list items — delegates to latest handlers. */
export const driveActions = {
  openFile: (file: DriveFile) => call("openFile", file),
  openQuickLook: (file: DriveFile) => call("openQuickLook", file),
  handleItemSelect: (file: DriveFile, e: React.MouseEvent) => call("handleItemSelect", file, e),
  openMenu: (file: DriveFile, anchor: HTMLElement, e?: React.MouseEvent) => call("openMenu", file, anchor, e),
  handleToggleStar: (file: DriveFile) => call("handleToggleStar", file),
  handleRestoreOne: (file: DriveFile) => call("handleRestoreFiles", [file]),
  setDeleteForeverOne: (file: DriveFile) => call("setDeleteForeverTargets", [file]),
  onItemDragStart: (e: React.DragEvent, fileId: string) => call("onItemDragStart", e, fileId),
  onFolderDragOver: (e: React.DragEvent, folderId: string) => {
    call("onFolderDragOver", e);
    call("setFolderDropTarget", folderId);
  },
  onFolderDragLeave: () => call("setFolderDropTarget", null),
  onFolderDrop: (e: React.DragEvent, folderId: string) => {
    call("onFolderDrop", e, folderId);
    call("setFolderDropTarget", null);
  },
};
