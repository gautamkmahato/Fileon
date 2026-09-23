import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import type { ViewMode } from "@/lib/drive/types";
import {
  DEFAULT_FILTERS, type Filters,
} from "@/lib/utils/filter";
import {
  DEFAULT_FILE_SORT, loadFileSort, saveFileSort, type SortState,
} from "@/lib/utils/sort";
import type { SavedView } from "@/lib/views";

export interface BrowseState {
  search: string;
  filters: Filters;
  fileSort: SortState;
  view: ViewMode;
  folderDropTarget: string | null;
  showHidden: boolean;

  setSearch: (search: string) => void;
  setFilters: (update: Filters | ((prev: Filters) => Filters)) => void;
  setFileSort: (sort: SortState) => void;
  setView: (view: ViewMode) => void;
  setFolderDropTarget: (id: string | null) => void;
  setShowHidden: (show: boolean) => void;
  /** Reset search + filters when browse scope changes (not layout/sort preferences). */
  resetBrowse: () => void;
  hydrateFromSavedView: (saved: Pick<SavedView, "filters" | "search" | "sort"> & { layout: ViewMode }) => void;
  initFromStorage: () => void;
}

export const useBrowseStore = create<BrowseState>()(
  devtools(
    persist(
      (set, get) => ({
        search: "",
        filters: DEFAULT_FILTERS,
      fileSort: DEFAULT_FILE_SORT,
      view: "grid",
      folderDropTarget: null,
      showHidden: false,

      setSearch: (search) => set({ search }),

        setFilters: (update) => {
          const prev = get().filters;
          const next = typeof update === "function" ? update(prev) : update;
          set({ filters: next });
        },

        setFileSort: (sort) => {
          set({ fileSort: sort });
          saveFileSort(sort);
        },

      setView: (view) => set({ view }),

      setFolderDropTarget: (folderDropTarget) => set({ folderDropTarget }),

      setShowHidden: (showHidden) => set({ showHidden }),

      resetBrowse: () => set({ search: "", filters: DEFAULT_FILTERS }),

        hydrateFromSavedView: (saved) => set({
          filters: saved.filters,
          search: saved.search,
          fileSort: saved.sort,
          view: saved.layout === "gallery" ? "gallery" : saved.layout === "list" ? "list" : "grid",
        }),

        initFromStorage: () => {
          const { fileSort } = get();
          if (
            fileSort.field === DEFAULT_FILE_SORT.field &&
            fileSort.dir === DEFAULT_FILE_SORT.dir
          ) {
            const legacy = loadFileSort();
            if (
              legacy.field !== DEFAULT_FILE_SORT.field ||
              legacy.dir !== DEFAULT_FILE_SORT.dir
            ) {
              set({ fileSort: legacy });
            }
          }
        },
      }),
      {
        name: "gdrive-browse-v2",
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          fileSort: state.fileSort,
          view: state.view,
          showHidden: state.showHidden,
        }),
        merge: (persisted, current) => {
          const p = persisted as Partial<BrowseState>;
          return {
            ...current,
            fileSort: p.fileSort ?? current.fileSort,
            view: p.view === "list" || p.view === "gallery" ? p.view : "grid",
            showHidden: p.showHidden ?? current.showHidden,
          };
        },
      }
    ),
    { name: "BrowseStore", enabled: process.env.NODE_ENV === "development" }
  )
);
