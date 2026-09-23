"use client";

import { useAuth } from "../../auth/AuthProvider";
import { type DriveFile } from "@/lib/drive/drive";
import { renderFilePreview, type PreviewVariant } from "./preview-renderers";

interface PreviewBodyProps {
  file: DriveFile;
  userEmail?: string;
  variant?: PreviewVariant;
}

/** Dispatches to the preview registry. Image is implemented; other kinds fall back. */
export function PreviewBody({ file, variant = "drawer" }: PreviewBodyProps) {
  const { token } = useAuth();
  if (!file?.id) return null;
  return renderFilePreview(file, token, variant);
}
