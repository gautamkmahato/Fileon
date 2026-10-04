"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FOLDER_MIME } from "@/lib/drive/drive";
import type { PickerConfig } from "@/lib/drive/access";
import { loadGooglePicker, openDrivePicker, type PickerHandle, type PickerViewSpec } from "@/lib/google/picker";
import type { PickedDoc } from "@/lib/types/google-types";

type GuidedPhase = "idle" | "loading" | "picking" | "paused" | "done";

interface GuidedStep {
  id: string;
  label: string;
  view: PickerViewSpec;
}

export interface GuidedProgress {
  phase: GuidedPhase;
  /** List the Picker is open on, or the one just skipped. */
  current: GuidedStep | null;
  /** Lists still to open, not counting the current one. */
  queue: GuidedStep[];
  stepsDone: number;
  filesGranted: number;
  foldersGranted: number;
  /**
   * Granted files whose parent folder was not granted, so they cannot be
   * shown inside that folder. They still appear in type views and search.
   */
  unplacedFiles: number;
  error: string | null;
}

const INITIAL: GuidedProgress = {
  phase: "idle",
  current: null,
  queue: [],
  stepsDone: 0,
  filesGranted: 0,
  foldersGranted: 0,
  unplacedFiles: 0,
  error: null,
};

/**
 * Types the flat Picker views do not cover. Office uploads are included because
 * the Documents/Spreadsheets/Presentations views sometimes list only native
 * Google files.
 */
const OTHER_MIME = [
  "audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "audio/webm", "audio/aac", "audio/flac",
  "application/zip", "application/x-zip-compressed", "application/x-rar-compressed",
  "application/vnd.rar", "application/x-7z-compressed", "application/gzip", "application/x-tar",
  "text/plain", "text/csv", "text/html", "text/markdown", "application/json", "application/xml",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.google-apps.shortcut",
  "application/vnd.google-apps.site",
].join(",");

/** One Ctrl+A per list, however many folders the Drive has. */
const GRANT_STEPS: GuidedStep[] = [
  // ViewId.FOLDERS renders "No folders" for My Drive. A mime filter is the flat list.
  { id: "folders", label: "Folders", view: { mimeTypes: FOLDER_MIME, selectFolders: true } },
  { id: "photos", label: "Photos", view: { viewId: "DOCS_IMAGES" } },
  { id: "videos", label: "Videos", view: { viewId: "DOCS_VIDEOS" } },
  { id: "documents", label: "Documents", view: { viewId: "DOCUMENTS" } },
  { id: "spreadsheets", label: "Spreadsheets", view: { viewId: "SPREADSHEETS" } },
  { id: "presentations", label: "Presentations", view: { viewId: "PRESENTATIONS" } },
  { id: "pdfs", label: "PDFs", view: { viewId: "PDFS" } },
  { id: "forms", label: "Forms", view: { viewId: "FORMS" } },
  { id: "drawings", label: "Drawings", view: { viewId: "DRAWINGS" } },
  { id: "other", label: "Other files", view: { mimeTypes: OTHER_MIME } },
];

/** setFileIds takes a comma-separated string; keep each picker URL small. */
const FILE_ID_CHUNK = 40;
/** Folder, its parent, grandparent, then one spare. */
const MAX_PARENT_ROUNDS = 4;

const selectAllKeys = () =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘A" : "Ctrl+A";

/**
 * Grants Drive access in a handful of flat lists instead of one picker per
 * folder. Google's Picker is a cross-origin window, so each list still needs
 * the user to press Ctrl+A and Select; the next list opens on its own.
 *
 * Files remember their parent id. Parents that were never selected are opened
 * afterwards via setFileIds, a few levels up, so the folder tree still resolves.
 */
