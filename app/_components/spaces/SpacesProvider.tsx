"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import { useAuth } from "../auth/AuthProvider";
import { tenantId } from "@/lib/db/sanitize";
import {
  createSpace as createSpaceRow,
  deleteSpace as deleteSpaceRow,
  listSpaces,
  subscribeSpaces,
  updateSpace as updateSpaceRow,
  type SmartSpace,
  type SpaceDraft,
} from "@/lib/spaces";

interface SpacesContextValue {
  userId: string | null;
  spaces: SmartSpace[];
  loading: boolean;
  refresh: () => Promise<void>;
  createSpace: (draft: SpaceDraft) => Promise<SmartSpace>;
  updateSpace: (id: string, patch: Partial<SpaceDraft>) => Promise<SmartSpace | null>;
  deleteSpace: (id: string) => Promise<boolean>;
  editorOpen: boolean;
  editorSpace: SmartSpace | null;
  openCreate: () => void;
  openEdit: (space: SmartSpace) => void;
  closeEditor: () => void;
  queryWarnings: string[];
  setQueryWarnings: (warnings: string[]) => void;
}

const SpacesContext = createContext<SpacesContextValue | null>(null);

export function SpacesProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const userId = tenantId(profile);
  const [spaces, setSpaces] = useState<SmartSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSpace, setEditorSpace] = useState<SmartSpace | null>(null);
  const [queryWarnings, setQueryWarnings] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    if (!userId) {
      setSpaces([]);
      setLoading(false);
      return;
    }
    try {
      const rows = await listSpaces(userId);
      setSpaces(rows);
    } catch (err) {
      console.error(err);
      setSpaces([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    void refresh();
    return subscribeSpaces(() => { void refresh(); });
  }, [refresh]);

  const createSpace = useCallback(async (draft: SpaceDraft) => {
    if (!userId) throw new Error("Sign in to create a Smart Space");
    return createSpaceRow(userId, draft);
  }, [userId]);

  const updateSpace = useCallback(async (id: string, patch: Partial<SpaceDraft>) => {
    if (!userId) return null;
    return updateSpaceRow(userId, id, patch);
  }, [userId]);

  const deleteSpace = useCallback(async (id: string) => {
    if (!userId) return false;
    return deleteSpaceRow(userId, id);
  }, [userId]);

  const openCreate = useCallback(() => {
    setEditorSpace(null);
    setEditorOpen(true);
  }, []);

  const openEdit = useCallback((space: SmartSpace) => {
    setEditorSpace(space);
    setEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setEditorSpace(null);
  }, []);

  const value = useMemo(
    () => ({
      userId,
      spaces,
      loading,
      refresh,
      createSpace,
      updateSpace,
      deleteSpace,
      editorOpen,
      editorSpace,
      openCreate,
      openEdit,
      closeEditor,
      queryWarnings,
      setQueryWarnings,
    }),
    [
      userId, spaces, loading, refresh, createSpace, updateSpace, deleteSpace,
      editorOpen, editorSpace, openCreate, openEdit, closeEditor, queryWarnings,
    ],
  );

  return <SpacesContext.Provider value={value}>{children}</SpacesContext.Provider>;
}

export function useSpaces() {
  const ctx = useContext(SpacesContext);
  if (!ctx) throw new Error("useSpaces must be used inside SpacesProvider");
  return ctx;
}
