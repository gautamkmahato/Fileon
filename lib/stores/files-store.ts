import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { DriveFile } from "@/lib/drive/drive";
import { setFilesCache } from "./files-cache";

export interface FilesState {
  files: DriveFile[];
  nextPageToken: string | undefined;
  loading: boolean;
  revalidating: boolean;
  error: string | null;
  loadingMore: boolean;
  uploading: boolean;
  uploadLabel: string;
  activeCacheKey: string | null;

  beginLoad: (cacheKey: string) => void;
  hydrateFromCache: (
    files: DriveFile[],
    nextPageToken: string | undefined,
    cacheKey: string,
    revalidating?: boolean
  ) => void;
  setLoadError: (error: string | null) => void;
  setFiles: (files: DriveFile[], nextPageToken?: string) => void;
  appendFiles: (files: DriveFile[], nextPageToken?: string) => void;
  prependFile: (file: DriveFile) => void;
  updateFile: (updated: DriveFile) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  setLoading: (loading: boolean) => void;
  setRevalidating: (revalidating: boolean) => void;
  setLoadingMore: (loadingMore: boolean) => void;
  setUploading: (uploading: boolean, label?: string) => void;
}

function syncActiveCache(get: () => FilesState): void {
  const { files, nextPageToken, activeCacheKey } = get();
  if (activeCacheKey) {
    setFilesCache(activeCacheKey, { files, nextPageToken });
  }
}

export const useFilesStore = create<FilesState>()(
  devtools(
    (set, get) => ({
      files: [],
      nextPageToken: undefined,
      loading: false,
      revalidating: false,
      error: null,
      loadingMore: false,
      uploading: false,
      uploadLabel: "",
      activeCacheKey: null,

      beginLoad: (cacheKey) => set({
        loading: true,
        revalidating: false,
        error: null,
        files: [],
        nextPageToken: undefined,
        activeCacheKey: cacheKey,
      }),

      hydrateFromCache: (files, nextPageToken, cacheKey, revalidating = false) => set({
        files,
        nextPageToken,
        loading: false,
        revalidating,
        error: null,
        activeCacheKey: cacheKey,
      }),

      setLoadError: (error) => set({ error, loading: false, revalidating: false }),

      setFiles: (files, nextPageToken) => {
        set({
          files,
          nextPageToken,
          loading: false,
          revalidating: false,
          error: null,
        });
        syncActiveCache(get);
      },

      appendFiles: (files, nextPageToken) => {
        set((state) => ({
          files: [...state.files, ...files],
          nextPageToken,
          loadingMore: false,
        }));
        syncActiveCache(get);
      },

      prependFile: (file) => {
        set((state) => ({
          files: state.files.some((f) => f.id === file.id) ? state.files : [file, ...state.files],
        }));
        syncActiveCache(get);
      },

      updateFile: (updated) => {
        set((state) => ({
          files: state.files.map((f) => (f.id === updated.id ? updated : f)),
        }));
        syncActiveCache(get);
      },

      removeFile: (id) => {
        set((state) => ({
          files: state.files.filter((f) => f.id !== id),
        }));
        syncActiveCache(get);
      },

      clearFiles: () => {
        set({ files: [], nextPageToken: undefined });
        syncActiveCache(get);
      },

      setLoading: (loading) => set({ loading }),

      setRevalidating: (revalidating) => set({ revalidating }),

      setLoadingMore: (loadingMore) => set({ loadingMore }),

      setUploading: (uploading, label = "") => set({ uploading, uploadLabel: label }),
    }),
    { name: "FilesStore", enabled: process.env.NODE_ENV === "development" }
  )
);

/** Fine-grained file lookup for preview sync (optional). */
export function useFileById(fileId: string | null | undefined): DriveFile | null {
  return useFilesStore((s) => {
    if (!fileId) return null;
    return s.files.find((f) => f.id === fileId) ?? null;
  });
}
