"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { scanDriveForCleanup } from "@/lib/cleanup/scan";
import { useCleanupStore } from "@/lib/cleanup/store";
import { useFilesStore } from "@/lib/stores/files-store";
import { useInbox } from "@/app/_components/inbox/InboxProvider";
import { useTags } from "@/app/_components/tags/TagsProvider";
import { useAuth } from "@/app/_components/auth/AuthProvider";
import { flagsFromRows } from "@/lib/cleanup/rows";
import {
  applyIncrementalChanges,
  loadCleanupSnapshot,
  persistFullIndex,
  persistReanalyze,
  recordScanFailure,
  shouldIncrementalSync,
  type CleanupSnapshot,
} from "@/lib/cleanup/repository";
import { listDriveChanges } from "@/lib/drive/drive";
import { tenantId } from "@/lib/db/sanitize";
import { isMemoryOnly } from "@/lib/db/engine";

export function useCleanupScan() {
  const { token, profile } = useAuth();
  const userId = tenantId(profile);
  const { inboxIds } = useInbox();
  const { tagsByFileId } = useTags();
  const inflight = useRef(false);
  const skipPersist = useRef(true);
  const extrasRef = useRef({ inboxIds, taggedIds: new Set(tagsByFileId.keys()) });

  const extras = useMemo(
    () => ({
      inboxIds,
      taggedIds: new Set(tagsByFileId.keys()),
    }),
    [inboxIds, tagsByFileId],
  );
  extrasRef.current = extras;

  const status = useCleanupStore((s) => s.status);
  const error = useCleanupStore((s) => s.error);
  const analysis = useCleanupStore((s) => s.analysis);
  const files = useCleanupStore((s) => s.files);
  const truncated = useCleanupStore((s) => s.truncated);
  const listed = useCleanupStore((s) => s.listed);
  const phase = useCleanupStore((s) => s.phase);
  const scannedAt = useCleanupStore((s) => s.scannedAt);
  const sync = useCleanupStore((s) => s.sync);

  const applySnapshot = useCallback((snap: CleanupSnapshot, uid: string) => {
    const probes = flagsFromRows(snap.rows);
    useCleanupStore.getState().hydrate({
      userId: uid,
      files: snap.files,
      analysis: snap.analysis,
      truncated: snap.truncated,
      scannedAt: Date.parse(snap.scan.finished_at ?? snap.scan.started_at) || Date.now(),
      extras: extrasRef.current,
      probes: {
        brokenTargetIds: [...probes.brokenTargetIds],
        verifiedEmptyFolderIds: [...probes.verifiedEmptyFolderIds],
        inaccessibleIds: [...probes.inaccessibleIds],
      },
      sync: snap.sync,
    });
    useFilesStore.getState().setFiles(snap.files, undefined);
  }, []);

  const runFullScan = useCallback(async () => {
    if (!token || !userId || inflight.current) return;
    inflight.current = true;
    const generation = useCleanupStore.getState().beginScan();
    try {
      const payload = await scanDriveForCleanup({
        token,
        onProgress: (p) => {
          if (useCleanupStore.getState().generation !== generation) return;
          useCleanupStore.getState().setProgress(p.listed, p.phase);
        },
      });
      let nextSync = useCleanupStore.getState().sync;
      try {
        const snap = await persistFullIndex({
          userId,
          files: payload.files,
          truncated: payload.truncated,
          drivePageToken: payload.drivePageToken,
          kind: "full",
          extras: extrasRef.current,
          flags: {
            brokenTargetIds: new Set(payload.brokenTargetIds),
            verifiedEmptyFolderIds: new Set(payload.verifiedEmptyFolderIds),
            inaccessibleIds: new Set(payload.inaccessibleIds),
          },
        });
        nextSync = snap.sync;
      } catch {
        /* private mode / quota — keep results in memory */
      }
      useCleanupStore.getState().finishScan(payload, extrasRef.current, generation, userId, nextSync);
      useFilesStore.getState().setFiles(payload.files, undefined);
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Couldn't scan Drive";
      try { await recordScanFailure(userId, "full", message); } catch { /* ignore */ }
      useCleanupStore.getState().failScan(message, generation);
    } finally {
      inflight.current = false;
    }
  }, [token, userId]);

  const runIncremental = useCallback(async () => {
    if (!token || !userId || inflight.current) return;
    const pageToken = useCleanupStore.getState().sync?.drive_start_page_token;
    if (!pageToken) return;
    inflight.current = true;
    useCleanupStore.getState().setProgress(useCleanupStore.getState().listed, "syncing");
    try {
      const result = await listDriveChanges({ token, pageToken });
      if (result.invalidToken) {
        inflight.current = false;
        await runFullScan();
        return;
      }
      const removedIds = result.changes.filter((c) => c.removed).map((c) => c.fileId);
      const upserts = result.changes
        .filter((c) => !c.removed && c.file && !c.file.trashed)
        .map((c) => c.file!);
      if (removedIds.length || upserts.length || result.newStartPageToken) {
        const snap = await applyIncrementalChanges({
          userId,
          extras: extrasRef.current,
          upserts,
          removedIds,
          drivePageToken: result.newStartPageToken ?? pageToken,
        });
        applySnapshot(snap, userId);
      } else {
        useCleanupStore.getState().setProgress(useCleanupStore.getState().listed, null);
      }
    } catch {
      useCleanupStore.getState().setProgress(useCleanupStore.getState().listed, null);
    } finally {
      inflight.current = false;
    }
  }, [token, userId, applySnapshot, runFullScan]);

  useEffect(() => {
    if (!userId) return;

    const prevUser = useCleanupStore.getState().hydratedUserId;
    if (prevUser && prevUser !== userId) {
      useCleanupStore.getState().resetUser();
      skipPersist.current = true;
    }

    let cancelled = false;

    async function boot() {
      if (!userId) return;
      const state = useCleanupStore.getState();
      if (state.hydratedUserId === userId && state.analysis) {
        if (shouldIncrementalSync(state.sync)) void runIncremental();
        return;
      }
      state.beginLoad(userId);
      try {
        const snap = await loadCleanupSnapshot(userId, extrasRef.current);
        if (cancelled) return;
        if (snap) {
          applySnapshot(snap, userId);
          if (shouldIncrementalSync(snap.sync)) void runIncremental();
          return;
        }
      } catch {
        /* IndexedDB missing — scan Drive */
      }
      if (!cancelled) await runFullScan();
    }

    void boot();
    return () => { cancelled = true; };
  }, [userId, applySnapshot, runFullScan, runIncremental]);

  useEffect(() => {
    if (status !== "ready" || !userId) return;
    useCleanupStore.getState().reanalyze(extras);
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    void persistReanalyze(userId, extras).catch(() => {});
  }, [extras, status, userId]);

  return {
    status,
    error,
    analysis,
    files,
    truncated,
    listed,
    phase,
    scannedAt,
    sync,
    memoryOnly: isMemoryOnly(),
    refresh: () => runFullScan(),
  };
}
