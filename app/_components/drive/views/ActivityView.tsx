"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Download, FolderPlus, Loader2, Pencil, Pin, RotateCcw, Share2, Star, Tag, Trash2, Upload,
} from "lucide-react";
import {
  type ActivityDateRange,
  type ActivityEntry,
  type ActivityFilterType,
  type ActivityType,
  canUndoActivity,
  clearActivity,
  executeActivityUndo,
  getActivity,
  hasSeenActivityOnboarding,
  markActivityOnboardingSeen,
  subscribeActivity,
} from "@/lib/activity-log";
import { ConfirmModal } from "../../ui/Dialogs";

interface ActivityViewProps {
  onOpenFile: (fileId: string, fileName: string) => void;
}

const ACTION_FILTER_OPTIONS: Array<{ value: ActivityFilterType; label: string }> = [
  { value: "all", label: "All actions" },
  { value: "renames", label: "Renames" },
  { value: "moves", label: "Moves" },
  { value: "trash-actions", label: "Trash" },
  { value: "shares", label: "Shares" },
  { value: "uploads", label: "Uploads" },
  { value: "creates", label: "Creates" },
  { value: "tags", label: "Tags" },
  { value: "pins", label: "Pins" },
];

const DATE_OPTIONS: Array<{ value: ActivityDateRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

export function ActivityView({ onOpenFile }: ActivityViewProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [actionFilter, setActionFilter] = useState<ActivityFilterType>("all");
  const [dateRange, setDateRange] = useState<ActivityDateRange>("all");
  const [search, setSearch] = useState("");
  const [clearConfirm, setClearConfirm] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    const rows = await getActivity({
      limit: 50,
      filter: actionFilter,
      dateRange,
      search,
    });
    setEntries(rows);
    setHasMore(rows.length === 50);
    setLoading(false);
  }, [actionFilter, dateRange, search]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!hasSeenActivityOnboarding()) setShowOnboarding(true);
    return subscribeActivity((entry) => {
      setEntries((prev) => {
        const exists = prev.some((e) => e.id === entry.id);
        if (exists) return prev.map((e) => (e.id === entry.id ? entry : e));
        return [entry, ...prev];
      });
    });
  }, []);

  async function loadMore() {
    if (!hasMore || loadingMoreRef.current || entries.length === 0) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const before = entries[entries.length - 1].timestamp;
    const rows = await getActivity({
      limit: 50,
      before,
      filter: actionFilter,
      dateRange,
      search,
    });
    setEntries((prev) => [...prev, ...rows]);
    setHasMore(rows.length === 50);
    setLoadingMore(false);
    loadingMoreRef.current = false;
  }

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (hits) => { if (hits[0]?.isIntersecting) void loadMore(); },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [entries.length, hasMore, actionFilter, dateRange, search]);

  async function handleClear() {
    await clearActivity();
    setEntries([]);
    setHasMore(false);
    setClearConfirm(false);
  }

  const groups = groupEntries(entries);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Activity</h1>
        <button
          onClick={() => setClearConfirm(true)}
          className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Clear history
        </button>
      </div>

      <div className="mb-4 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 text-sm text-blue-800 dark:text-blue-200">
        Stored locally on your device only. This log is never sent to Google or anywhere else.
      </div>

      {showOnboarding && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-700 dark:text-zinc-300 flex items-start justify-between gap-3">
          <p>
            Activity tracks actions you take in this app — renames, moves, uploads, and more.
            Everything stays on this device. You can pause logging or clear history anytime.
          </p>
          <button
            onClick={() => { setShowOnboarding(false); markActivityOnboardingSeen(); }}
            className="text-xs font-semibold text-blue-600 shrink-0 hover:underline"
          >
            Got it
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <FilterSelect
          value={actionFilter}
          options={ACTION_FILTER_OPTIONS}
          onChange={(v) => setActionFilter(v as ActivityFilterType)}
        />
        <FilterSelect
          value={dateRange}
          options={DATE_OPTIONS}
          onChange={(v) => setDateRange(v as ActivityDateRange)}
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search activity…"
          className="flex-1 min-w-[160px] h-9 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm outline-none focus:ring-2 focus:ring-zinc-100 dark:focus:ring-zinc-800"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No activity yet</p>
          <p className="text-xs text-zinc-500 mt-1">Actions you take will appear here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2 px-1">
                {group.label}
              </h2>
              <ul className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800">
                {group.entries.map((entry) => (
                  <ActivityRow
                    key={entry.id}
                    entry={entry}
                    expanded={hoveredId === entry.id}
                    onHover={setHoveredId}
                    onOpenFile={onOpenFile}
                    onUndo={async () => {
                      await executeActivityUndo(entry.id);
                    }}
                  />
                ))}
              </ul>
            </section>
          ))}
          <div ref={sentinelRef} className="h-4 flex justify-center">
            {loadingMore && <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />}
          </div>
        </div>
      )}

      <ConfirmModal
        open={clearConfirm}
        title="Clear activity history?"
        message="All locally stored activity will be permanently deleted. This cannot be undone."
        confirmLabel="Clear history"
        confirmVariant="danger"
        onClose={() => setClearConfirm(false)}
        onConfirm={handleClear}
      />
    </div>
  );
}

