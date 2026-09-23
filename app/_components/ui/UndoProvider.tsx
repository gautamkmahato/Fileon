"use client";

import { useEffect } from "react";
import { toast as sonner } from "sonner";
import {
  executeUndo,
  registerUndoToastHandler,
  setEntryToastId,
  UNDO_TOAST_MS,
  type UndoEntry,
} from "@/lib/undo";
import { UndoToastCard } from "./UndoToast";

export function UndoProvider() {
  useEffect(() => {
    registerUndoToastHandler((entry: UndoEntry) => {
      const toastId = sonner.custom(
        (id) => (
          <UndoToastCard
            toastId={id}
            message={entry.message}
            entryId={entry.id}
            onUndo={async (entryId) => {
              sonner.dismiss(id);
              await executeUndo(entryId);
            }}
          />
        ),
        { duration: UNDO_TOAST_MS, id: `undo-toast-${entry.id}` }
      );
      setEntryToastId(entry.id, toastId);
    });
    return () => registerUndoToastHandler(() => {});
  }, []);

  return null;
}
