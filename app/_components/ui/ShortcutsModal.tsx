"use client";

import { useEffect } from "react";
import { Modal } from "./Modal";

interface ShortcutGroup {
  title: string;
  items: Array<{ keys: string[]; description: string }>;
}

const SHORTCUTS: ShortcutGroup[] = [
  {
    title: "Navigation",
    items: [
      { keys: ["⌘", "K"], description: "Open command palette" },
      { keys: ["Esc"], description: "Cancel cut/copy · close modal · deselect" },
      { keys: ["?"], description: "Show keyboard shortcuts" },
    ],
  },
  {
    title: "Selection",
    items: [
      { keys: ["Click"], description: "Select item" },
      { keys: ["⌘", "Click"], description: "Toggle selection" },
      { keys: ["Shift", "Click"], description: "Range select" },
      { keys: ["⌘", "A"], description: "Select all visible" },
    ],
  },
  {
    title: "Actions",
    items: [
      { keys: ["Space"], description: "Quick Look preview (1 file selected)" },
      { keys: ["⌘", "X"], description: "Cut selected files" },
      { keys: ["⌘", "C"], description: "Copy selected files" },
      { keys: ["⌘", "V"], description: "Paste into current folder" },
      { keys: ["P"], description: "Pin / unpin selected items (shows on Dashboard)" },
      { keys: ["⌘", "Z"], description: "Undo last action (30s window)" },
      { keys: ["Enter"], description: "Open selected file (command palette)" },
      { keys: ["Double-click"], description: "Open file or folder" },
    ],
  },
  {
    title: "Quick Look",
    items: [
      { keys: ["←", "→"], description: "Previous / next file" },
      { keys: ["Space", "Esc"], description: "Close preview" },
    ],
  },
  {
    title: "View",
    items: [
      { keys: ["⌘", "K", "→", "view"], description: "Toggle grid / list view" },
    ],
  },
];

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" width="max-w-lg">
      <div className="space-y-6">
        {SHORTCUTS.map((group) => (
          <div key={group.title}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              {group.title}
            </h3>
            <div className="space-y-2">
              {group.items.map((item) => (
                <div key={item.description} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">{item.description}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {item.keys.map((k, i) => (
                      <kbd
                        key={i}
                        className="text-xs px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-mono"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || (el as HTMLElement).isContentEditable;
}
