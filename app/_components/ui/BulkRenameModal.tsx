"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { DriveFile } from "@/lib/drive/drive";
import { renameFile } from "@/lib/drive/drive";
import { useAuth } from "../auth/AuthProvider";
import { Modal } from "./Modal";
import {
  previewBulkRename,
  type BulkRenameConfig,
  type BulkRenameMode,
} from "@/lib/utils/bulk-rename";
import { toast, runAsync, updateLoading } from "@/lib/toast";

interface BulkRenameModalProps {
  open: boolean;
  files: DriveFile[];
  allNames: string[];
  onClose: () => void;
  onComplete: (updated: DriveFile[]) => void;
}

export function BulkRenameModal({
  open, files, allNames, onClose, onComplete,
}: BulkRenameModalProps) {
  const { token } = useAuth();
  const [mode, setMode] = useState<BulkRenameMode>("pattern");
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [pattern, setPattern] = useState("{original}");
  const [caseMode, setCaseMode] = useState<"lower" | "upper" | "title">("lower");
  const [seqStart, setSeqStart] = useState(1);
  const [seqPad, setSeqPad] = useState(0);
  const [seqPos, setSeqPos] = useState<"prefix" | "suffix">("suffix");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const config: BulkRenameConfig = useMemo(() => ({
    mode,
    find,
    replace,
    pattern,
    caseMode,
    sequenceStart: seqStart,
    sequencePad: seqPad,
    sequencePosition: seqPos,
    sequenceSeparator: "-",
  }), [mode, find, replace, pattern, caseMode, seqStart, seqPad, seqPos]);

  const existingNames = useMemo(
    () => new Set(allNames.map((n) => n.toLowerCase())),
    [allNames]
  );

  const previews = useMemo(
    () => previewBulkRename(files, config, existingNames),
    [files, config, existingNames]
  );

  const toApply = previews.filter((r) => r.newName !== r.file.name && !r.error);
  const hasErrors = previews.some((r) => r.error && r.newName !== r.file.name);

  async function handleApply() {
    if (!token || !toApply.length) return;
    setBusy(true);
    setProgress(0);
    const updated: DriveFile[] = [];
    const toastId = toast.loading(`Renaming 0 of ${toApply.length}…`);
    try {
      for (let i = 0; i < toApply.length; i++) {
        const row = toApply[i];
        updateLoading(`Renaming ${i + 1} of ${toApply.length}: ${row.file.name}`, toastId);
        const result = await renameFile(token, row.file.id, row.newName);
        updated.push(result);
        setProgress(i + 1);
      }
      toast.success(`Renamed ${updated.length} file${updated.length === 1 ? "" : "s"}`, { id: toastId });
      onComplete(updated);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Bulk rename failed", { id: toastId });
    } finally {
      setBusy(false);
    }
  }

  const tabs: Array<{ id: BulkRenameMode; label: string }> = [
    { id: "find-replace", label: "Find & replace" },
    { id: "pattern", label: "Pattern" },
    { id: "case", label: "Case" },
    { id: "sequence", label: "Sequence" },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Bulk rename (${files.length} files)`}
      width="max-w-2xl"
      footer={
        <>
          <button onClick={onClose} disabled={busy}
            className="text-sm font-medium px-4 py-2 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={busy || !toApply.length || hasErrors}
            className="text-sm font-medium px-4 py-2 rounded-lg btn-primary disabled:opacity-50 inline-flex items-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? `Renaming ${progress} of ${toApply.length}…` : `Apply (${toApply.length})`}
          </button>
        </>
      }
    >
      <div className="flex gap-1 mb-4 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              mode === t.id
                ? "bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-800 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800"
                : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === "find-replace" && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find"
            className="text-sm px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-zinc-100 w-full" />
          <input value={replace} onChange={(e) => setReplace(e.target.value)} placeholder="Replace with"
            className="text-sm px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-zinc-100 w-full" />
        </div>
      )}
      {mode === "pattern" && (
        <div className="mb-4">
          <input value={pattern} onChange={(e) => setPattern(e.target.value)}
            placeholder="Pattern e.g. Vacation-{index:02}{ext}"
            className="text-sm px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-zinc-100 w-full" />
          <p className="text-[11px] text-zinc-500 mt-1">
            Tokens: {"{index}"}, {"{index:03}"}, {"{date}"}, {"{ext}"}, {"{original}"}
          </p>
        </div>
      )}
      {mode === "case" && (
        <div className="flex gap-2 mb-4">
          {(["lower", "upper", "title"] as const).map((c) => (
            <button key={c} onClick={() => setCaseMode(c)}
              className={`text-xs px-3 py-1.5 rounded-lg border ${caseMode === c ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 dark:border-zinc-700"}`}>
              {c === "lower" ? "lowercase" : c === "upper" ? "UPPERCASE" : "Title Case"}
            </button>
          ))}
        </div>
      )}
      {mode === "sequence" && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <label className="text-xs text-zinc-500">Start
            <input type="number" value={seqStart} onChange={(e) => setSeqStart(Number(e.target.value))}
              className="text-sm px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 outline-none w-full mt-1" min={0} />
          </label>
          <label className="text-xs text-zinc-500">Zero pad
            <input type="number" value={seqPad} onChange={(e) => setSeqPad(Number(e.target.value))}
              className="text-sm px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 outline-none w-full mt-1" min={0} max={6} />
          </label>
          <label className="text-xs text-zinc-500">Position
            <select value={seqPos} onChange={(e) => setSeqPos(e.target.value as "prefix" | "suffix")}
              className="text-sm px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 outline-none w-full mt-1">
              <option value="suffix">Suffix</option>
              <option value="prefix">Prefix</option>
            </select>
          </label>
        </div>
      )}

      <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
        <div className="grid grid-cols-2 gap-px bg-zinc-200 dark:bg-zinc-700 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          <div className="bg-zinc-50 dark:bg-zinc-800 px-3 py-2">Current</div>
          <div className="bg-zinc-50 dark:bg-zinc-800 px-3 py-2">New name</div>
        </div>
        {previews.map((row) => (
          <div key={row.file.id} className="grid grid-cols-2 gap-px bg-zinc-100 dark:bg-zinc-800 text-sm">
            <div className="bg-white dark:bg-zinc-900 px-3 py-2 truncate text-zinc-600 dark:text-zinc-400">{row.file.name}</div>
            <div className={`bg-white dark:bg-zinc-900 px-3 py-2 truncate ${row.error ? "text-red-600" : row.newName !== row.file.name ? "text-zinc-900 dark:text-zinc-100 font-medium" : "text-zinc-400"}`}>
              {row.error || row.newName}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