function ActivityRow({
  entry, expanded, onHover, onOpenFile, onUndo,
}: {
  entry: ActivityEntry;
  expanded: boolean;
  onHover: (id: string | null) => void;
  onOpenFile: (fileId: string, fileName: string) => void;
  onUndo: () => void;
}) {
  const icon = activityIcon(entry.type);
  const showUndo = canUndoActivity(entry.id, entry);
  const isTagMeta = entry.type === "tag-create" || entry.type === "tag-update" || entry.type === "tag-delete";
  const showFileLinks = !isTagMeta && entry.fileIds.length > 0;

  return (
    <li
      className={`px-4 py-3 transition-colors ${entry.undone ? "opacity-50" : ""} ${expanded ? "bg-zinc-50 dark:bg-zinc-800/50" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/30"}`}
      onMouseEnter={() => onHover(entry.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${icon.bg}`}>
          {icon.el}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm text-zinc-900 dark:text-zinc-100 ${entry.undone ? "line-through" : ""}`}>
            {entry.description}
          </p>
          {expanded && entry.fileNames.length > 0 && !isTagMeta && (
            <p className="text-xs text-zinc-500 mt-1 truncate">
              {entry.fileNames.length === 1
                ? entry.fileNames[0]
                : `${entry.fileNames.length} files: ${entry.fileNames.slice(0, 3).join(", ")}${entry.fileNames.length > 3 ? "…" : ""}`}
            </p>
          )}
          {expanded && showFileLinks && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {entry.fileIds.map((id, i) => (
                <button
                  key={id}
                  onClick={() => onOpenFile(id, entry.fileNames[i] ?? "file")}
                  className="text-xs px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[200px]"
                >
                  {entry.fileNames[i] ?? id}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showUndo && (
            <button
              onClick={onUndo}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Undo
            </button>
          )}
          <span className="text-xs text-zinc-400 whitespace-nowrap">{formatRelative(entry.timestamp)}</span>
        </div>
      </div>
    </li>
  );
}

function FilterSelect({
  value, options, onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-700 dark:text-zinc-300 outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function activityIcon(type: ActivityType): { el: ReactNode; bg: string } {
  const cls = "w-4 h-4";
  switch (type) {
    case "trash":
    case "delete-forever":
      return { el: <Trash2 className={`${cls} text-red-500`} />, bg: "bg-red-50 dark:bg-red-950/40" };
    case "restore":
      return { el: <RotateCcw className={`${cls} text-emerald-500`} />, bg: "bg-emerald-50 dark:bg-emerald-950/40" };
    case "rename":
      return { el: <Pencil className={`${cls} text-blue-500`} />, bg: "bg-blue-50 dark:bg-blue-950/40" };
    case "move":
      return { el: <FolderPlus className={`${cls} text-amber-500`} />, bg: "bg-amber-50 dark:bg-amber-950/40" };
    case "star":
    case "unstar":
      return { el: <Star className={`${cls} text-amber-500`} fill={type === "star" ? "currentColor" : "none"} />, bg: "bg-amber-50 dark:bg-amber-950/40" };
    case "pin":
    case "unpin":
      return { el: <Pin className={`${cls} text-blue-500`} fill={type === "pin" ? "currentColor" : "none"} />, bg: "bg-blue-50 dark:bg-blue-950/40" };
    case "share-enable":
    case "share-disable":
    case "share-link-create":
    case "share-link-revoke":
      return { el: <Share2 className={`${cls} text-emerald-500`} />, bg: "bg-emerald-50 dark:bg-emerald-950/40" };
    case "upload":
      return { el: <Upload className={`${cls} text-violet-500`} />, bg: "bg-violet-50 dark:bg-violet-950/40" };
    case "create-folder":
      return { el: <FolderPlus className={`${cls} text-zinc-500`} />, bg: "bg-zinc-100 dark:bg-zinc-800" };
    case "download":
      return { el: <Download className={`${cls} text-zinc-500`} />, bg: "bg-zinc-100 dark:bg-zinc-800" };
    case "tag-create":
    case "tag-update":
    case "tag-add":
      return { el: <Tag className={`${cls} text-violet-500`} />, bg: "bg-violet-50 dark:bg-violet-950/40" };
    case "tag-delete":
    case "tag-remove":
      return { el: <Tag className={`${cls} text-red-500`} />, bg: "bg-red-50 dark:bg-red-950/40" };
    default:
      return { el: <Pencil className={cls} />, bg: "bg-zinc-100" };
  }
}

function groupEntries(entries: ActivityEntry[]): Array<{ label: string; entries: ActivityEntry[] }> {
  const map = new Map<string, ActivityEntry[]>();
  for (const e of entries) {
    const label = groupLabel(e.timestamp);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(e);
  }
  return [...map.entries()].map(([label, items]) => ({ label, entries: items }));
}

function groupLabel(ts: number): string {
  const now = new Date();
  const d = new Date(ts);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startYesterday = startToday - 86400000;
  const startWeek = startToday - 6 * 86400000;

  if (ts >= startToday) return "Today";
  if (ts >= startYesterday) return "Yesterday";
  if (ts >= startWeek) return "This week";
  const weekAgo = startToday - 13 * 86400000;
  if (ts >= weekAgo) return "Last week";
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.round(diff / minute)}m ago`;
  if (diff < day) return `${Math.round(diff / hour)}h ago`;
  if (diff < 2 * day) return "Yesterday";
  if (diff < 7 * day) return `${Math.round(diff / day)}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
