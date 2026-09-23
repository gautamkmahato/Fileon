"use client";

import { CommandPalette } from "../../ui/CommandPalette";
import { GlobalSearchModal } from "../../layout/GlobalSearchModal";
import { SelectionBar } from "../../ui/SelectionBar";
import { DropOverlay } from "../../ui/DropOverlay";
import { ShortcutsModal } from "../../ui/ShortcutsModal";
import { ClipboardBar } from "../../ui/ClipboardBar";
import { FilePreview } from "../preview/FilePreview";
import { QuickLook } from "../preview/QuickLook";
import { useDriveBrowse } from "../context/DriveBrowseProvider";
import { useHidden } from "../../hidden/HiddenProvider";
import { toast } from "@/lib/toast";
import { useSelectionCount, useSelectionStore, useClipboardActive, getSelectedDriveFiles } from "@/lib/stores";

function DriveSelectionBar() {
  const count = useSelectionCount();
  const busy = useSelectionStore((s) => s.selectionBusy);
  const busyLabel = useSelectionStore((s) => s.selectionBusyLabel);
  const b = useDriveBrowse();
  const { isHidden, hideMany } = useHidden();

  async function handleArchive() {
    const items = getSelectedDriveFiles();
    if (!items.length) return;
    const toArchive = items.filter((f) => !isHidden(f.id));
    if (!toArchive.length) {
      toast.info("Already archived (hidden)");
      return;
    }
    await hideMany(toArchive.map((f) => f.id));
    toast.success(
      toArchive.length === 1 ? `Archived "${toArchive[0].name}"` : `Archived ${toArchive.length} items`,
    );
    useSelectionStore.getState().clearSelection();
  }

  return (
    <SelectionBar
      count={count}
      busy={busy}
      busyLabel={busyLabel}
      isTrash={b.isTrashView}
      allowSingleActions={b.isCleanupView}
      onDownload={b.handleBulkDownload}
      onMove={() => b.setMoveTargets(getSelectedDriveFiles())}
      onTrash={() => b.handleTrashFiles(getSelectedDriveFiles())}
      onRename={() => b.setBulkRenameOpen(true)}
      onTag={() => b.openTagPicker(getSelectedDriveFiles())}
      onArchive={b.isCleanupView ? () => void handleArchive() : undefined}
      onToggleHide={
        !b.isTrashView && !b.isActivityView
          ? () => void b.handleToggleHidden(getSelectedDriveFiles())
          : undefined
      }
      hideActionLabel={b.isHiddenView ? "Unhide" : "Hide"}
      onRestore={() => b.handleRestoreFiles(getSelectedDriveFiles())}
      onDeleteForever={() => b.setDeleteForeverTargets(getSelectedDriveFiles())}
      onClear={() => useSelectionStore.getState().clearSelection()}
    />
  );
}

/** Global overlays: selection bar, drop zone, preview, quick look, command palette. */
export function DriveOverlays() {
  const b = useDriveBrowse();
  const selectionCount = useSelectionCount();
  const clipboardActive = useClipboardActive();

  return (
    <>
      <DropOverlay
        visible={b.dragDrop.isWindowDragOver || b.uploading}
        folderName={b.currentFolder.name}
        uploading={b.uploading}
        uploadLabel={b.uploadLabel}
      />
      <DriveSelectionBar />
      <ClipboardBar
        onCancel={b.handleCancelClipboard}
        elevated={clipboardActive && selectionCount > 0}
      />
      <GlobalSearchModal
        open={b.globalSearchOpen}
        onClose={() => b.setGlobalSearchOpen(false)}
        token={b.token}
        onOpenFile={b.openFile}
      />
      <CommandPalette
        open={b.paletteOpen}
        onClose={() => b.setPaletteOpen(false)}
        files={b.files}
        actions={b.paletteActions}
        onOpenFile={b.openFile}
        onRunAction={b.runPaletteAction}
      />
      <ShortcutsModal open={b.shortcutsOpen} onClose={() => b.setShortcutsOpen(false)} />
      <FilePreview
        file={b.previewFile}
        onClose={() => b.setPreviewFile(null)}
        onFileChanged={b.onFileChanged}
        onFileDeleted={b.onFileDeleted}
        fileTags={b.previewFile ? (b.tagsByFileId.get(b.previewFile.id) ?? []) : []}
        onEditTags={b.previewFile ? () => b.openTagPicker([b.previewFile!]) : undefined}
      />
      {b.quickLookFile && (
        <QuickLook
          file={b.quickLookFile}
          files={b.visibleFiles}
          userEmail={b.profile?.email}
          onClose={b.closeQuickLook}
          onChangeFile={b.handleQuickLookNavigate}
        />
      )}
    </>
  );
}
