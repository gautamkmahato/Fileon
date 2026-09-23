"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { driveRoutes } from "@/lib/navigation";
import {
  TYPE_BROWSE_CATEGORIES,
  TYPE_BROWSE_META,
  type TypeBrowseCategory,
} from "@/lib/drive/type-browse";
import { useAuth } from "../../auth/AuthProvider";
import { useTypeBrowseCounts, type TypeBrowseCount } from "@/lib/hooks/useTypeBrowseCounts";

const ICON_SOLID: Record<TypeBrowseCategory, string> = {
  images: "bg-violet-500",
  videos: "bg-pink-500",
  music: "bg-indigo-500",
  documents: "bg-sky-500",
  archives: "bg-orange-500",
};

const COUNT_UNITS: Record<TypeBrowseCategory, [string, string]> = {
  images: ["image", "images"],
  videos: ["video", "videos"],
  music: ["song", "songs"],
  documents: ["document", "documents"],
  archives: ["archive", "archives"],
};

function formatTypeCount(category: TypeBrowseCategory, info?: TypeBrowseCount): string {
  if (!info) return "…";
  const [singular, plural] = COUNT_UNITS[category];
  const n = info.hasMore ? `${info.count}+` : info.count;
  const word = info.count === 1 && !info.hasMore ? singular : plural;
  return `${n} ${word}`;
}

export function TypeBrowseStrip() {
  const pathname = usePathname();
  const { token } = useAuth();
  const typeCounts = useTypeBrowseCounts(token);
  const activeCategory = pathname.startsWith("/type/")
    ? pathname.slice("/type/".length) as TypeBrowseCategory
    : null;

  return (
    <section className="mb-10">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Browse by type</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {TYPE_BROWSE_CATEGORIES.map((category) => {
          const meta = TYPE_BROWSE_META[category];
          const Icon = meta.icon;
          const href = driveRoutes.typeBrowse(category);
          const isActive = activeCategory === category;
          const countInfo = typeCounts[category];
          return (
            <Link
              key={category}
              href={href}
              className={`group flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all ${
                isActive
                  ? "border-blue-500 ring-2 ring-blue-400 bg-blue-50/50 dark:bg-blue-950/30"
                  : `${meta.bgSoft} border-zinc-200/60 dark:border-zinc-700/80 hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-md dark:hover:shadow-none`
              }`}
            >
              <div className={`w-10 h-10 rounded-xl ${ICON_SOLID[category]} flex items-center justify-center shrink-0`}>
                <Icon className="w-5 h-5 text-white" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {meta.label}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                  {formatTypeCount(category, countInfo)}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
