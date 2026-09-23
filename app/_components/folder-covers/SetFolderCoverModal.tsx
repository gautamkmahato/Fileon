"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Upload } from "lucide-react";
import type { DriveFile } from "@/lib/drive/drive";
import { listFolderImages } from "@/lib/drive/drive";
import { useAuth } from "../auth/AuthProvider";
import { Modal } from "../ui/Modal";
import { Thumbnail } from "../drive/preview/Thumbnail";

type Tab = "pick" | "upload";

interface SetFolderCoverModalProps {
  open: boolean;
  folder: DriveFile | null;
  onClose: () => void;
  onSelectCover: (coverFileId: string) => Promise<void>;
  onUploadCover: (file: File) => Promise<void>;
}

export function SetFolderCoverModal({
  open,
  folder,
  onClose,
  onSelectCover,
  onUploadCover,
}: SetFolderCoverModalProps) {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>("pick");
  const [images, setImages] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadImages = useCallback(async (reset = true) => {
    if (!token || !folder) return;
    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await listFolderImages(token, folder.id, reset ? undefined : nextPageToken);
      setImages((prev) => (reset ? res.files : [...prev, ...res.files]));
      setNextPageToken(res.nextPageToken);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [token, folder, nextPageToken]);

  useEffect(() => {
    if (!open || !folder) return;
    setTab("pick");
    setImages([]);
    setNextPageToken(undefined);
    void loadImages(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, folder?.id]);

  async function handlePick(fileId: string) {
    setBusyId(fileId);
    try {
      await onSelectCover(fileId);
      onClose();
    } finally {
      setBusyId(null);
    }
  }

  async function handleUpload(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      await onUploadCover(file);
      onClose();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Modal
      open={open && folder !== null}
      onClose={onClose}
      title={folder ? `Cover for "${folder.name}"` : "Set cover image"}
      width="max-w-lg"
    >
      <div className="flex gap-1 p-1 mb-4 rounded-lg bg-zinc-100 dark:bg-zinc-800">
        <TabButton active={tab === "pick"} onClick={() => setTab("pick")}>
          Choose from this folder
        </TabButton>
        <TabButton active={tab === "upload"} onClick={() => setTab("upload")}>
          Upload
        </TabButton>
      </div>

      {tab === "pick" && (
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-zinc-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading images…
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-sm">
              <ImagePlus className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No images in this folder yet.</p>
              <button
                type="button"
                onClick={() => setTab("upload")}
                className="mt-3 text-blue-600 hover:underline text-sm font-medium"
              >
                Upload an image instead
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 max-h-[360px] overflow-y-auto pr-1">
                {images.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void handlePick(img.id)}
                    className="relative aspect-square rounded-lg overflow-hidden ring-1 ring-zinc-200 dark:ring-zinc-700 hover:ring-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                    title={img.name}
                  >
                    <Thumbnail
                      fileId={img.id}
                      mimeType={img.mimeType}
                      fileName={img.name}
                      thumbnailLink={img.thumbnailLink}
                      modifiedTime={img.modifiedTime}
                      alt={img.name}
                      className="w-full h-full object-cover"
                      size={300}
                      mode="grid"
                      lazy
                    />
                    {busyId === img.id && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {nextPageToken && (
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void loadImages(false)}
                  className="mt-3 w-full py-2 text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {tab === "upload" && (
        <div className="text-center py-10">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleUpload(e.target.files)}
          />
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <Upload className="w-6 h-6 text-zinc-500" />
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Upload an image into this folder and use it as the cover.
          </p>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-primary text-sm font-medium disabled:opacity-60"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading…
              </>
            ) : (
              "Choose image"
            )}
          </button>
        </div>
      )}
    </Modal>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        active
          ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
          : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}
