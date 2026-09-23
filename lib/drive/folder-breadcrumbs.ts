import { getFile } from "@/lib/drive/drive";
import { cacheFolderName } from "@/lib/drive/folder-name-cache";
import type { FolderCrumb } from "@/lib/drive/types";

const MAX_DEPTH = 50;

/** Walk parent chain from Drive API and build My Drive > … > folder crumbs. */
export async function resolveFolderBreadcrumbs(
  token: string,
  folderId: string,
): Promise<FolderCrumb[]> {
  const chain: FolderCrumb[] = [];
  const seen = new Set<string>();
  let currentId: string | undefined = folderId;

  while (currentId && !seen.has(currentId) && chain.length < MAX_DEPTH) {
    seen.add(currentId);

    const file = await getFile(token, currentId);
    cacheFolderName(currentId, file.name);
    chain.unshift({ id: currentId, name: file.name });

    const parentId = file.parents?.[0];
    if (!parentId || parentId === "root") break;
    currentId = parentId;
  }

  return [{ id: null, name: "My Drive" }, ...chain];
}

/** True when the stack looks like a direct jump (e.g. modal / URL) rather than drill-down. */
export function needsFullFolderPathResolve(
  stack: FolderCrumb[],
  folderId: string,
): boolean {
  const idx = stack.findIndex((c) => c.id === folderId);
  if (idx < 0) return true;
  if (idx !== stack.length - 1) return false;
  return stack.length <= 2;
}
