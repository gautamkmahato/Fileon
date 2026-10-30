"use client";

import { Command, Keyboard, PanelLeft } from "lucide-react";
import { useDriveBrowse } from "../context/DriveBrowseProvider";

export function ControlsPageView() {
  const {
    setShortcutsOpen,
    setPaletteOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
  } = useDriveBrowse();

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Controls</h1>

      <div className="space-y-3">
        <ControlRow
          icon={Keyboard}
          title="Keyboard shortcuts"
          description="View all shortcuts for navigation, selection, and actions."
          hint="?"
          onClick={() => setShortcutsOpen(true)}
        />
        <ControlRow
          icon={Command}
          title="Command palette"
          description="Search files, folders, and run actions from anywhere."
          hint="⌘K"
          onClick={() => setPaletteOpen(true)}
        />
        <ControlRow
          icon={PanelLeft}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          description="Toggle the left navigation panel."
          onClick={() => setSidebarCollapsed((c) => !c)}
        />
      </div>

      <p className="mt-6 text-xs text-zinc-500">
        Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-[11px]">?</kbd> anytime to open keyboard shortcuts.
      </p>
    </div>
  );
}

function ControlRow({
  icon: Icon,
  title,
  description,
  hint,
  onClick,
}: {
  icon: typeof Keyboard;
  title: string;
  description: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-start gap-3 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition-colors"
    >
      <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-zinc-600 dark:text-zinc-300" strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
          {hint && (
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-[10px] text-zinc-500">
              {hint}
            </kbd>
          )}
        </div>
        <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
      </div>
    </button>
  );
}
