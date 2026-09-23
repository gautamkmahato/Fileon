"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { DriveFile } from "@/lib/drive/drive";
import { DriveApiError, getFile } from "@/lib/drive/drive";
import type { CoverPosition } from "@/lib/folder-covers";
import { useAuth } from "../../auth/AuthProvider";
import { useFilesStore } from "@/lib/stores";
import { Thumbnail } from "../preview/Thumbnail";

const POSITION_CLASS: Record<CoverPosition, string> = {
  center: "object-center",
  top: "object-top",
};

interface FolderCoverImageProps {
  coverFileId: string;
  position?: CoverPosition;
  alt: string;
  className?: string;
  onInvalid?: () => void;
}

export const FolderCoverImage = memo(function FolderCoverImage({
  coverFileId,
  position = "center",
  alt,
  className,
  onInvalid,
}: FolderCoverImageProps) {
  const { token } = useAuth();
  const files = useFilesStore((s) => s.files);
  const cached = files.find((f) => f.id === coverFileId);
  const [file, setFile] = useState<DriveFile | null>(cached ?? null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const onInvalidRef = useRef(onInvalid);
  useEffect(() => { onInvalidRef.current = onInvalid; }, [onInvalid]);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    if (cached) {
      setFile(cached);
      return;
    }
    if (!token) return;
    let cancelled = false;
    getFile(token, coverFileId)
      .then((f) => { if (!cancelled) setFile(f); })
      .catch((err) => {
        if (cancelled) return;
        setFailed(true);
        if (err instanceof DriveApiError && (err.status === 404 || err.status === 403)) {
          onInvalidRef.current?.();
        }
      });
    return () => { cancelled = true; };
  }, [coverFileId, token, cached]);

  const handleLoaded = useCallback(() => setLoaded(true), []);
  const handleFailed = useCallback(() => {
    setFailed(true);
    onInvalidRef.current?.();
  }, []);

  if (failed || !file) return null;

  return (
    <div className={`absolute inset-0 transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}>
      <Thumbnail
        fileId={file.id}
        mimeType={file.mimeType}
        fileName={file.name}
        thumbnailLink={file.thumbnailLink}
        modifiedTime={file.modifiedTime}
        alt={alt}
        className={`w-full h-full object-cover ${POSITION_CLASS[position]} ${className ?? ""}`}
        size={600}
        mode="grid"
        lazy
        onLoaded={handleLoaded}
        onFailed={handleFailed}
      />
    </div>
  );
});
