"use client";

import { Loader2, Upload } from "lucide-react";

interface DropOverlayProps {
  visible: boolean;
  folderName: string;
  uploading?: boolean;
  uploadLabel?: string;
}

export function DropOverlay({ visible, folderName, uploading, uploadLabel }: DropOverlayProps) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-blue-600/20 dark:bg-blue-500/20 backdrop-blur-sm flex items-center justify-center pointer-events-none">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl px-10 py-8 border-2 border-dashed border-blue-400 flex flex-col items-center gap-3 min-w-[280px]">
        {uploading ? (
          <>
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Uploading…
            </p>
            {uploadLabel && (
              <p className="text-sm text-zinc-500 text-center max-w-xs truncate">{uploadLabel}</p>
            )}
          </>
        ) : (
          <>
            <Upload className="w-10 h-10 text-blue-500" />
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Drop files to upload
            </p>
            <p className="text-sm text-zinc-500">to {folderName}</p>
          </>
        )}
      </div>
    </div>
  );
}
