"use client";

import type { Tag } from "@/lib/tags";
import { getTagColor } from "@/lib/tag-colors";
import { displayTagName } from "@/lib/tag-kinds";

interface TagPillsProps {
  tags: Tag[];
  max?: number;
  className?: string;
}

export function TagPills({ tags, max = 4, className = "" }: TagPillsProps) {
  if (!tags.length) return null;
  const shown = tags.slice(0, max);
  const extra = tags.length - shown.length;

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {shown.map((tag) => {
        const color = getTagColor(tag.colorId);
        const label = displayTagName(tag);
        return (
          <span
            key={tag.id}
            title={label}
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium truncate max-w-[120px] ${color.pill}`}
          >
            {tag.emoji ? <span className="shrink-0">{tag.emoji}</span> : null}
            <span className="truncate">{label}</span>
          </span>
        );
      })}
      {extra > 0 && (
        <span className="text-[10px] text-zinc-400 font-medium">+{extra}</span>
      )}
    </div>
  );
}

interface TagDotsProps {
  tags: Tag[];
  max?: number;
  className?: string;
}

export function TagDots({ tags, max = 5, className = "" }: TagDotsProps) {
  if (!tags.length) return null;
  const shown = tags.slice(0, max);

  return (
    <div className={`flex items-center gap-1 ${className}`} title={tags.map(displayTagName).join(", ")}>
      {shown.map((tag) => {
        if (tag.emoji) {
          return (
            <span key={tag.id} className="text-[10px] leading-none shrink-0">
              {tag.emoji}
            </span>
          );
        }
        const color = getTagColor(tag.colorId);
        return (
          <span
            key={tag.id}
            className={`w-2 h-2 rounded-full shrink-0 ${color.dot}`}
          />
        );
      })}
      {tags.length > max && (
        <span className="text-[9px] text-zinc-400">+{tags.length - max}</span>
      )}
    </div>
  );
}
