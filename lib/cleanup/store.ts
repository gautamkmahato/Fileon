import { create } from "zustand";
import type { DriveFile } from "@/lib/drive/drive";
import { analyzeCleanup } from "@/lib/cleanup/analyze";
import type { CleanupAnalysis, CleanupScanContext } from "@/lib/cleanup/types";
import type { CleanupSyncStateRow } from "@/lib/db/schema";

export type CleanupScanStatus = "idle" | "loading" | "scanning" | "ready" | "error";

interface CleanupState {
  status: CleanupScanStatus;
  error: string | null;
  files: DriveFile[];
  filesById: Map<string, DriveFile>;
  analysis: CleanupAnalysis | null;
  truncated: boolean;
  scannedAt: number;
  listed: number;
  phase: "listing" | "shortcuts" | "folders" | "syncing" | null;
  brokenTargetIds: string[];
  verifiedEmptyFolderIds: string[];
  inaccessibleIds: string[];
  visibleIds: string[];
  generation: number;
  lastInboxIds: string[];
  lastTaggedIds: string[];
  hydratedUserId: string | null;
  sync: CleanupSyncStateRow | null;

  setVisibleIds: (ids: string[]) => void;
  setProgress: (listed: number, phase: CleanupState["phase"]) => void;
  beginLoad: (userId: string) => void;
  beginScan: () => number;
  hydrate: (opts: {
    userId: string;
    files: DriveFile[];
    analysis: CleanupAnalysis;
    truncated: boolean;
    scannedAt: number;
    extras: Pick<CleanupScanContext, "inboxIds" | "taggedIds">;
    probes?: {
      brokenTargetIds: string[];
      verifiedEmptyFolderIds: string[];
      inaccessibleIds: string[];
    };
    sync: CleanupSyncStateRow | null;
  }) => void;
  finishScan: (
    payload: {
      files: DriveFile[];
      truncated: boolean;
      brokenTargetIds: string[];
      verifiedEmptyFolderIds: string[];
      inaccessibleIds: string[];
    },
    extras: Pick<CleanupScanContext, "inboxIds" | "taggedIds">,
    generation: number,
    userId?: string | null,
    sync?: CleanupSyncStateRow | null,
  ) => void;
  failScan: (message: string, generation: number) => void;
  reanalyze: (extras: Pick<CleanupScanContext, "inboxIds" | "taggedIds">) => void;
  removeFile: (id: string) => void;
  updateFile: (file: DriveFile) => void;
  resetUser: () => void;
}

function toMap(files: DriveFile[]): Map<string, DriveFile> {
  return new Map(files.map((f) => [f.id, f]));
}

function contextFrom(
  state: Pick<CleanupState, "brokenTargetIds" | "verifiedEmptyFolderIds" | "inaccessibleIds" | "truncated">,
  extras: Pick<CleanupScanContext, "inboxIds" | "taggedIds">,
): CleanupScanContext {
  return {
    now: Date.now(),
    inboxIds: extras.inboxIds,
    taggedIds: extras.taggedIds,
    brokenTargetIds: new Set(state.brokenTargetIds),
    verifiedEmptyFolderIds: new Set(state.verifiedEmptyFolderIds),
    inaccessibleIds: new Set(state.inaccessibleIds),
    truncated: state.truncated,
  };
}

