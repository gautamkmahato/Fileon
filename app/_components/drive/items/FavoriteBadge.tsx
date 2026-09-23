"use client";

import { Bookmark } from "lucide-react";

export function FavoriteBadge({ className = "" }: { className?: string }) {
  return (
    <div
      className={`absolute top-2.5 left-2.5 w-7 h-7 rounded-full flex items-center justify-center bg-white/90 dark:bg-zinc-900/90 text-amber-500 shadow-sm backdrop-blur-md z-10 pointer-events-none ${className}`}
      aria-label="Favorite"
    >
      <Bookmark className="w-3.5 h-3.5" fill="currentColor" strokeWidth={2} />
    </div>
  );
}
