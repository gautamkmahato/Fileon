import { toast as sonner } from "sonner";

export type UndoActionType = "trash" | "rename" | "move";

export interface UndoEntry {
  id: string;
  type: UndoActionType;
  message: string;
  createdAt: number;
  expiresAt: number;
  undo: () => Promise<void>;
  toastId?: string | number;
  activityId?: string;
}

export const UNDO_WINDOW_MS = 30_000;
export const UNDO_TOAST_MS = 10_000;

let stack: UndoEntry[] = [];
let idCounter = 0;
type ToastHandler = (entry: UndoEntry) => void;
let toastHandler: ToastHandler | null = null;

function purgeExpired() {
  const now = Date.now();
  stack = stack.filter((e) => e.expiresAt > now);
}

function removeEntry(id: string): UndoEntry | undefined {
  purgeExpired();
  const idx = stack.findIndex((e) => e.id === id);
  if (idx === -1) return undefined;
  const [entry] = stack.splice(idx, 1);
  return entry;
}

function popEntry(): UndoEntry | undefined {
  purgeExpired();
  return stack.pop();
}

export function registerUndoToastHandler(handler: ToastHandler) {
  toastHandler = handler;
}

/** Push a reversible action onto the session undo stack and show the undo toast. */
export function pushUndo(opts: {
  type: UndoActionType;
  message: string;
  undo: () => Promise<void>;
  activityId?: string;
}): string {
  purgeExpired();
  const entry: UndoEntry = {
    id: `undo-${++idCounter}`,
    type: opts.type,
    message: opts.message,
    createdAt: Date.now(),
    expiresAt: Date.now() + UNDO_WINDOW_MS,
    undo: opts.undo,
    activityId: opts.activityId,
  };
  stack.push(entry);
  toastHandler?.(entry);
  return entry.id;
}

export function canUndo(): boolean {
  purgeExpired();
  return stack.length > 0;
}

export function setEntryToastId(entryId: string, toastId: string | number) {
  const entry = stack.find((e) => e.id === entryId);
  if (entry) entry.toastId = toastId;
}

/** Undo a specific entry (toast button) or the most recent if no id given (Cmd+Z). */
export async function executeUndo(entryId?: string): Promise<boolean> {
  const entry = entryId ? removeEntry(entryId) : popEntry();
  if (!entry) return false;

  if (entry.toastId) sonner.dismiss(entry.toastId);

  const loadingId = sonner.loading("Undoing…");
  try {
    await entry.undo();
    if (entry.activityId) {
      const { markUndone } = await import("./activity-log");
      await markUndone(entry.activityId);
    }
    sonner.success("Undone", { id: loadingId, duration: 3000 });
    return true;
  } catch (err) {
    console.error(err);
    sonner.error("Undo failed", { id: loadingId });
    stack.push(entry);
    return false;
  }
}