export const useCleanupStore = create<CleanupState>((set, get) => ({
  status: "idle",
  error: null,
  files: [],
  filesById: new Map(),
  analysis: null,
  truncated: false,
  scannedAt: 0,
  listed: 0,
  phase: null,
  brokenTargetIds: [],
  verifiedEmptyFolderIds: [],
  inaccessibleIds: [],
  visibleIds: [],
  generation: 0,
  lastInboxIds: [],
  lastTaggedIds: [],
  hydratedUserId: null,
  sync: null,

  setVisibleIds: (ids) => set({ visibleIds: ids }),

  setProgress: (listed, phase) => set({ listed, phase }),

  beginLoad: (userId) => set({
    status: get().hydratedUserId === userId && get().analysis ? "ready" : "loading",
    error: null,
    hydratedUserId: userId,
  }),

  beginScan: () => {
    const generation = get().generation + 1;
    set({
      status: "scanning",
      error: null,
      listed: 0,
      phase: "listing",
      generation,
    });
    return generation;
  },

  hydrate: (opts) => {
    const probes = opts.probes ?? {
      brokenTargetIds: [],
      verifiedEmptyFolderIds: [],
      inaccessibleIds: [],
    };
    set({
      status: "ready",
      error: null,
      files: opts.files,
      filesById: toMap(opts.files),
      analysis: opts.analysis,
      truncated: opts.truncated,
      scannedAt: opts.scannedAt,
      listed: opts.files.length,
      phase: null,
      ...probes,
      lastInboxIds: [...opts.extras.inboxIds],
      lastTaggedIds: [...opts.extras.taggedIds],
      hydratedUserId: opts.userId,
      sync: opts.sync,
    });
  },

  finishScan: (payload, extras, generation, userId, sync) => {
    if (get().generation !== generation) return;
    const next = {
      files: payload.files,
      filesById: toMap(payload.files),
      truncated: payload.truncated,
      brokenTargetIds: payload.brokenTargetIds,
      verifiedEmptyFolderIds: payload.verifiedEmptyFolderIds,
      inaccessibleIds: payload.inaccessibleIds,
      scannedAt: Date.now(),
      listed: payload.files.length,
      phase: null as CleanupState["phase"],
      status: "ready" as const,
      error: null,
    };
    set({
      ...next,
      lastInboxIds: [...extras.inboxIds],
      lastTaggedIds: [...extras.taggedIds],
      analysis: analyzeCleanup(payload.files, contextFrom(next, extras)),
      hydratedUserId: userId ?? get().hydratedUserId,
      sync: sync ?? get().sync,
    });
  },

  failScan: (message, generation) => {
    if (get().generation !== generation) return;
    const keep = get().analysis;
    set({
      status: keep ? "ready" : "error",
      error: keep ? null : message,
      phase: null,
    });
  },

  reanalyze: (extras) => {
    const state = get();
    if (!state.files.length) return;
    set({
      lastInboxIds: [...extras.inboxIds],
      lastTaggedIds: [...extras.taggedIds],
      analysis: analyzeCleanup(state.files, contextFrom(state, extras)),
    });
  },

  removeFile: (id) => {
    const state = get();
    const files = state.files.filter((f) => f.id !== id);
    const filesById = new Map(state.filesById);
    filesById.delete(id);
    const extras = {
      inboxIds: new Set(state.lastInboxIds),
      taggedIds: new Set(state.lastTaggedIds),
    };
    const next = { ...state, files, filesById };
    set({
      files,
      filesById,
      analysis: files.length ? analyzeCleanup(files, contextFrom(next, extras)) : state.analysis,
      visibleIds: state.visibleIds.filter((x) => x !== id),
    });
  },

  updateFile: (file) => {
    const state = get();
    if (!state.filesById.has(file.id)) return;
    const files = state.files.map((f) => (f.id === file.id ? { ...f, ...file } : f));
    const filesById = new Map(state.filesById);
    filesById.set(file.id, { ...filesById.get(file.id)!, ...file });
    const extras = {
      inboxIds: new Set(state.lastInboxIds),
      taggedIds: new Set(state.lastTaggedIds),
    };
    const next = { ...state, files, filesById };
    set({
      files,
      filesById,
      analysis: analyzeCleanup(files, contextFrom(next, extras)),
    });
  },

  resetUser: () => set({
    status: "idle",
    error: null,
    files: [],
    filesById: new Map(),
    analysis: null,
    truncated: false,
    scannedAt: 0,
    listed: 0,
    phase: null,
    visibleIds: [],
    hydratedUserId: null,
    sync: null,
  }),
}));
