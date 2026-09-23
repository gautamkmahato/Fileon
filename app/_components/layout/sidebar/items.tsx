"use client";

import Link from "next/link";
import { ChevronRight, Folder } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DriveFile } from "@/lib/drive/drive";
import { driveRoutes } from "@/lib/navigation";
import { displayLabel } from "@/lib/sidebar-nav";

export function navRowClass(active: boolean, nested = false): string {
  return [
    "w-full flex items-center gap-2.5 py-1.5 rounded-lg text-[13px] transition-colors",
    nested ? "pl-9 pr-3" : "px-3",
    active
      ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900",
  ].join(" ");
}

export function NavLink({
  href, label, icon: Icon, active, nested,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  nested?: boolean;
}) {
  return (
    <Link href={href} className={navRowClass(active, nested)}>
      <Icon className="w-4 h-4 shrink-0" strokeWidth={active ? 2 : 1.75} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function NavButton({
  label, icon: Icon, active, nested, trailing, onClick, title,
}: {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  nested?: boolean;
  trailing?: "chevron";
  onClick: () => void;
  title?: string;
}) {
  return (
    <button type="button" title={title} onClick={onClick} className={navRowClass(!!active, nested)}>
      <Icon className="w-4 h-4 shrink-0" strokeWidth={active ? 2 : 1.75} />
      <span className="truncate flex-1 text-left">{label}</span>
      {trailing === "chevron" && (
        <ChevronRight className="w-3.5 h-3.5 text-zinc-400" strokeWidth={2} />
      )}
    </button>
  );
}

export function SectionHeader({
  label, count, actionIcon: ActionIcon, onAction,
}: {
  label: string;
  count?: number;
  actionIcon?: LucideIcon;
  onAction?: () => void;
}) {
  return (
    <div className="px-1 mb-1.5 flex items-center justify-between">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">
        {label}
        {count !== undefined && (
          <span className="text-zinc-300 dark:text-zinc-600 font-medium tabular-nums normal-case tracking-normal ml-1.5">
            · {count}
          </span>
        )}
      </h3>
      {ActionIcon && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="w-5 h-5 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center"
          aria-label={`${label} action`}
        >
          <ActionIcon className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="px-3 py-1 text-[11px] text-zinc-400">{children}</p>;
}

export function ShowMoreButton({
  expanded, total, onClick,
}: {
  expanded: boolean;
  total: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1 w-full text-left px-3 py-1 text-[11px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
    >
      {expanded ? "Show less" : `Show all (${total})`}
    </button>
  );
}

export function FolderRow({
  folder, active, onFolderDrop, dropTargetId, setDropTargetId,
}: {
  folder: DriveFile;
  active: boolean;
  onFolderDrop?: (e: React.DragEvent, folderId: string) => void;
  dropTargetId: string | null;
  setDropTargetId: (id: string | null) => void;
}) {
  if (!folder?.id) return null;
  const isDrop = dropTargetId === folder.id;
  return (
    <div
      className={`group w-full flex items-center gap-1.5 pr-3 py-1.5 rounded-lg text-[13px] transition-colors ${
        active
          ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
          : isDrop
          ? "bg-blue-50 dark:bg-blue-950/40 ring-2 ring-blue-400"
          : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
      }`}
      style={{ paddingLeft: 8 }}
      onDragOver={(e) => { e.preventDefault(); setDropTargetId(folder.id); }}
      onDragLeave={() => setDropTargetId(null)}
      onDrop={(e) => { setDropTargetId(null); onFolderDrop?.(e, folder.id); }}
    >
      <span className="shrink-0" />
      <Link href={driveRoutes.folder(folder.id)} className="flex items-center gap-2 min-w-0 flex-1">
        <Folder className="w-4 h-4 shrink-0 text-zinc-500" strokeWidth={1.75} />
        <span className="truncate">{displayLabel(folder.name, "Untitled folder")}</span>
      </Link>
    </div>
  );
}

export function CollapseToggle({
  collapsed, onClick,
}: {
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 border-t border-zinc-200 dark:border-zinc-800 text-xs"
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      {collapsed ? "»" : "«"}
    </button>
  );
}
