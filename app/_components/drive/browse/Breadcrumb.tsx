"use client";

import { ChevronRight } from "lucide-react";
import type { FolderCrumb } from "@/lib/drive/types";

export function Breadcrumb({
  crumbs,
  onNavigate,
}: {
  crumbs: FolderCrumb[];
  onNavigate: (index: number) => void;
}) {
  return (
    <nav className="flex items-center gap-1 text-base min-w-0 overflow-x-auto">
      {crumbs.map((c, i) => (
        <span key={c.id ?? `root-${i}`} className="flex items-center gap-1 shrink-0">
          {i > 0 && <ChevronRight className="w-4 h-4 text-zinc-300" />}
          <button
            onClick={() => onNavigate(i)}
            className={`px-2 py-0.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
              i === crumbs.length - 1 ? "font-semibold text-zinc-900 dark:text-zinc-100" : "text-zinc-500"
            }`}
          >
            {c.name}
          </button>
        </span>
      ))}
    </nav>
  );
}
