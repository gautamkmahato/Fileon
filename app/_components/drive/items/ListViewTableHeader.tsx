"use client";

import { useEffect, useRef } from "react";
import { useSelectionStore } from "@/lib/stores";
import { LIST_VIEW_HEADER_CLASS } from "@/lib/drive/list-view-layout";

export function ListViewTableHeader({ itemIds }: { itemIds: string[] }) {
  const selectedSet = useSelectionStore((s) => s.selectedSet);
  const checkboxRef = useRef<HTMLInputElement>(null);

  const allSelected = itemIds.length > 0 && itemIds.every((id) => selectedSet.has(id));
  const someSelected = itemIds.some((id) => selectedSet.has(id));

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  function toggleAll(e: React.ChangeEvent<HTMLInputElement>) {
    e.stopPropagation();
    if (allSelected) {
      useSelectionStore.getState().setSelection([], null);
    } else {
      useSelectionStore.getState().setSelection(itemIds, itemIds[itemIds.length - 1] ?? null);
    }
  }

  return (
    <div className={LIST_VIEW_HEADER_CLASS}>
      <span className="flex items-center gap-3 min-w-0">
        <input
          ref={checkboxRef}
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          onClick={(e) => e.stopPropagation()}
          aria-label="Select all"
          className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-2 focus:ring-blue-200 shrink-0"
        />
        Name
      </span>
      <span>Owner</span>
      <span>Modified</span>
      <span>Size</span>
      <span />
    </div>
  );
}
