"use client";

import { CLEANUP_KIND_META, isCleanupKind } from "@/lib/cleanup/kinds";
import { useDriveBrowse } from "../drive/context/DriveBrowseProvider";
import { CleanupDashboard } from "./CleanupDashboard";
import { CleanupDetectorView } from "./CleanupDetectorView";

export function CleanupPageView() {
  const { cleanupKind } = useDriveBrowse();
  const kind = cleanupKind && isCleanupKind(cleanupKind) ? cleanupKind : "overview";

  if (kind === "overview") return <CleanupDashboard />;

  const meta = CLEANUP_KIND_META[kind];
  return <CleanupDetectorView kind={kind} meta={meta} />;
}
