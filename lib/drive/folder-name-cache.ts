const names = new Map<string, string>();

export function cacheFolderName(id: string, name: string): void {
  if (id && name) names.set(id, name);
}

export function cacheFolderNamesFromFiles(
  files: Array<{ id: string; name: string; mimeType?: string }>
): void {
  for (const f of files) {
    if (f.mimeType === "application/vnd.google-apps.folder") {
      cacheFolderName(f.id, f.name);
    }
  }
}

export function getCachedFolderName(id: string): string | undefined {
  return names.get(id);
}
