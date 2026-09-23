import type { DriveFile, StorageQuota } from "@/lib/drive/drive";
import type { ViewMode, FolderCrumb } from "@/lib/drive/types";
import type { Filters } from "@/lib/utils/filter";
import type { SortState } from "@/lib/utils/sort";
import type { TagFilterMode } from "@/lib/tags";
import type { ViewScope } from "@/lib/views";
import type { MenuPointer } from "../menu/FileMenu";
import type { PaletteActionId } from "../../ui/CommandPalette";
import type { useDriveRoute } from "@/lib/drive/useDriveRoute";

export type DriveRouteState = ReturnType<typeof useDriveRoute>;

export interface DriveBrowseContextValue extends DriveRouteState {
  token: string | null;
  profile: { email?: string; name?: string; given_name?: string; picture?: string } | null;
  signOut: () => void;

  folderStack: FolderCrumb[];
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

  view: ViewMode;
  setView: (mode: ViewMode) => void;
  search: string;
  setSearch: (value: string) => void;
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  fileSort: SortState;
  setFileSort: React.Dispatch<React.SetStateAction<SortState>>;

  visibleFolders: DriveFile[];
  visibleFiles: DriveFile[];
  hasAnyVisible: boolean;
  isFiltering: boolean;
  isViewSavable: boolean;
  pageTitle: string;

  clearSelection: () => void;
  handleItemSelect: (file: DriveFile, e: React.MouseEvent) => void;

  previewFile: DriveFile | null;
  setPreviewFile: (file: DriveFile | null) => void;
  quickLookFile: DriveFile | null;
  openQuickLook: (file: DriveFile) => void;
  closeQuickLook: () => void;
  handleQuickLookNavigate: (file: DriveFile) => void;

  quota: StorageQuota | null;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;

  uploading: boolean;
  uploadLabel: string;
  uploadInputRef: React.RefObject<HTMLInputElement | null>;

  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  globalSearchOpen: boolean;
  setGlobalSearchOpen: (open: boolean) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
  paletteActions: ReturnType<typeof import("../../ui/CommandPalette").buildDefaultActions>;

  showNewFolder: boolean;
  setShowNewFolder: (open: boolean) => void;
  renameTarget: DriveFile | null;
  setRenameTarget: (file: DriveFile | null) => void;
  shareTarget: DriveFile | null;
  setShareTarget: (file: DriveFile | null) => void;
  moveTargets: DriveFile[] | null;
  setMoveTargets: (files: DriveFile[] | null) => void;
  deleteForeverTargets: DriveFile[] | null;
  setDeleteForeverTargets: (files: DriveFile[] | null) => void;
  emptyTrashConfirm: boolean;
  setEmptyTrashConfirm: (open: boolean) => void;
  bulkRenameOpen: boolean;
  setBulkRenameOpen: (open: boolean) => void;
  menu: { file: DriveFile; rect: DOMRect; pointer?: MenuPointer } | null;
  setMenu: (menu: { file: DriveFile; rect: DOMRect; pointer?: MenuPointer } | null) => void;
  tagManageOpen: boolean;
  setTagManageOpen: (open: boolean) => void;
  tagPickerOpen: boolean;
  setTagPickerOpen: (open: boolean) => void;
  tagPickerFileIds: string[];
  tagPickerFileNames: string[];
  tagPickerLabel: string;
  saveViewOpen: boolean;
  setSaveViewOpen: (open: boolean) => void;
  coverModalFolder: DriveFile | null;
  setCoverModalFolder: (folder: DriveFile | null) => void;

  openFile: (file: DriveFile) => void;
  navigateTo: (index: number) => void;
  goBack: () => void;
  openMenu: (file: DriveFile, anchor: HTMLElement, e?: React.MouseEvent) => void;
  openTagPicker: (targets: DriveFile[]) => void;
  captureCurrentViewScope: () => ViewScope;
  setTagFilterMode: (mode: TagFilterMode) => void;
  handleOpenFileFromActivity: (fileId: string, fileName: string) => void;
  runPaletteAction: (id: PaletteActionId) => void;

  handleCreateFolder: (name: string) => Promise<void>;
  handleUpload: (fileList: FileList | null) => Promise<void>;
  handleToggleStar: (file: DriveFile) => Promise<void>;
  handleTogglePin: (targets?: DriveFile[]) => Promise<void>;
  handleToggleFavorite: (targets?: DriveFile[]) => Promise<void>;
  handleToggleHidden: (targets?: DriveFile[]) => Promise<void>;
  handleSetFolderCover: (folderId: string, coverFileId: string, position?: import("@/lib/folder-covers").CoverPosition) => Promise<void>;
  handleRemoveFolderCover: (folderId: string) => Promise<void>;
  handleUploadFolderCover: (folder: DriveFile, file: File) => Promise<void>;
  handleCut: () => void;
  handleCopy: () => void;
  handlePaste: () => Promise<void>;
  handleCancelClipboard: () => void;
  onFileChanged: (updated: DriveFile) => void;
  onFileDeleted: (id: string) => void;
  handleDownload: (file: DriveFile) => Promise<void>;
  handleRename: (file: DriveFile, newName: string) => Promise<void>;
  handleTrashFiles: (targets: DriveFile[]) => Promise<void>;
  handleRestoreFiles: (targets: DriveFile[]) => Promise<void>;
  handleDeleteForever: (targets: DriveFile[]) => Promise<void>;
  handleEmptyTrash: () => Promise<void>;
  handleMoveMany: (targets: DriveFile[], newParentId: string, destName?: string) => Promise<void>;
  handleBulkDownload: () => Promise<void>;

  dragDrop: ReturnType<typeof import("@/lib/hooks/useDragDrop").useDragDrop>;
  tagsByFileId: Map<string, import("@/lib/tags").Tag[]>;
  tags: import("@/lib/tags").Tag[];
  counts: Map<string, number>;
}
