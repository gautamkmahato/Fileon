"use client";

import { EyeOff } from "lucide-react";

export function HiddenBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-800/80 text-[10px] font-medium text-white/90 backdrop-blur-sm ${className}`}
    >
      <EyeOff className="w-3 h-3" strokeWidth={2} />
      Hidden
    </span>
  );
}
