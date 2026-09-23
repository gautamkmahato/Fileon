"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import type { Tag } from "@/lib/tags";
import { createTag, deleteTag, updateTag } from "@/lib/tags";
import { TAG_COLORS } from "@/lib/tag-colors";
import { getTagColor } from "@/lib/tag-colors";
import {
  TAG_KIND_META,
  TAG_KINDS,
  displayTagName,
  groupTagsByKind,
  isBuiltinTag,
  tagKind,
  type TagKind,
} from "@/lib/tag-kinds";
import { ConfirmModal } from "../ui/Dialogs";
import { toast } from "@/lib/toast";

interface TagManageModalProps {
  open: boolean;
  onClose: () => void;
  tags: Tag[];
  counts: Map<string, number>;
}

const CREATABLE_KINDS = TAG_KINDS.filter((k) => TAG_KIND_META[k].creatable);

export function TagManageModal({ open, onClose, tags, counts }: TagManageModalProps) {
  const [name, setName] = useState("");
  const [colorId, setColorId] = useState(TAG_COLORS[8].id);
  const [kind, setKind] = useState<TagKind>("user");
  const [emoji, setEmoji] = useState("");
  const [editing, setEditing] = useState<Tag | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);
  const [busy, setBusy] = useState(false);
  const [filterKind, setFilterKind] = useState<TagKind | "all">("all");

  const grouped = useMemo(() => groupTagsByKind(tags), [tags]);

  useEffect(() => {
    if (!open) {
      resetForm();
      setFilterKind("all");
    }
  }, [open]);

  function resetForm() {
    setName("");
    setColorId(TAG_COLORS[8].id);
    setKind("user");
    setEmoji("");
    setEditing(null);
  }

  if (!open) return null;

  const editingBuiltin = editing ? isBuiltinTag(editing) : false;
  const visibleKinds = filterKind === "all" ? TAG_KINDS : [filterKind];

  async function handleSave() {
    if (!name.trim() && !editingBuiltin) return;
    setBusy(true);
    try {
      if (editing) {
        await updateTag(editing.id, editingBuiltin
          ? { colorId }
          : { name, colorId, kind, emoji: emoji || undefined });
        toast.success(`Updated "${name.trim() || editing.name}"`);
      } else {
        const created = await createTag({ name, colorId, kind, emoji: emoji || undefined });
        toast.success(`Created "${created.name}"`);
      }
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save tag");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(tag: Tag) {
    setEditing(tag);
    setName(tag.name);
    setColorId(tag.colorId);
    setKind(tagKind(tag));
    setEmoji(tag.emoji ?? "");
  }

  return (
    <>
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200/80 dark:border-zinc-700 max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-700">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Manage tags</h2>
              <p className="text-xs text-zinc-500 mt-0.5">App labels — not Google Drive labels. Combine them freely.</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-700 space-y-3">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              {editing ? (editingBuiltin ? "Built-in tag" : "Edit tag") : "New tag"}
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={kind === "user" ? "acme, urgent, tax…" : "Name…"}
              disabled={editingBuiltin}
              className="w-full h-10 px-3 rounded-lg border border-zinc-200/80 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-zinc-800 disabled:opacity-60"
              onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
            />
            {!editingBuiltin && (
              <div className="flex flex-wrap gap-1">
                {CREATABLE_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                      kind === k
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                    title={TAG_KIND_META[k].hint}
                  >
                    {TAG_KIND_META[k].label}
                  </button>
                ))}
              </div>
            )}
            <div>
              <p className="text-xs text-zinc-500 mb-2">Color</p>
              <div className="flex flex-wrap gap-2">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setColorId(c.id)}
                    className={`w-7 h-7 rounded-full ${c.dot} ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900 ${
                      colorId === c.id ? "ring-zinc-400" : "ring-transparent"
                    }`}
                    title={c.id}
                  />
                ))}
              </div>
            </div>
            {!editingBuiltin && (
              <div>
                <p className="text-xs text-zinc-500 mb-1.5">Emoji (optional)</p>
                <input
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value.slice(0, 8))}
                  placeholder="👤"
                  className="w-20 h-9 px-2 rounded-lg border border-zinc-200/80 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                />
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => void handleSave()}
                disabled={busy || (!editingBuiltin && !name.trim())}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg btn-primary text-sm font-medium disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {editing ? "Save" : "Create"}
              </button>
              {editing && (
                <button
                  onClick={resetForm}
                  className="px-4 py-2 rounded-lg text-sm text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Cancel edit
                </button>
              )}
            </div>
          </div>

          <div className="px-5 pt-3 flex flex-wrap gap-1">
            <KindChip active={filterKind === "all"} onClick={() => setFilterKind("all")}>All</KindChip>
            {TAG_KINDS.map((k) => (
              <KindChip key={k} active={filterKind === k} onClick={() => setFilterKind(k)}>
                {TAG_KIND_META[k].label}
              </KindChip>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-3">
            {tags.length === 0 ? (
              <p className="text-sm text-zinc-500 py-4 text-center">No tags yet. Create one above.</p>
            ) : visibleKinds.every((k) => (grouped.get(k) ?? []).length === 0) ? (
              <p className="text-sm text-zinc-500 py-4 text-center">Nothing in this group yet.</p>
            ) : (
              visibleKinds.map((k) => {
                const list = grouped.get(k) ?? [];
                if (list.length === 0) return null;
                return (
                  <div key={k} className="mb-4 last:mb-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400 mb-1">
                      {TAG_KIND_META[k].label}
                      <span className="ml-1.5 font-medium normal-case tracking-normal text-zinc-300 dark:text-zinc-600">
                        {TAG_KIND_META[k].hint}
                      </span>
                    </p>
                    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {list.map((tag) => {
                        const color = getTagColor(tag.colorId);
                        const count = counts.get(tag.id) ?? 0;
                        const builtin = isBuiltinTag(tag);
                        return (
                          <li key={tag.id} className="flex items-center gap-3 py-2.5">
                            {tag.emoji ? (
                              <span className="w-5 text-center shrink-0 text-sm">{tag.emoji}</span>
                            ) : (
                              <span className={`w-3 h-3 rounded-full shrink-0 ${color.dot}`} />
                            )}
                            <button
                              onClick={() => startEdit(tag)}
                              className="flex-1 text-left text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:text-blue-600 min-w-0"
                              title="Click to edit"
                            >
                              <span className="truncate">{displayTagName(tag)}</span>
                              <span className="ml-2 text-xs text-zinc-400 font-normal">({count})</span>
                            </button>
                            {!builtin && (
                              <button
                                onClick={() => setDeleteTarget(tag)}
                                className="w-8 h-8 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center"
                                aria-label={`Delete ${tag.name}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={deleteTarget !== null}
        title="Delete tag?"
        message={
          deleteTarget
            ? `"${deleteTarget.name}" will be removed from all files. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete tag"
        confirmVariant="danger"
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            try {
              await deleteTag(deleteTarget.id);
              toast.success(`Deleted tag "${deleteTarget.name}"`);
              if (editing?.id === deleteTarget.id) resetForm();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Couldn't delete that tag");
            }
          }
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

function KindChip({
  active, onClick, children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${
        active
          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}