export function useGuidedDriveAccess(opts: {
  token: string | null;
  config: PickerConfig | null;
  onGranted?: (docs: PickedDoc[]) => void;
}) {
  const { token, config, onGranted } = opts;
  const [progress, setProgress] = useState<GuidedProgress>(INITIAL);

  const stepsRef = useRef<GuidedStep[]>([]);
  const indexRef = useRef(0);
  const seenRef = useRef(new Set<string>());
  const folderIdsRef = useRef(new Set<string>());
  const fileParentsRef = useRef(new Map<string, string>());
  const folderParentsRef = useRef(new Map<string, string>());
  const attemptedParentsRef = useRef(new Set<string>());
  const parentRoundsRef = useRef(0);
  const handleRef = useRef<PickerHandle | null>(null);
  const stoppedRef = useRef(false);
  const phaseRef = useRef<GuidedPhase>("idle");
  const countsRef = useRef({ stepsDone: 0, filesGranted: 0, foldersGranted: 0 });
  const onGrantedRef = useRef(onGranted);
  onGrantedRef.current = onGranted;

  const unplaced = useCallback(() => {
    let n = 0;
    for (const parentId of fileParentsRef.current.values()) {
      if (parentId && parentId !== "root" && !folderIdsRef.current.has(parentId)) n += 1;
    }
    return n;
  }, []);

  const sync = useCallback((patch: Partial<GuidedProgress>) => {
    const index = indexRef.current;
    const steps = stepsRef.current;
    setProgress({
      phase: "picking",
      current: steps[index] ?? null,
      queue: steps.slice(index + 1),
      ...countsRef.current,
      unplacedFiles: unplaced(),
      error: null,
      ...patch,
    });
  }, [unplaced]);

  const finish = useCallback(() => {
    handleRef.current = null;
    indexRef.current = stepsRef.current.length;
    phaseRef.current = "done";
    sync({ phase: "done", current: null, queue: [] });
  }, [sync]);

  const absorb = useCallback((docs: PickedDoc[], treatAsFolders: boolean) => {
    const granted: PickedDoc[] = [];
    for (const doc of docs) {
      if (!doc.id || seenRef.current.has(doc.id)) continue;
      seenRef.current.add(doc.id);
      granted.push(doc);
      const asFolder = doc.mimeType === FOLDER_MIME || (treatAsFolders && !doc.mimeType);
      if (asFolder) {
        folderIdsRef.current.add(doc.id);
        countsRef.current.foldersGranted += 1;
        if (doc.parentId) folderParentsRef.current.set(doc.id, doc.parentId);
      } else {
        countsRef.current.filesGranted += 1;
        if (doc.parentId) fileParentsRef.current.set(doc.id, doc.parentId);
      }
    }
    if (granted.length) onGrantedRef.current?.(granted);
  }, []);

  /** Queue pickers for parent folders the file lists revealed but nobody selected. */
  const queueMissingParents = useCallback((): boolean => {
    if (parentRoundsRef.current >= MAX_PARENT_ROUNDS) return false;
    const missing: string[] = [];
    const consider = (parentId: string | undefined) => {
      if (!parentId || parentId === "root") return;
      if (folderIdsRef.current.has(parentId) || attemptedParentsRef.current.has(parentId)) return;
      if (missing.includes(parentId)) return;
      missing.push(parentId);
    };
    for (const parentId of fileParentsRef.current.values()) consider(parentId);
    for (const parentId of folderParentsRef.current.values()) consider(parentId);
    if (missing.length === 0) return false;

    parentRoundsRef.current += 1;
    const round = parentRoundsRef.current;
    for (let i = 0; i < missing.length; i += FILE_ID_CHUNK) {
      const chunk = missing.slice(i, i + FILE_ID_CHUNK);
      for (const id of chunk) attemptedParentsRef.current.add(id);
      const part = Math.floor(i / FILE_ID_CHUNK) + 1;
      const parts = Math.ceil(missing.length / FILE_ID_CHUNK);
      stepsRef.current.push({
        id: `parents-${round}-${part}`,
        label: parts > 1 ? `Folders your files are in (${part}/${parts})` : "Folders your files are in",
        view: { fileIds: chunk.join(","), selectFolders: true },
      });
    }
    return true;
  }, []);

  const openAtRef = useRef<(index: number) => Promise<void>>(async () => {});

  const openAt = useCallback(async (index: number) => {
    if (!token || !config || stoppedRef.current) return;

    if (index >= stepsRef.current.length) {
      if (!queueMissingParents()) {
        finish();
        return;
      }
    }
    const step = stepsRef.current[index];
    if (!step) {
      finish();
      return;
    }
    indexRef.current = index;
    phaseRef.current = "picking";

    const total = stepsRef.current.length;
    const title = `${step.label} (${index + 1}/${total}) — scroll down, press ${selectAllKeys()}, then Select`;
    sync({ phase: "picking", error: null });

    let handle: PickerHandle;
    try {
      handle = openDrivePicker({
        token,
        apiKey: config.apiKey,
        appId: config.appId,
        title,
        view: step.view,
        hideNav: true,
      });
    } catch (err) {
      sync({
        phase: "idle",
        current: null,
        error: err instanceof Error ? err.message : "Could not open the Google Picker",
      });
      return;
    }
    handleRef.current = handle;

    const result = await handle.result;
    if (stoppedRef.current || indexRef.current !== index) return;

    if (result.action === "picked") {
      absorb(result.docs, !!step.view.selectFolders);
      countsRef.current.stepsDone += 1;
      void openAtRef.current(index + 1);
      return;
    }

    handleRef.current = null;
    const nothingGranted = countsRef.current.filesGranted + countsRef.current.foldersGranted === 0;
    if (index === 0 && nothingGranted) {
      phaseRef.current = "idle";
      sync({ phase: "idle", current: null });
      return;
    }
    // Closed the window: stay here so the user can retry this list or skip it.
    phaseRef.current = "paused";
    sync({ phase: "paused" });
  }, [token, config, sync, finish, absorb, queueMissingParents]);

  openAtRef.current = openAt;

  const start = useCallback(async () => {
    if (!token || !config) return;
    stoppedRef.current = false;
    stepsRef.current = [...GRANT_STEPS];
    indexRef.current = 0;
    seenRef.current = new Set();
    folderIdsRef.current = new Set();
    fileParentsRef.current = new Map();
    folderParentsRef.current = new Map();
    attemptedParentsRef.current = new Set();
    parentRoundsRef.current = 0;
    countsRef.current = { stepsDone: 0, filesGranted: 0, foldersGranted: 0 };
    phaseRef.current = "loading";
    sync({ phase: "loading", current: null, queue: GRANT_STEPS.slice(1), error: null });
    try {
      await loadGooglePicker();
    } catch (err) {
      sync({ phase: "idle", error: err instanceof Error ? err.message : "Could not load the Google Picker" });
      return;
    }
    void openAt(0);
  }, [token, config, sync, openAt]);

  /** Open only the parent folders that selected files still point at. */
  const addMissingFolders = useCallback(async () => {
    if (!token || !config) return;
    stoppedRef.current = false;
    for (const parentId of fileParentsRef.current.values()) attemptedParentsRef.current.delete(parentId);
    for (const parentId of folderParentsRef.current.values()) attemptedParentsRef.current.delete(parentId);
    parentRoundsRef.current = 0;
    const index = stepsRef.current.length;
    if (!queueMissingParents()) return;
    try {
      await loadGooglePicker();
    } catch (err) {
      sync({ phase: "done", error: err instanceof Error ? err.message : "Could not load the Google Picker" });
      return;
    }
    void openAt(index);
  }, [token, config, queueMissingParents, openAt, sync]);

  /** Skip the list that was just closed. */
  const resume = useCallback(() => {
    if (stoppedRef.current || phaseRef.current !== "paused") return;
    phaseRef.current = "picking";
    countsRef.current.stepsDone += 1;
    void openAt(indexRef.current + 1);
  }, [openAt]);

  /** Reopen the list that was just closed, for a list that had not finished loading. */
  const retry = useCallback(() => {
    if (stoppedRef.current || phaseRef.current !== "paused") return;
    phaseRef.current = "picking";
    void openAt(indexRef.current);
  }, [openAt]);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    handleRef.current?.dispose();
    finish();
  }, [finish]);

  const reset = useCallback(() => {
    stoppedRef.current = true;
    handleRef.current?.dispose();
    handleRef.current = null;
    stepsRef.current = [];
    indexRef.current = 0;
    seenRef.current = new Set();
    folderIdsRef.current = new Set();
    fileParentsRef.current = new Map();
    folderParentsRef.current = new Map();
    attemptedParentsRef.current = new Set();
    parentRoundsRef.current = 0;
    countsRef.current = { stepsDone: 0, filesGranted: 0, foldersGranted: 0 };
    phaseRef.current = "idle";
    setProgress(INITIAL);
  }, []);

  useEffect(() => () => {
    stoppedRef.current = true;
    handleRef.current?.dispose();
  }, []);

  return { progress, start, resume, retry, stop, reset, addMissingFolders };
}
