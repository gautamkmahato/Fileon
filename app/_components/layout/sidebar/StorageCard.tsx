"use client";

import { Sparkles } from "lucide-react";
import { humanFileSize } from "@/lib/drive/drive";
import type { StorageQuota } from "@/lib/drive/drive";
import { parseQuotaBytes } from "@/lib/sidebar-nav";

export function StorageCard({ quota }: { quota: StorageQuota | null }) {
  const used = parseQuotaBytes(quota?.usage);
  const limit = parseQuotaBytes(quota?.limit);
  if (!quota || limit <= 0) return null;
  const pct = Math.min(100, (used / limit) * 100);

  return (
    <div className="px-3 pb-4">
      <div className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Storage</span>
        </div>
        <div className="text-[12px] font-medium text-zinc-900 dark:text-zinc-100 mb-2">
          {humanFileSize(used)} <span className="text-zinc-400 font-normal">of {humanFileSize(limit)}</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-zinc-700 to-zinc-900 dark:from-zinc-400 dark:to-zinc-200 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <a
          href="https://one.google.com/storage"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 font-medium"
        >
          Get more space →
        </a>
      </div>
    </div>
  );
}
