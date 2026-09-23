"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { useTags } from "../tags/TagsProvider";
import { toast } from "@/lib/toast";
import {
  defaultOpForField,
  defaultValueForField,
  FIELD_LABELS,
  opsForField,
  ruleIsValid,
  SPACE_DATE_PRESETS,
  SPACE_FILE_TYPES,
} from "@/lib/spaces/rules";
import type { SpaceDraft, SpaceRule, SmartSpace } from "@/lib/spaces";
import type { Tag } from "@/lib/tags";
import type { SpaceRuleField, SpaceRuleOp, SpaceRuleValue } from "@/lib/db/schema";
import { MAX_SPACE_RULES } from "@/lib/db/schema";
import { TAG_KIND_META, TAG_KINDS, tagKind, tagShortLabel } from "@/lib/tag-kinds";
import { useSpaces } from "./SpacesProvider";

const EMOJI_PRESETS = ["🧾", "📁", "🎬", "🖼️", "⭐", "🔍", "📦", "💼", "🏷️", "⚠️", "✨", "📌"];
const COLORS = ["zinc", "blue", "emerald", "amber", "violet", "rose"] as const;

interface SpaceEditorModalProps {
  open: boolean;
  space: SmartSpace | null;
  onClose: () => void;
  onSaved?: (spaceId: string) => void;
}

interface DraftRule {
  key: string;
  field: SpaceRuleField;
  op: SpaceRuleOp;
  value: SpaceRuleValue;
}

