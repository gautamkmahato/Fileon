"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { AnchorDropdownMenu } from "./AnchorDropdownMenu";
import {
  SORT_OPTIONS, sortStateKey, type SortState,
} from "@/lib/utils/sort";

export function SortDropdown({ sort, onChange }: { sort: SortState; onChange: (s: SortState) => void }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const currentKey = sortStateKey(sort);

  return (
    <div className="relative shrink-0">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-sm dark:shadow-none"
      >
        Sort
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnchorDropdownMenu open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} minWidth={220}>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => { onChange(opt.state); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left"
          >
            <span className="w-4 h-4 flex items-center justify-center">
              {currentKey === opt.value && <Check className="w-3.5 h-3.5 text-blue-600" />}
            </span>
            {opt.label}
          </button>
        ))}
      </AnchorDropdownMenu>
    </div>
  );
}
