"use client";

import { useState } from "react";
import Link from "next/link";
import { LayoutGrid, Pencil, Plus, Trash2 } from "lucide-react";
import { driveRoutes } from "@/lib/navigation";
import { humanFileSize } from "@/lib/drive/drive";
import { displayLabel } from "@/lib/sidebar-nav";
import { describeRule } from "@/lib/spaces";
import { useTags } from "../tags/TagsProvider";
import { ConfirmModal } from "../ui/Dialogs";
import { toast } from "@/lib/toast";
import { useSpaces } from "./SpacesProvider";

export function SmartSpacesHome() {
  const { spaces, loading, openCreate, openEdit, deleteSpace } = useSpaces();
  const { tags } = useTags();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const target = spaces.find((s) => s.id === deleteTarget) ?? null;

  async function handleDelete() {
    if (!target) return;
    setDeleteTarget(null);
    try {
      const ok = await deleteSpace(target.id);
      if (ok) toast.success(`Deleted "${target.name}"`);
    } catch {
      toast.error("Couldn't delete that Smart Space");
    }
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Smart Spaces</h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-xl">
            Virtual folders that collect matching files from Drive. Files are not moved or copied.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-lg btn-primary shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          New space
        </button>
      </div>

      {loading && spaces.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && spaces.length === 0 && (
        <div className="text-center py-20 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 mb-4">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No Smart Spaces yet</p>
          <p className="text-xs text-zinc-500 mt-1 mb-4">
            Example: PDFs tagged Invoice, without moving them in Drive.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-lg btn-primary"
          >
            <Plus className="w-4 h-4" />
            Create one
          </button>
        </div>
      )}

      {spaces.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {spaces.map((space) => (
            <article
              key={space.id}
              className={`group relative rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm dark:shadow-none ${accentBorder(space.color)}`}
            >
              <Link href={driveRoutes.space(space.id)} className="block min-w-0">
                <div className="flex items-start gap-3">
                  <span className="text-2xl leading-none shrink-0">{space.emoji || "📁"}</span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {displayLabel(space.name, "Untitled space")}
                    </h2>
                    <p className="text-xs text-zinc-500 mt-1">
                      {space.cachedFileCount != null
                        ? `${space.cachedFileCount} file${space.cachedFileCount === 1 ? "" : "s"}`
                        : "Open to count"}
                      {space.cachedSizeBytes != null ? ` · ${humanFileSize(space.cachedSizeBytes)}` : ""}
                      {space.cachedTruncated ? " · truncated" : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {space.rules.length === 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                      No rules
                    </span>
                  )}
                  {space.rules.slice(0, 4).map((rule) => (
                    <span
                      key={rule.id}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 truncate max-w-full"
                    >
                      {describeRule(rule, tags)}
                    </span>
                  ))}
                  {space.rules.length > 4 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full text-zinc-400">
                      +{space.rules.length - 4}
                    </span>
                  )}
                </div>
                <p className="mt-3 text-[11px] text-zinc-400 capitalize">
                  {space.matchMode === "and" ? "All rules" : "Any rule"} · {space.layout}
                </p>
              </Link>
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                <button
                  type="button"
                  onClick={() => openEdit(space)}
                  className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 hover:text-zinc-900"
                  aria-label="Edit space"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(space.id)}
                  className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 hover:text-red-600"
                  aria-label="Delete space"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <ConfirmModal
        open={target !== null}
        title="Delete Smart Space?"
        message={`"${target?.name ?? ""}" will be removed. Files in Drive are not affected.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

function accentBorder(color: string | null): string {
  switch (color) {
    case "blue": return "border-l-4 border-l-blue-500";
    case "emerald": return "border-l-4 border-l-emerald-500";
    case "amber": return "border-l-4 border-l-amber-500";
    case "violet": return "border-l-4 border-l-violet-500";
    case "rose": return "border-l-4 border-l-rose-500";
    default: return "";
  }
}
