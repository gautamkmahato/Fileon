"use client";

import { useCallback, useEffect } from "react";
import type { DriveFile } from "@/lib/drive/drive";
import { PreviewBody } from "./PreviewBody";

interface QuickLookProps {
  file: DriveFile;
  files: DriveFile[];
  userEmail?: string;
  onClose: () => void;
  onChangeFile: (file: DriveFile) => void;
}

export function QuickLook({ file, files, userEmail, onClose, onChangeFile }: QuickLookProps) {
  const currentIndex = files.findIndex((f) => f.id === file.id);

  const navigate = useCallback(
    (delta: -1 | 1) => {
      const idx = files.findIndex((f) => f.id === file.id);
      const next = files[idx + delta];
      if (next) onChangeFile(next);
    },
    [file.id, files, onChangeFile]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === " " || e.code === "Space") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigate(-1);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        navigate(1);
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, navigate]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col animate-in fade-in duration-150">
      <button
        type="button"
        aria-label="Close preview"
        className="absolute inset-0 bg-black/88 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative flex-1 flex items-center justify-center min-h-0 p-4 pointer-events-none">
        <div
          key={file.id}
          className="pointer-events-auto w-full flex items-center justify-center animate-in fade-in zoom-in-95 duration-150"
        >
          <PreviewBody file={file} userEmail={userEmail} variant="quicklook" />
        </div>
      </div>

      <footer className="relative z-10 shrink-0 py-4 px-6 text-center pointer-events-none">
        <p className="text-sm font-medium text-zinc-100 truncate max-w-lg mx-auto">{file.name}</p>
        <p className="text-xs text-zinc-500 mt-1">
          {files.length > 1 && (
            <span className="text-zinc-600 mr-2">
              {currentIndex + 1} of {files.length} ·
            </span>
          )}
          ← → to navigate · Space to close
        </p>
      </footer>
    </div>
  );
}
