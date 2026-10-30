"use client";

import type { DriveFile } from "@/lib/drive/drive";
import { humanFileSize, isFolder } from "@/lib/drive/drive";
import { getFileType } from "@/lib/types/file-types";
import { lastActivityMs } from "@/lib/cleanup/analyze";
import type { CleanupFinding, CleanupGroup } from "@/lib/cleanup/types";
import { driveActions } from "@/lib/drive/drive-actions-bridge";
import { useIsSelected, useSelectionStore } from "@/lib/stores";
import { useDriveBrowse } from "../drive/context/DriveBrowseProvider";

export function CleanupFindingsList({
  findings = [],
  groups = [],
  emptyLabel,
}: {
  findings?: CleanupFinding[];
  groups?: CleanupGroup[];
  emptyLabel: string;
}) {
  if (groups.length === 0 && findings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 px-4 py-10 text-center text-sm text-zinc-400">
        {emptyLabel}
      </div>
    );
  }

  if (groups.length > 0) {
    return (
      <div className="space-y-3">
        {groups.map((group) => (
          <div
            key={group.id}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden"
          >
            <div className="px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{group.label}</p>
                <p className="text-xs text-zinc-500 truncate">{group.reason}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {group.files.length > 1 && (
                  <button
                    type="button"
                    onClick={() => selectIds(group.files.slice(1).map((f) => f.id))}
                    className="text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    Select older
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => selectIds(group.files.map((f) => f.id))}
                  className="text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Select {group.files.length}
                </button>
              </div>
            </div>
            <ul>
              {group.files.map((file, index) => (
                <CleanupFileRow
                  key={file.id}
                  file={file}
                  reason={index === 0 ? "Newest in this set" : group.reason}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <ul>
        {findings.map((item) => (
          <CleanupFileRow key={item.file.id} file={item.file} reason={item.reason} />
        ))}
      </ul>
    </div>
  );
}

function selectIds(ids: string[]) {
  if (!ids.length) return;
  useSelectionStore.getState().setSelection(ids, ids[ids.length - 1] ?? null);
}

function CleanupFileRow({ file, reason }: { file: DriveFile; reason: string }) {
  const { openFile, openMenu } = useDriveBrowse();
  const selected = useIsSelected(file.id);
  const type = getFileType(file.mimeType);
  const Icon = type.icon;
  const last = lastActivityMs(file);

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => driveActions.handleItemSelect(file, e)}
        onDoubleClick={() => openFile(file)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openMenu(file, e.currentTarget as HTMLElement, e);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            openFile(file);
          }
        }}
        className={`grid grid-cols-[1fr_minmax(0,220px)_88px] sm:grid-cols-[1fr_minmax(0,280px)_100px_88px] gap-3 items-center px-4 py-2.5 cursor-pointer border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 ${
          selected ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <input
            type="checkbox"
            checked={selected}
            readOnly
            className="w-4 h-4 rounded border-zinc-300 text-blue-600 shrink-0 pointer-events-none"
          />
          <div className={`w-8 h-8 rounded-lg ${type.rowBg} flex items-center justify-center shrink-0`}>
            <Icon className={`w-4 h-4 ${type.rowTint}`} strokeWidth={2.5} />
          </div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate" title={file.name}>
            {file.name}
          </p>
        </div>
        <p className="text-xs text-zinc-500 truncate hidden sm:block" title={reason}>
          {reason}
        </p>
        <span className="text-xs text-zinc-500 tabular-nums hidden sm:block">
          {formatActivity(last)}
        </span>
        <span className="text-xs text-zinc-500 tabular-nums text-right">
          {isFolder(file) ? "—" : humanFileSize(file.size)}
        </span>
      </div>
    </li>
  );
}

function formatActivity(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

