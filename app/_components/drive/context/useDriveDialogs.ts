"use client";

import { useState } from "react";
import type { DriveFile } from "@/lib/drive/drive";
import { useSelectionStore } from "@/lib/stores";
import type { MenuPointer } from "../menu/FileMenu";

/**
 * Open/closed state for every modal, menu, and overlay in the drive shell,
 * plus the helpers that open them with the right selection side effects.
 */
export function useDriveDialogs() {
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  const [quickLookFile, setQuickLookFile] = useState<DriveFile | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [renameTarget, setRenameTarget] = useState<DriveFile | null>(null);
  const [shareTarget, setShareTarget] = useState<DriveFile | null>(null);
  const [moveTargets, setMoveTargets] = useState<DriveFile[] | null>(null);
  const [deleteForeverTargets, setDeleteForeverTargets] = useState<DriveFile[] | null>(null);
  const [emptyTrashConfirm, setEmptyTrashConfirm] = useState(false);
  const [bulkRenameOpen, setBulkRenameOpen] = useState(false);
  const [menu, setMenu] = useState<{ file: DriveFile; rect: DOMRect; pointer?: MenuPointer } | null>(null);
  const [tagManageOpen, setTagManageOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [tagPickerFileIds, setTagPickerFileIds] = useState<string[]>([]);
  const [tagPickerFileNames, setTagPickerFileNames] = useState<string[]>([]);
  const [tagPickerLabel, setTagPickerLabel] = useState("");
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [coverModalFolder, setCoverModalFolder] = useState<DriveFile | null>(null);

  function openTagPicker(targets: DriveFile[]) {
    setTagPickerFileIds(targets.map((t) => t.id));
    setTagPickerFileNames(targets.map((t) => t.name));
    setTagPickerLabel(
      targets.length === 1 ? targets[0].name : `${targets.length} items`
    );
    setTagPickerOpen(true);
  }

  function openMenu(file: DriveFile, anchor: HTMLElement, e?: React.MouseEvent) {
    setMenu({
      file,
      rect: anchor.getBoundingClientRect(),
      pointer: e ? { x: e.clientX, y: e.clientY } : undefined,
    });
    useSelectionStore.getState().setSelection([file.id], file.id);
  }

  function openQuickLook(file: DriveFile) {
    setQuickLookFile(file);
    useSelectionStore.getState().setSelection([file.id], file.id);
  }

  function closeQuickLook() {
    setQuickLookFile(null);
  }

  function handleQuickLookNavigate(file: DriveFile) {
    setQuickLookFile(file);
    useSelectionStore.getState().setSelection([file.id], file.id);
  }

  /** True while any overlay that should swallow keyboard shortcuts is open. */
  function isBlockingModalOpen() {
    return (
      globalSearchOpen || paletteOpen || shortcutsOpen || showNewFolder || renameTarget !== null ||
      shareTarget !== null || moveTargets !== null || deleteForeverTargets !== null ||
      emptyTrashConfirm || bulkRenameOpen || menu !== null ||
      tagManageOpen || tagPickerOpen || saveViewOpen || coverModalFolder !== null
    );
  }

  return {
    previewFile,
    setPreviewFile,
    quickLookFile,
    openQuickLook,
    closeQuickLook,
    handleQuickLookNavigate,
    sidebarCollapsed,
    setSidebarCollapsed,
    paletteOpen,
    setPaletteOpen,
    globalSearchOpen,
    setGlobalSearchOpen,
    shortcutsOpen,
    setShortcutsOpen,
    showNewFolder,
    setShowNewFolder,
    renameTarget,
    setRenameTarget,
    shareTarget,
    setShareTarget,
    moveTargets,
    setMoveTargets,
    deleteForeverTargets,
    setDeleteForeverTargets,
    emptyTrashConfirm,
    setEmptyTrashConfirm,
    bulkRenameOpen,
    setBulkRenameOpen,
    menu,
    setMenu,
    tagManageOpen,
    setTagManageOpen,
    tagPickerOpen,
    setTagPickerOpen,
    tagPickerFileIds,
    tagPickerFileNames,
    tagPickerLabel,
    saveViewOpen,
    setSaveViewOpen,
    coverModalFolder,
    setCoverModalFolder,
    openTagPicker,
    openMenu,
    isBlockingModalOpen,
  };
}
