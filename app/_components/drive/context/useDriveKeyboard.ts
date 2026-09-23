"use client";

import { useEffect, useRef } from "react";
import type { DriveFile } from "@/lib/drive/drive";
import { isFolder } from "@/lib/drive/drive";
import { isInputFocused } from "../../ui/ShortcutsModal";
import { useClipboardStore, useFilesStore, useSelectionStore } from "@/lib/stores";

function resolveQuickLookFile(
  fileId: string,
  visibleFiles: DriveFile[] | undefined,
): DriveFile | undefined {
  const fromVisible = visibleFiles?.find((f) => f.id === fileId);
  if (fromVisible) return fromVisible;
  const fromStore = useFilesStore.getState().files.find((f) => f.id === fileId);
  if (fromStore && !isFolder(fromStore)) return fromStore;
  return undefined;
}

export interface UseDriveKeyboardParams {
  quickLookFile: DriveFile | null;
  previewFile: DriveFile | null;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  globalSearchOpen: boolean;
  setGlobalSearchOpen: (open: boolean) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
  setPreviewFile: (file: DriveFile | null) => void;
  clearSelection: () => void;
  openQuickLook: (file: DriveFile) => void;
  visibleFilesRef: React.RefObject<DriveFile[]>;
  visibleIdsRef: React.RefObject<string[]>;
  isBlockingModalOpen: () => boolean;
  canUndo: () => boolean;
  executeUndo: () => Promise<boolean | void>;
  handleTogglePin: () => void;
  handleCut: () => void;
  handleCopy: () => void;
  handlePaste: () => void;
  handleCancelClipboard: () => void;
}

/** Global keyboard shortcuts — single listener via refs to avoid re-registration churn. */
export function useDriveKeyboard({
  quickLookFile,
  previewFile,
  paletteOpen,
  setPaletteOpen,
  globalSearchOpen,
  setGlobalSearchOpen,
  shortcutsOpen,
  setShortcutsOpen,
  setPreviewFile,
  clearSelection,
  openQuickLook,
  visibleFilesRef,
  visibleIdsRef,
  isBlockingModalOpen,
  canUndo,
  executeUndo,
  handleTogglePin,
  handleCut,
  handleCopy,
  handlePaste,
  handleCancelClipboard,
}: UseDriveKeyboardParams) {
  const stateRef = useRef({
    quickLookFile,
    previewFile,
    paletteOpen,
    globalSearchOpen,
    shortcutsOpen,
    setPaletteOpen,
    setGlobalSearchOpen,
    setPreviewFile,
    setShortcutsOpen,
    clearSelection,
    openQuickLook,
    visibleFilesRef,
    visibleIdsRef,
    isBlockingModalOpen,
    canUndo,
    executeUndo,
    handleTogglePin,
    handleCut,
    handleCopy,
    handlePaste,
    handleCancelClipboard,
  });
  stateRef.current = {
    quickLookFile,
    previewFile,
    paletteOpen,
    globalSearchOpen,
    shortcutsOpen,
    setPaletteOpen,
    setGlobalSearchOpen,
    setPreviewFile,
    setShortcutsOpen,
    clearSelection,
    openQuickLook,
    visibleFilesRef,
    visibleIdsRef,
    isBlockingModalOpen,
    canUndo,
    executeUndo,
    handleTogglePin,
    handleCut,
    handleCopy,
    handlePaste,
    handleCancelClipboard,
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isInputFocused()) return;

      const s = stateRef.current;

      if (s.quickLookFile) {
        if (
          e.key === " " || e.code === "Space" || e.key === "Escape" ||
          e.key === "ArrowLeft" || e.key === "ArrowRight"
        ) return;
      }

      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (s.canUndo()) void s.executeUndo();
        return;
      }
      if (mod && e.key === "k") {
        e.preventDefault();
        s.setGlobalSearchOpen(true);
        return;
      }
      if (mod && e.key === "a") {
        e.preventDefault();
        const ids = s.visibleIdsRef.current ?? [];
        useSelectionStore.getState().setSelection(
          ids,
          ids[ids.length - 1] ?? null
        );
        return;
      }
      if (mod && e.key === "x") {
        if (s.previewFile || s.isBlockingModalOpen()) return;
        if (useSelectionStore.getState().selectedIds.length === 0) return;
        e.preventDefault();
        s.handleCut();
        return;
      }
      if (mod && e.key === "c") {
        if (s.previewFile || s.isBlockingModalOpen()) return;
        if (useSelectionStore.getState().selectedIds.length === 0) return;
        e.preventDefault();
        s.handleCopy();
        return;
      }
      if (mod && e.key === "v") {
        if (s.previewFile || s.isBlockingModalOpen()) return;
        if (useClipboardStore.getState().items.length === 0) return;
        e.preventDefault();
        s.handlePaste();
        return;
      }
      if (e.key === "Escape") {
        if (useClipboardStore.getState().items.length > 0) {
          s.handleCancelClipboard();
          return;
        }
        if (s.previewFile) { s.setPreviewFile(null); return; }
        if (s.globalSearchOpen) { s.setGlobalSearchOpen(false); return; }
        if (s.paletteOpen) { s.setPaletteOpen(false); return; }
        if (s.shortcutsOpen) { s.setShortcutsOpen(false); return; }
        if (useSelectionStore.getState().selectedIds.length > 0) {
          s.clearSelection();
          return;
        }
      }
      if (e.key === " " || e.code === "Space") {
        if (s.previewFile || s.isBlockingModalOpen()) return;
        const selected = useSelectionStore.getState().selectedIds;
        if (selected.length === 1) {
          const file = resolveQuickLookFile(selected[0], s.visibleFilesRef.current ?? undefined);
          if (file) {
            e.preventDefault();
            e.stopPropagation();
            s.openQuickLook(file);
          }
        }
        return;
      }
      if (e.key === "?" && !isInputFocused()) {
        e.preventDefault();
        s.setShortcutsOpen(true);
        return;
      }
      if (
        (e.key === "p" || e.key === "P")
        && !mod && !e.altKey
      ) {
        if (s.previewFile || s.isBlockingModalOpen()) return;
        if (useSelectionStore.getState().selectedIds.length === 0) return;
        e.preventDefault();
        s.handleTogglePin();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
}
