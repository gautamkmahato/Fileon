"use client";

import { createContext, useContext } from "react";
import type { DriveBrowseContextValue } from "./drive-browse-types";
import { useDriveBrowseLogic } from "./useDriveBrowseLogic";

const DriveBrowseContext = createContext<DriveBrowseContextValue | null>(null);

export function DriveBrowseProvider({ children }: { children: React.ReactNode }) {
  const value = useDriveBrowseLogic();
  return (
    <DriveBrowseContext.Provider value={value as DriveBrowseContextValue}>
      {children}
    </DriveBrowseContext.Provider>
  );
}

export function useDriveBrowse(): DriveBrowseContextValue {
  const ctx = useContext(DriveBrowseContext);
  if (!ctx) throw new Error("useDriveBrowse must be used inside DriveBrowseProvider");
  return ctx;
}
