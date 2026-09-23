import type { DriveFile, StorageQuota } from "@/lib/drive/drive";
import type { FolderCrumb } from "@/lib/drive/types";
import type { Tag } from "@/lib/tags";
import type { DriveRouteState } from "./drive-browse-types";
import type { RefObject, Dispatch, SetStateAction } from "react";

export interface DriveFilesContext {
  folderStack: FolderCrumb[];
  setFolderStack: Dispatch<SetStateAction<FolderCrumb[]>>;
  currentFolder: FolderCrumb;
  canGoBack: boolean;
  folderContext: string;

  files: DriveFile[];
  loading: boolean;
  error: string | null;
  loadingMore: boolean;
  nextPageToken: string | undefined;
  loadFiles: () => Promise<void>;
  loadMore: () => Promise<void>;

  visibleFolders: DriveFile[];
  visibleFiles: DriveFile[];
  visibleIdsRef: RefObject<string[]>;
  visibleFilesRef: RefObject<DriveFile[]>;
  hasAnyVisible: boolean;
  isFiltering: boolean;
  isViewSavable: boolean;
  pageTitle: string;

  quota: StorageQuota | null;
  taggedFileIds: Set<string>;
}

export interface UseDriveFilesParams {
  token: string | null;
  routeState: DriveRouteState;
  tags: Tag[];
  tagsByFileId: Map<string, Tag[]>;
  scopeKey: string;
  clearSelection: () => void;
  onClearPreview: () => void;
}
