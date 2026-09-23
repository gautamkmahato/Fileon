"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import type { Tag } from "@/lib/tags";
import { addTagToFile, bulkAddTag, bulkRemoveTag, createTag, removeTagFromFile } from "@/lib/tags";
import { getTagColor } from "@/lib/tag-colors";
import { logTagFileChanges } from "@/lib/tag-activity";
import {
  TAG_KIND_META,
  TAG_KINDS,
  displayTagName,
  groupTagsByKind,
  isExclusiveKind,
  suggestedSystemTagIds,
  tagKind,
  type TagKind,
} from "@/lib/tag-kinds";
import { toast } from "@/lib/toast";

interface TagPickerModalProps {
  open: boolean;
  onClose: () => void;
  fileIds: string[];
  fileNames: string[];
  fileLabel: string;
  tags: Tag[];
  initialTagIds: string[];
  mimeTypes?: string[];
  onManageTags?: () => void;
  onTagsApplied?: () => void;
}

export function TagPickerModal({
  open, onClose, fileIds, fileNames, fileLabel, tags, initialTagIds, mimeTypes, onManageTags, onTagsApplied,
}: TagPickerModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [creatingKind, setCreatingKind] = useState<TagKind | null>(null);
  const [createdTags, setCreatedTags] = useState<Tag[]>([]);

  useEffect(() => {
    if (open) {
      setSelected(new Set(initialTagIds));
      setQuery("");
      setCreatingKind(null);
      setCreatedTags([]);
    }
  }, [open, initialTagIds]);

  const allTags = useMemo(() => {
    if (createdTags.length === 0) return tags;
    const seen = new Set(tags.map((t) => t.id));
    return [...tags, ...createdTags.filter((t) => !seen.has(t.id))];
  }, [tags, createdTags]);

  const grouped = useMemo(() => groupTagsByKind(allTags), [allTags]);
  const q = query.trim().toLowerCase();

  const suggestedIds = useMemo(() => {
    if (!mimeTypes?.length) return [];
    const sets = mimeTypes.map((m) => new Set(suggestedSystemTagIds(m)));
    if (sets.length === 0) return [];
    return [...sets[0]].filter((id) => sets.every((s) => s.has(id)));
  }, [mimeTypes]);

  const suggestedTags = useMemo(
    () => suggestedIds.map((id) => tags.find((t) => t.id === id)).filter((t): t is Tag => !!t),
    [suggestedIds, tags],
  );

  if (!open) return null;

  function toggle(tag: Tag) {
    setSelected((prev) => {
      const next = new Set(prev);
      const kind = tagKind(tag);
      if (next.has(tag.id)) {
        next.delete(tag.id);
        return next;
      }
      if (isExclusiveKind(kind)) {
        for (const other of allTags) {
          if (tagKind(other) === kind) next.delete(other.id);
        }
      }
      next.add(tag.id);
      return next;
    });
  }

  async function handleCreate(kind: TagKind) {
    if (!query.trim() || creatingKind) return;
    setCreatingKind(kind);
    try {
      const created = await createTag({ name: query, kind });
      setCreatedTags((prev) => [...prev, created]);
      setSelected((prev) => {
        const next = new Set(prev);
        if (isExclusiveKind(kind)) {
          for (const other of allTags) {
            if (tagKind(other) === kind) next.delete(other.id);
          }
        }
        next.add(created.id);
        return next;
      });
      setQuery("");
      toast.success(`Created "${created.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create tag");
    } finally {
      setCreatingKind(null);
    }
  }

  async function handleApply() {
    setBusy(true);
    try {
      const targetSet = selected;
      const initialSet = new Set(initialTagIds);
      const toAdd = [...targetSet].filter((id) => !initialSet.has(id));
      const toRemove = [...initialSet].filter((id) => !targetSet.has(id));

      if (fileIds.length === 1) {
        for (const tagId of toAdd) await addTagToFile(fileIds[0], tagId);
        for (const tagId of toRemove) await removeTagFromFile(fileIds[0], tagId);
      } else {
        for (const tagId of toAdd) await bulkAddTag(fileIds, tagId);
        for (const tagId of toRemove) await bulkRemoveTag(fileIds, tagId);
      }

      if (toAdd.length || toRemove.length) {
        const tagName = (id: string) => {
          const tag = allTags.find((t) => t.id === id);
          return tag ? displayTagName(tag) : id;
        };
        await logTagFileChanges({
          fileIds,
          fileNames,
          addedTagNames: toAdd.map(tagName),
          removedTagNames: toRemove.map(tagName),
        });
        onTagsApplied?.();
      }

      toast.success(
        fileIds.length === 1
          ? "Tags updated"
          : `Tags updated for ${fileIds.length} items`
      );
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update tags");
    } finally {
      setBusy(false);
    }
  }

  const nameMatches = (tag: Tag) => {
    if (!q) return true;
    return displayTagName(tag).toLowerCase().includes(q) || tag.name.toLowerCase().includes(q);
  };

  const anyVisible = TAG_KINDS.some((k) => (grouped.get(k) ?? []).some(nameMatches));
  const createName = query.replace(/^#+/, "").trim();
  const createKinds = (["user", "people", "project", "status"] as TagKind[]).filter((kind) => {
    if (!createName) return false;
    return !allTags.some(
      (t) => tagKind(t) === kind && t.name.toLowerCase() === createName.toLowerCase(),
    );
  });

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200/80 dark:border-zinc-700">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Tags</h2>
            <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-[240px]">{fileLabel}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-2 border-b border-zinc-200 dark:border-zinc-700">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or create…"
            className="w-full h-9 px-3 rounded-lg border border-zinc-200/80 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm outline-none"
            autoFocus
          />
        </div>

        <div className="max-h-80 overflow-y-auto py-2">
          {allTags.length === 0 && !query.trim() ? (
            <div className="px-5 py-6 text-center">
              <p className="text-sm text-zinc-500 mb-3">No tags yet.</p>
              {onManageTags && (
                <button
                  onClick={onManageTags}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  Create your first tag
                </button>
              )}
            </div>
          ) : (
            <>
              {suggestedTags.length > 0 && !q && (
                <PickerSection title="Suggested">
                  {suggestedTags.map((tag) => (
                    <PickerRow key={tag.id} tag={tag} checked={selected.has(tag.id)} exclusive={isExclusiveKind(tagKind(tag))} onToggle={() => toggle(tag)} />
                  ))}
                </PickerSection>
              )}
              {TAG_KINDS.map((kind) => {
                let list = (grouped.get(kind) ?? []).filter(nameMatches);
                if (kind === "system" && !q && suggestedIds.length) {
                  const skip = new Set(suggestedIds);
                  list = list.filter((t) => !skip.has(t.id));
                }
                if (list.length === 0) return null;
                return (
                  <PickerSection key={kind} title={TAG_KIND_META[kind].label} hint={TAG_KIND_META[kind].hint}>
                    {list.map((tag) => (
                      <PickerRow
                        key={tag.id}
                        tag={tag}
                        checked={selected.has(tag.id)}
                        exclusive={isExclusiveKind(kind)}
                        onToggle={() => toggle(tag)}
                      />
                    ))}
                  </PickerSection>
                );
              })}
              {!anyVisible && createKinds.length === 0 && (
                <p className="px-5 py-4 text-sm text-zinc-500 text-center">No matching tags</p>
              )}
              {createKinds.length > 0 && (
                <div className="px-5 py-2 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">Create</p>
                  {createKinds.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => void handleCreate(kind)}
                      disabled={!!creatingKind}
                      className="w-full flex items-center gap-2 px-0 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:text-zinc-900"
                    >
                      {creatingKind === kind ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      {TAG_KIND_META[kind].label}: {createName}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-between items-center gap-2 px-5 py-4 border-t border-zinc-200 dark:border-zinc-700">
          {onManageTags ? (
            <button
              onClick={onManageTags}
              className="text-sm text-blue-600 hover:underline"
            >
              Manage tags
            </button>
          ) : <span />}
          <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleApply()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg btn-primary text-sm font-medium disabled:opacity-50"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Apply
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PickerSection({
  title, hint, children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      <p className="px-5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">
        {title}
        {hint ? <span className="ml-1.5 font-medium normal-case tracking-normal text-zinc-300 dark:text-zinc-600">{hint}</span> : null}
      </p>
      {children}
    </div>
  );
}

function PickerRow({
  tag, checked, exclusive, onToggle,
}: {
  tag: Tag;
  checked: boolean;
  exclusive: boolean;
  onToggle: () => void;
}) {
  const color = getTagColor(tag.colorId);
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-5 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left"
    >
      <span className={`w-4 h-4 rounded ${exclusive ? "rounded-full" : ""} border flex items-center justify-center shrink-0 ${
        checked ? "bg-zinc-900 border-zinc-900" : "border-zinc-300 dark:border-zinc-600"
      }`}>
        {checked && <Check className="w-3 h-3 text-white" />}
      </span>
      {tag.emoji ? (
        <span className="w-4 text-center shrink-0 text-sm leading-none">{tag.emoji}</span>
      ) : (
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${color.dot}`} />
      )}
      <span className="text-sm text-zinc-900 dark:text-zinc-100 truncate">{displayTagName(tag)}</span>
    </button>
  );
}