export function SpaceEditorModal({ open, space, onClose, onSaved }: SpaceEditorModalProps) {
  const { tags } = useTags();
  const { createSpace, updateSpace } = useSpaces();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState<string | undefined>(undefined);
  const [color, setColor] = useState<string>("zinc");
  const [matchMode, setMatchMode] = useState<"and" | "or">("and");
  const [layout, setLayout] = useState<SpaceDraft["layout"]>("grid");
  const [rules, setRules] = useState<DraftRule[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(space?.name ?? "");
    setEmoji(space?.emoji ?? undefined);
    setColor(space?.color ?? "zinc");
    setMatchMode(space?.matchMode ?? "and");
    setLayout(space?.layout ?? "grid");
    setRules(
      space?.rules.length
        ? space.rules.map(toDraftRule)
        : [blankRule("type", tags)],
    );
    setBusy(false);
  }, [open, space, tags]);

  const canSave = name.trim().length > 0 && rules.length > 0 && !busy;

  if (!open) return null;

  async function handleSave() {
    if (!canSave) return;
    const validRules = rules.filter((r) => ruleIsValid(r));
    if (validRules.length === 0) {
      toast.error("Add at least one complete rule");
      return;
    }
    setBusy(true);
    try {
      const draft: SpaceDraft = {
        name,
        emoji: emoji ?? null,
        color,
        matchMode,
        layout,
        sortField: space?.sortField ?? "modified",
        sortDir: space?.sortDir ?? "desc",
        rules: validRules.map((r) => ({ field: r.field, op: r.op, value: r.value })),
      };
      const saved = space
        ? await updateSpace(space.id, draft)
        : await createSpace(draft);
      if (!saved) throw new Error("Couldn't save Smart Space");
      toast.success(space ? `Updated "${saved.name}"` : `Created "${saved.name}"`);
      onSaved?.(saved.id);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save Smart Space");
    } finally {
      setBusy(false);
    }
  }

  function addRule() {
    if (rules.length >= MAX_SPACE_RULES) return;
    setRules((prev) => [...prev, blankRule("type", tags)]);
  }

  function updateRule(key: string, patch: Partial<DraftRule>) {
    setRules((prev) => prev.map((r) => {
      if (r.key !== key) return r;
      const next = { ...r, ...patch };
      if (patch.field && patch.field !== r.field) {
        next.op = defaultOpForField(patch.field);
        next.value = defaultValueForField(patch.field, tags);
      }
      return next;
    }));
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200/80 dark:border-zinc-700 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {space ? "Edit Smart Space" : "New Smart Space"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Invoices"
              maxLength={80}
              className="w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-sm outline-none focus:border-zinc-400 text-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Emoji</p>
            <div className="flex flex-wrap gap-1">
              {EMOJI_PRESETS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setEmoji(emoji === item ? undefined : item)}
                  className={`w-8 h-8 rounded-lg text-base ${
                    emoji === item
                      ? "bg-zinc-900 dark:bg-zinc-100"
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Color</p>
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full ${colorDot(c)} ${color === c ? "ring-2 ring-offset-2 ring-zinc-900 dark:ring-zinc-100 dark:ring-offset-zinc-900" : ""}`}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Match</p>
            <div className="flex gap-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5 w-fit">
              <button
                type="button"
                onClick={() => setMatchMode("and")}
                className={`px-3 py-1 rounded-md text-xs font-medium ${matchMode === "and" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-500"}`}
              >
                All rules
              </button>
              <button
                type="button"
                onClick={() => setMatchMode("or")}
                className={`px-3 py-1 rounded-md text-xs font-medium ${matchMode === "or" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-500"}`}
              >
                Any rule
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Default layout</p>
            <div className="flex gap-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5 w-fit">
              {(["grid", "list", "gallery"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setLayout(item)}
                  className={`px-3 py-1 rounded-md text-xs font-medium capitalize ${
                    layout === item
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-500"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Rules</p>
              <button
                type="button"
                onClick={addRule}
                disabled={rules.length >= MAX_SPACE_RULES}
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                Add rule
              </button>
            </div>
            <p className="text-[11px] text-zinc-500 mb-2">
              Files stay in Drive. This space is a live view of matches. Use tags for status or client.
            </p>
            <div className="space-y-2">
              {rules.map((rule) => (
                <RuleRow
                  key={rule.key}
                  rule={rule}
                  tags={tags}
                  onChange={(patch) => updateRule(rule.key, patch)}
                  onRemove={() => setRules((prev) => prev.filter((r) => r.key !== rule.key))}
                  canRemove={rules.length > 1}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-700 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium px-4 py-2 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!canSave}
            className="text-sm font-medium px-4 py-2 rounded-lg btn-primary disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {space ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RuleRow({
  rule, tags, onChange, onRemove, canRemove,
}: {
  rule: DraftRule;
  tags: Tag[];
  onChange: (patch: Partial<DraftRule>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const ops = opsForField(rule.field);
  return (
    <div className="flex items-start gap-2">
      <select
        value={rule.field}
        onChange={(e) => onChange({ field: e.target.value as SpaceRuleField })}
        className="h-9 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-200 shrink-0"
      >
        {(Object.keys(FIELD_LABELS) as SpaceRuleField[]).map((field) => (
          <option key={field} value={field} disabled={field === "tag" && tags.length === 0}>
            {FIELD_LABELS[field]}
          </option>
        ))}
      </select>
      {ops.length > 1 && (
        <select
          value={rule.op}
          onChange={(e) => onChange({ op: e.target.value as SpaceRuleOp })}
          className="h-9 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-200 shrink-0"
        >
          {ops.map((op) => (
            <option key={op} value={op}>{opLabel(rule.field, op)}</option>
          ))}
        </select>
      )}
      <RuleValue rule={rule} tags={tags} onChange={onChange} />
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-30 shrink-0"
        aria-label="Remove rule"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function RuleValue({
  rule, tags, onChange,
}: {
  rule: DraftRule;
  tags: Tag[];
  onChange: (patch: Partial<DraftRule>) => void;
}) {
  if (rule.field === "starred" || rule.field === "shared" || rule.field === "untagged") {
    return <span className="h-9 flex items-center text-xs text-zinc-500 px-1">Yes</span>;
  }
  if (rule.field === "type") {
    return (
      <select
        value={String(rule.value)}
        onChange={(e) => onChange({ value: e.target.value })}
        className="flex-1 h-9 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-200 min-w-0"
      >
        {SPACE_FILE_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
    );
  }
  if (rule.field === "tag") {
    if (tags.length === 0) {
      return <span className="h-9 flex items-center text-xs text-zinc-500">Create a tag first</span>;
    }
    return (
      <select
        value={String(rule.value)}
        onChange={(e) => onChange({ value: e.target.value })}
        className="flex-1 h-9 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-200 min-w-0"
      >
        {TAG_KINDS.map((kind) => {
          const list = tags.filter((t) => tagKind(t) === kind);
          if (list.length === 0) return null;
          return (
            <optgroup key={kind} label={TAG_KIND_META[kind].label}>
              {list.map((t) => (
                <option key={t.id} value={t.id}>{tagShortLabel(t)}</option>
              ))}
            </optgroup>
          );
        })}
      </select>
    );
  }
  if (rule.field === "created" || rule.field === "modified") {
    return (
      <select
        value={String(rule.value)}
        onChange={(e) => onChange({ value: e.target.value })}
        className="flex-1 h-9 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-200 min-w-0"
      >
        {SPACE_DATE_PRESETS.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>
    );
  }
  if (rule.field === "size") {
    return (
      <SizeInput
        bytes={typeof rule.value === "number" ? rule.value : 0}
        onChange={(bytes) => onChange({ value: bytes })}
      />
    );
  }
  return (
    <input
      value={String(rule.value ?? "")}
      onChange={(e) => onChange({ value: e.target.value })}
      placeholder="invoice"
      className="flex-1 h-9 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-100 min-w-0"
    />
  );
}

function SizeInput({ bytes, onChange }: { bytes: number; onChange: (bytes: number) => void }) {
  const { amount, unit } = useMemo(() => splitSize(bytes), [bytes]);
  return (
    <div className="flex-1 flex gap-1 min-w-0">
      <input
        type="number"
        min={0}
        value={amount}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(toBytes(Number.isFinite(n) ? n : 0, unit));
        }}
        className="flex-1 h-9 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs min-w-0"
      />
      <select
        value={unit}
        onChange={(e) => onChange(toBytes(amount, e.target.value as SizeUnit))}
        className="h-9 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs"
      >
        <option value="KB">KB</option>
        <option value="MB">MB</option>
        <option value="GB">GB</option>
      </select>
    </div>
  );
}

type SizeUnit = "KB" | "MB" | "GB";

function splitSize(bytes: number): { amount: number; unit: SizeUnit } {
  if (bytes >= 1024 * 1024 * 1024 && bytes % (1024 * 1024 * 1024) === 0) {
    return { amount: bytes / (1024 * 1024 * 1024), unit: "GB" };
  }
  if (bytes >= 1024 * 1024 && bytes % (1024 * 1024) === 0) {
    return { amount: bytes / (1024 * 1024), unit: "MB" };
  }
  if (bytes >= 1024 && bytes % 1024 === 0) {
    return { amount: bytes / 1024, unit: "KB" };
  }
  if (bytes >= 1024 * 1024 * 1024) return { amount: +(bytes / (1024 * 1024 * 1024)).toFixed(1), unit: "GB" };
  if (bytes >= 1024 * 1024) return { amount: +(bytes / (1024 * 1024)).toFixed(1), unit: "MB" };
  return { amount: Math.max(0, Math.round(bytes / 1024)), unit: "KB" };
}

function toBytes(amount: number, unit: SizeUnit): number {
  const n = Math.max(0, amount);
  if (unit === "GB") return Math.round(n * 1024 * 1024 * 1024);
  if (unit === "MB") return Math.round(n * 1024 * 1024);
  return Math.round(n * 1024);
}

function toDraftRule(rule: SpaceRule): DraftRule {
  return { key: rule.id, field: rule.field, op: rule.op, value: rule.value };
}

function blankRule(field: SpaceRuleField, tags: Tag[]): DraftRule {
  return {
    key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    field,
    op: defaultOpForField(field),
    value: defaultValueForField(field, tags),
  };
}

function opLabel(field: SpaceRuleField, op: SpaceRuleOp): string {
  if (field === "size") {
    if (op === "gt") return ">";
    if (op === "gte") return "≥";
    if (op === "lt") return "<";
    if (op === "lte") return "≤";
  }
  if (op === "neq") return "is not";
  if (op === "contains") return "contains";
  return "is";
}

function colorDot(color: string): string {
  switch (color) {
    case "blue": return "bg-blue-500";
    case "emerald": return "bg-emerald-500";
    case "amber": return "bg-amber-500";
    case "violet": return "bg-violet-500";
    case "rose": return "bg-rose-500";
    default: return "bg-zinc-400";
  }
}
