"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import {
  DEFAULT_FILTERS, filtersAreActive, MODIFIED_OPTIONS, ModifiedFilter,
  SOURCE_OPTIONS, SourceFilter, TYPE_OPTIONS, TypeFilter, type Filters,
} from "@/lib/utils/filter";
import { type SortState } from "@/lib/utils/sort";
import { FilterDropdown } from "./FilterDropdown";
import { SortDropdown } from "./SortDropdown";

const SEARCH_DEBOUNCE_MS = 200;

interface BrowseFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: Filters;
  onFiltersChange: (updater: (prev: Filters) => Filters) => void;
  fileSort: SortState;
  onSortChange: (sort: SortState) => void;
  isTrashView: boolean;
}

export function BrowseFilterBar({
  search, onSearchChange, filters, onFiltersChange, fileSort, onSortChange, isTrashView,
}: BrowseFilterBarProps) {
  const [draft, setDraft] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(search);
  }, [search]);

  const commitSearch = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(value);
    }, SEARCH_DEBOUNCE_MS);
  }, [onSearchChange]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const isFiltering = filtersAreActive(filters, search);

  return (
    <div className="flex items-center gap-3 mb-8">
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            value={draft}
            onChange={(e) => {
              const v = e.target.value;
              setDraft(v);
              commitSearch(v);
            }}
            placeholder="Search in this view…"
            className="w-full h-10 pl-10 pr-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 outline-none shadow-sm dark:shadow-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-800 placeholder:text-zinc-400"
          />
        </div>
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <FilterDropdown
          label="Type"
          value={filters.type}
          options={TYPE_OPTIONS}
          onChange={(v) => onFiltersChange((f) => ({ ...f, type: v as TypeFilter }))}
          isDefault={filters.type === "all"}
        />
        <FilterDropdown
          label="Modified"
          value={filters.modified}
          options={MODIFIED_OPTIONS}
          onChange={(v) => onFiltersChange((f) => ({ ...f, modified: v as ModifiedFilter }))}
          isDefault={filters.modified === "any"}
        />
        <FilterDropdown
          label="Source"
          value={filters.source}
          options={SOURCE_OPTIONS}
          onChange={(v) => onFiltersChange((f) => ({ ...f, source: v as SourceFilter }))}
          isDefault={filters.source === "all"}
        />
        {!isTrashView && (
          <SortDropdown
            sort={fileSort}
            onChange={(s) => onSortChange(s)}
          />
        )}
        {isFiltering && (
          <button
            onClick={() => { onFiltersChange(() => DEFAULT_FILTERS); setDraft(""); onSearchChange(""); }}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 px-2"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
