import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { DriveFile } from "@/lib/drive/drive";

export type ClipboardMode = "cut" | "copy";

export interface ClipboardItem {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
}

export interface ClipboardState {
  mode: ClipboardMode | null;
  items: ClipboardItem[];
  sourceFolderId: string | null;
  setAt: number | null;

  setCut: (items: DriveFile[], sourceFolderId: string) => void;
  setCopy: (items: DriveFile[], sourceFolderId: string) => void;
  clear: () => void;
}

const CLIPBOARD_TTL_MS = 5 * 60 * 1000;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;

function toClipboardItem(file: DriveFile): ClipboardItem {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    parents: file.parents,
  };
}

function scheduleExpiry(clear: () => void) {
  if (expiryTimer) clearTimeout(expiryTimer);
  expiryTimer = setTimeout(() => {
    clear();
    expiryTimer = null;
  }, CLIPBOARD_TTL_MS);
}

function clearExpiryTimer() {
  if (expiryTimer) {
    clearTimeout(expiryTimer);
    expiryTimer = null;
  }
}

const initialState = {
  mode: null as ClipboardMode | null,
  items: [] as ClipboardItem[],
  sourceFolderId: null as string | null,
  setAt: null as number | null,
};

export const useClipboardStore = create<ClipboardState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setCut: (files, sourceFolderId) => {
        clearExpiryTimer();
        set({
          mode: "cut",
          items: files.map(toClipboardItem),
          sourceFolderId,
          setAt: Date.now(),
        });
        scheduleExpiry(() => get().clear());
      },

      setCopy: (files, sourceFolderId) => {
        clearExpiryTimer();
        set({
          mode: "copy",
          items: files.map(toClipboardItem),
          sourceFolderId,
          setAt: Date.now(),
        });
        scheduleExpiry(() => get().clear());
      },

      clear: () => {
        clearExpiryTimer();
        set(initialState);
      },
    }),
    { name: "ClipboardStore", enabled: process.env.NODE_ENV === "development" }
  )
);

export function useIsCut(fileId: string): boolean {
  return useClipboardStore(
    (s) => s.mode === "cut" && s.items.some((i) => i.id === fileId)
  );
}

export function useClipboardActive(): boolean {
  return useClipboardStore((s) => s.items.length > 0);
}

export function clipboardLabel(mode: ClipboardMode | null, count: number): string {
  if (!mode || count === 0) return "";
  const n = `${count} file${count !== 1 ? "s" : ""}`;
  return mode === "cut"
    ? `${n} cut — ⌘V to paste`
    : `${n} copied — ⌘V to paste`;
}
