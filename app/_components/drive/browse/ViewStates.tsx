"use client";

import { HardDrive, Loader2 } from "lucide-react";

export function LoadingState() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700">
          <div className="aspect-[4/3] bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          <div className="px-3 py-3 h-16 bg-zinc-50 dark:bg-zinc-900 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="text-center py-20">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">Something went wrong</p>
      <p className="text-xs text-zinc-500 mb-4 max-w-md mx-auto break-words">{error}</p>
      <button
        onClick={onRetry}
        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90"
      >
        Retry
      </button>
    </div>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center py-20 max-w-md mx-auto">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 mb-4">
        <HardDrive className="w-5 h-5" />
      </div>
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</p>
    </div>
  );
}

export function NoMatchState({ onClear }: { onClear: () => void }) {
  return (
    <div className="text-center py-20">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No matches</p>
      <p className="text-xs text-zinc-500 mt-1 mb-4">Try a different search or clear filters.</p>
      <button
        onClick={onClear}
        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
      >
        Clear filters
      </button>
    </div>
  );
}

export function InlineLoadingSpinner() {
  return (
    <div className="mt-6 flex justify-center text-zinc-500">
      <Loader2 className="w-4 h-4 animate-spin" />
    </div>
  );
}
