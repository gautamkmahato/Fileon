"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import type { ViewIconId } from "@/lib/view-icons";
import { VIEW_ICONS, getViewIcon } from "@/lib/view-icons";
import { createView, describeViewScope, type ViewScope } from "@/lib/views";
import type { Filters } from "@/lib/utils/filter";
import type { SortState } from "@/lib/utils/sort";
import type { ViewLayout } from "@/lib/views";
import { toast } from "@/lib/toast";

const EMOJI_PRESETS = ["📁", "📄", "⭐", "🏷️", "🔍", "📅", "📦", "👥", "💼", "🎯", "✨", "🔥"];

interface SaveViewModalProps {
  open: boolean;
  onClose: () => void;
  scope: ViewScope;
  filters: Filters;
  search: string;
  sort: SortState;
  layout: ViewLayout;
  tagNames: string[];
  onSaved?: (viewId: string) => void;
}

export function SaveViewModal({
  open, onClose, scope, filters, search, sort, layout, tagNames, onSaved,
}: SaveViewModalProps) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState<string | undefined>(undefined);
  const [icon, setIcon] = useState<ViewIconId>("bookmark");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setEmoji(undefined);
      setIcon("bookmark");
    }
  }, [open]);

  if (!open) return null;

  async function handleSave() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const view = await createView({
        name,
        emoji,
        icon,
        scope,
        filters,
        search,
        sort,
        layout,
      });
      toast.success(`Saved view "${view.name}"`);
      onSaved?.(view.id);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save view");
    } finally {
      setBusy(false);
    }
  }

  const scopeLabel = describeViewScope(scope, tagNames);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200/80 dark:border-zinc-700">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Save view</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-zinc-500">
            Saves folder, filters, sort, layout, tags, and search. {scopeLabel}
          </p>

          <div>
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Recent reports"
              className="mt-1.5 w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-sm outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-zinc-800"
              onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Emoji (optional)</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button
                onClick={() => setEmoji(undefined)}
                className={`w-9 h-9 rounded-lg border text-xs ${
                  !emoji ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 dark:border-zinc-700"
                }`}
              >
                —
              </button>
              {EMOJI_PRESETS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`w-9 h-9 rounded-lg border text-base ${
                    emoji === e ? "border-zinc-900 bg-zinc-900" : "border-zinc-200 dark:border-zinc-700"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Icon (optional)</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {VIEW_ICONS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setIcon(id)}
                  title={label}
                  className={`w-9 h-9 rounded-lg border flex items-center justify-center ${
                    icon === id ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 dark:border-zinc-700 text-zinc-500"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 text-sm text-zinc-600 dark:text-zinc-400">
            {emoji ? (
              <span className="text-base">{emoji}</span>
            ) : (
              (() => {
                const Icon = getViewIcon(icon);
                return <Icon className="w-4 h-4 shrink-0" />;
              })()
            )}
            <span className="truncate">{name.trim() || "View name"}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-200 dark:border-zinc-700">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={busy || !name.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg btn-primary text-sm font-medium disabled:opacity-50"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Save view
          </button>
        </div>
      </div>
    </div>
  );
}
