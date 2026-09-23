"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DRAG_MIME = "application/x-drive-file-ids";

export function useDragDrop(opts: {
  onUploadFiles: (files: FileList) => void;
  onMoveFiles: (fileIds: string[], targetFolderId: string) => void;
  getDragFileIds: () => string[];
}) {
  const [isWindowDragOver, setIsWindowDragOver] = useState(false);
  const dragCounter = useRef(0);

  const onWindowDragEnter = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("Files")) {
      dragCounter.current++;
      setIsWindowDragOver(true);
    }
  }, []);

  const onWindowDragLeave = useCallback(() => {
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsWindowDragOver(false);
    }
  }, []);

  const onWindowDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("Files")) e.preventDefault();
  }, []);

  const onWindowDrop = useCallback((e: React.DragEvent) => {
    dragCounter.current = 0;
    setIsWindowDragOver(false);
    if (e.dataTransfer.files?.length) {
      e.preventDefault();
      opts.onUploadFiles(e.dataTransfer.files);
    }
  }, [opts]);

  const onItemDragStart = useCallback((e: React.DragEvent, fileId: string) => {
    const ids = opts.getDragFileIds().includes(fileId)
      ? opts.getDragFileIds()
      : [fileId];
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(ids));
    e.dataTransfer.effectAllowed = "move";
  }, [opts]);

  const onFolderDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  }, []);

  const onFolderDrop = useCallback((e: React.DragEvent, folderId: string) => {
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      const ids = JSON.parse(raw) as string[];
      opts.onMoveFiles(ids, folderId);
    } catch {
      /* ignore */
    }
  }, [opts]);

  return {
    isWindowDragOver,
    onWindowDragEnter,
    onWindowDragLeave,
    onWindowDragOver,
    onWindowDrop,
    onItemDragStart,
    onFolderDragOver,
    onFolderDrop,
  };
}

export function useFolderDropHighlight() {
  const [isOver, setIsOver] = useState(false);
  const onDragEnter = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/x-drive-file-ids")) setIsOver(true);
  }, []);
  const onDragLeave = useCallback(() => setIsOver(false), []);
  return { isOver, onDragEnter, onDragLeave, setIsOver };
}
