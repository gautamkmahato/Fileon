"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FOLDER_MIME } from "@/lib/drive/drive";
import type { PickerConfig } from "@/lib/drive/access";
import { loadGooglePicker, openDrivePicker, type PickerHandle } from "@/lib/google/picker";
import type { PickedDoc } from "@/lib/types/google-types";
import { APP_NAME } from "@/lib/config/brand";

type GuidedPhase = "idle" | "loading" | "picking" | "paused" | "done";

export interface GuidedFolder {
  id: string;
  name: string;
}

export interface GuidedProgress {
  phase: GuidedPhase;
  /**
   * Folder the Picker is open in (picking) or was just closed in (paused);
   * null while at My Drive root.
   */
  current: GuidedFolder | null;
  /** Folders still to open. */
  queue: GuidedFolder[];
  foldersDone: number;
  filesGranted: number;
  foldersGranted: number;
  error: string | null;
}

const INITIAL: GuidedProgress = {
  phase: "idle",
  current: null,
  queue: [],
  foldersDone: 0,
  filesGranted: 0,
  foldersGranted: 0,
  error: null,
};

/**
 * Walks the user's Drive with chained Pickers so granting access takes the
 * fewest clicks:
 *
 *  1. Open the Picker at My Drive. The user presses Ctrl+A, then Select.
 *  2. Every picked folder joins a queue. The Picker reopens inside the next
 *     queued folder automatically. Ctrl+A, Select — subfolders picked there
 *     join the queue too, so the whole tree is covered without navigating.
 *  3. Closing a Picker skips that folder and pauses on our screen, where the
 *     user can continue to the next folder or stop and keep what was granted.
 *     (The Picker is a modal iframe, so our own buttons are unreachable
 *     while it is open; pausing is the only way to offer "stop".)
 */
export function useGuidedDriveAccess(opts: {
  token: string | null;
  config: PickerConfig | null;
  onGranted?: (docs: PickedDoc[]) => void;
}) {
  const { token, config, onGranted } = opts;
  const [progress, setProgress] = useState<GuidedProgress>(INITIAL);

  const queueRef = useRef<GuidedFolder[]>([]);
  const visitedRef = useRef(new Set<string>());
  const handleRef = useRef<PickerHandle | null>(null);
  const stoppedRef = useRef(false);
  const countsRef = useRef({ foldersDone: 0, filesGranted: 0, foldersGranted: 0 });
  const onGrantedRef = useRef(onGranted);
  onGrantedRef.current = onGranted;

  const sync = useCallback((patch: Partial<GuidedProgress>) => {
    setProgress((prev) => ({
      ...prev,
      ...countsRef.current,
      queue: [...queueRef.current],
      ...patch,
    }));
  }, []);

  const finish = useCallback(() => {
    handleRef.current = null;
    sync({ phase: "done", current: null });
  }, [sync]);

  // openAt and openNext call each other; the ref breaks the cycle.
  const openAtRef = useRef<(folder: GuidedFolder | null) => Promise<void>>(async () => {});

  /** Open the next queued folder, or finish when the queue is empty. */
  const openNext = useCallback(async () => {
    const next = queueRef.current.shift();
    if (!next) {
      finish();
      return;
    }
    // Let the previous Picker tear down before the next one mounts.
    await new Promise((r) => setTimeout(r, 0));
    void openAtRef.current(next);
  }, [finish]);

  const openAt = useCallback(async (folder: GuidedFolder | null) => {
    if (!token || !config || stoppedRef.current) return;

    const total = countsRef.current.foldersDone + (folder ? 1 : 0) + queueRef.current.length;
    const title = folder
      ? `Folder ${countsRef.current.foldersDone + 1} of ${total} · ${folder.name} — press Ctrl+A, then Select`
      : `Choose what ${APP_NAME} can see — press Ctrl+A to select everything, then Select`;

    sync({ phase: "picking", current: folder, error: null });

    let handle: PickerHandle;
    try {
      handle = openDrivePicker({
        token,
        apiKey: config.apiKey,
        appId: config.appId,
        parentId: folder?.id ?? null,
        title,
        hideNav: !!folder,
      });
    } catch (err) {
      sync({ phase: "idle", current: null, error: err instanceof Error ? err.message : "Could not open the Google Picker" });
      return;
    }
    handleRef.current = handle;

    const result = await handle.result;
    if (stoppedRef.current) return;

    if (result.action === "picked") {
      const granted: PickedDoc[] = [];
      for (const doc of result.docs) {
        if (visitedRef.current.has(doc.id)) continue;
        visitedRef.current.add(doc.id);
        granted.push(doc);
        if (doc.mimeType === FOLDER_MIME) {
          countsRef.current.foldersGranted += 1;
          queueRef.current.push({ id: doc.id, name: doc.name });
        } else {
          countsRef.current.filesGranted += 1;
        }
      }
      if (granted.length) onGrantedRef.current?.(granted);
    } else if (!folder) {
      // Closed the first Picker without picking: back to the intro.
      handleRef.current = null;
      sync({ phase: "idle", current: null });
      return;
    } else {
      // Closed the Picker inside a folder: skip it and pause so the user can
      // choose to continue or stop (our buttons are hidden while it is open).
      handleRef.current = null;
      countsRef.current.foldersDone += 1;
      if (queueRef.current.length === 0) {
        finish();
      } else {
        sync({ phase: "paused", current: folder });
      }
      return;
    }

    if (folder) countsRef.current.foldersDone += 1;
    void openNext();
  }, [token, config, sync, finish, openNext]);

  openAtRef.current = openAt;

  const start = useCallback(async () => {
    if (!token || !config) return;
    stoppedRef.current = false;
    queueRef.current = [];
    visitedRef.current = new Set();
    countsRef.current = { foldersDone: 0, filesGranted: 0, foldersGranted: 0 };
    sync({ phase: "loading", current: null, error: null });
    try {
      await loadGooglePicker();
    } catch (err) {
      sync({ phase: "idle", error: err instanceof Error ? err.message : "Could not load the Google Picker" });
      return;
    }
    void openAt(null);
  }, [token, config, sync, openAt]);

  /** Continue with the next queued folder after a pause. */
  const resume = useCallback(() => {
    if (stoppedRef.current) return;
    void openNext();
  }, [openNext]);

  /** End the walk, keep what has been granted. */
  const stop = useCallback(() => {
    stoppedRef.current = true;
    handleRef.current?.dispose();
    queueRef.current = [];
    finish();
  }, [finish]);

  const reset = useCallback(() => {
    stoppedRef.current = true;
    handleRef.current?.dispose();
    handleRef.current = null;
    queueRef.current = [];
    visitedRef.current = new Set();
    countsRef.current = { foldersDone: 0, filesGranted: 0, foldersGranted: 0 };
    setProgress(INITIAL);
  }, []);

  useEffect(() => () => {
    stoppedRef.current = true;
    handleRef.current?.dispose();
  }, []);

  return { progress, start, resume, stop, reset };
}
