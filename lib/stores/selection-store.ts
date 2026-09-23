import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { useFilesStore } from "./files-store";
import { useCleanupStore } from "@/lib/cleanup/store";

export interface SelectionState {
  selectedIds: string[];
  /** In-memory set mirror for O(1) membership checks — not persisted. */
  selectedSet: Set<string>;
  lastSelectedId: string | null;
  scopeKey: string;
  selectionBusy: boolean;
  selectionBusyLabel: string;

  clearSelection: () => void;
  setSelection: (ids: string[], lastId: string | null) => void;
  applySelectionResult: (result: { selectedIds: Set<string>; lastSelectedId: string | null }) => void;
  removeFromSelection: (id: string) => void;
  /** On route change: clear selection when scope changes; update scopeKey. */
  syncScope: (newScopeKey: string, options?: { clearSelection?: boolean }) => void;
  /** Drop ids not present in the current file list (after load / filter). */
  pruneToValidIds: (validIds: Iterable<string>) => void;
  setSelectionBusy: (busy: boolean, label?: string) => void;
}

function idsToSet(ids: string[]): Set<string> {
  return new Set(ids);
}

const initialState = {
  selectedIds: [] as string[],
  selectedSet: new Set<string>(),
  lastSelectedId: null as string | null,
  scopeKey: "",
  selectionBusy: false,
  selectionBusyLabel: "",
};

export const useSelectionStore = create<SelectionState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        clearSelection: () => set({
          selectedIds: [],
          selectedSet: new Set(),
          lastSelectedId: null,
        }),

        setSelection: (ids, lastId) => set({
          selectedIds: ids,
          selectedSet: idsToSet(ids),
          lastSelectedId: lastId,
        }),

        applySelectionResult: (result) => set({
          selectedIds: [...result.selectedIds],
          selectedSet: new Set(result.selectedIds),
          lastSelectedId: result.lastSelectedId,
        }),

        removeFromSelection: (id) => {
          const { selectedIds, lastSelectedId, selectedSet } = get();
          if (!selectedSet.has(id)) return;
          const nextSet = new Set(selectedSet);
          nextSet.delete(id);
          const next = selectedIds.filter((x) => x !== id);
          set({
            selectedIds: next,
            selectedSet: nextSet,
            lastSelectedId: lastSelectedId === id ? (next[next.length - 1] ?? null) : lastSelectedId,
          });
        },

        syncScope: (newScopeKey, options) => {
          const { scopeKey } = get();
          const shouldClear = options?.clearSelection ?? true;
          if (scopeKey === newScopeKey) return;
          if (shouldClear) {
            set({
              scopeKey: newScopeKey,
              selectedIds: [],
              selectedSet: new Set(),
              lastSelectedId: null,
            });
          } else {
            set({ scopeKey: newScopeKey });
          }
        },

        pruneToValidIds: (validIds) => {
          const valid = new Set(validIds);
          const { selectedIds, lastSelectedId, selectedSet } = get();
          const next = selectedIds.filter((id) => valid.has(id));
          if (next.length === selectedIds.length) return;
          const nextSet = new Set<string>();
          for (const id of next) nextSet.add(id);
          set({
            selectedIds: next,
            selectedSet: nextSet,
            lastSelectedId: lastSelectedId && valid.has(lastSelectedId)
              ? lastSelectedId
              : (next[next.length - 1] ?? null),
          });
        },

        setSelectionBusy: (busy, label = "") => set({
          selectionBusy: busy,
          selectionBusyLabel: label,
        }),
      }),
      {
        name: "gdrive-selection",
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          selectedIds: state.selectedIds,
          lastSelectedId: state.lastSelectedId,
          scopeKey: state.scopeKey,
        }),
        merge: (persisted, current) => {
          const merged = {
            ...current,
            ...(persisted as Partial<SelectionState>),
          };
          merged.selectedSet = idsToSet(merged.selectedIds ?? []);
          return merged;
        },
      }
    ),
    { name: "SelectionStore", enabled: process.env.NODE_ENV === "development" }
  )
);

/** Fine-grained: re-render only when this file's selected state toggles. */
export function useIsSelected(fileId: string): boolean {
  return useSelectionStore((s) => s.selectedSet.has(fileId));
}

export function useSelectionCount(): number {
  return useSelectionStore((s) => s.selectedIds.length);
}

export function useBulkSelectionActive(): boolean {
  return useSelectionStore((s) => s.selectedIds.length >= 2);
}

export function useSelectionActive(): boolean {
  return useSelectionStore((s) => s.selectedIds.length > 0);
}

/** Snapshot for drag-drop and bulk ops (not for per-card subscriptions). */
export function getSelectedIdSet(): Set<string> {
  return useSelectionStore.getState().selectedSet;
}

/** Resolve selected files from files + selection stores (no context subscription). */
export function getSelectedDriveFiles(): import("@/lib/drive/drive").DriveFile[] {
  const selectedIds = useSelectionStore.getState().selectedIds;
  if (!selectedIds.length) return [];
  const { files } = useFilesStore.getState();
  const byId = new Map(files.map((f) => [f.id, f]));
  const extra = useCleanupStore.getState().filesById;
  const out: import("@/lib/drive/drive").DriveFile[] = [];
  for (const id of selectedIds) {
    const file = byId.get(id) ?? extra.get(id);
    if (file) out.push(file);
  }
  return out;
}

/** Sync selection from other tabs when localStorage updates. */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== "gdrive-selection" || !e.newValue) return;
    try {
      const parsed = JSON.parse(e.newValue) as { state?: Partial<SelectionState> };
      const incoming = parsed.state;
      if (!incoming) return;
      const current = useSelectionStore.getState();
      if (incoming.scopeKey !== current.scopeKey) return;
      const ids = incoming.selectedIds ?? [];
      useSelectionStore.setState({
        selectedIds: ids,
        selectedSet: idsToSet(ids),
        lastSelectedId: incoming.lastSelectedId ?? null,
      });
    } catch {
      /* ignore malformed persist payload */
    }
  });
}
