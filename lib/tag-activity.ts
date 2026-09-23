import { logActivity } from "./activity-log";

export async function logTagCreated(name: string): Promise<void> {
  await logActivity({
    type: "tag-create",
    description: `Created tag "${name}"`,
    fileIds: [],
    fileNames: [name],
  });
}

export async function logTagUpdated(opts: {
  oldName: string;
  newName: string;
  colorChanged: boolean;
}): Promise<void> {
  const { oldName, newName, colorChanged } = opts;
  let description: string;
  if (oldName !== newName && colorChanged) {
    description = `Updated tag "${oldName}" → "${newName}" (color changed)`;
  } else if (oldName !== newName) {
    description = `Renamed tag "${oldName}" → "${newName}"`;
  } else {
    description = `Recolored tag "${newName}"`;
  }
  await logActivity({
    type: "tag-update",
    description,
    fileIds: [],
    fileNames: [newName],
  });
}

export async function logTagDeleted(name: string): Promise<void> {
  await logActivity({
    type: "tag-delete",
    description: `Deleted tag "${name}"`,
    fileIds: [],
    fileNames: [name],
  });
}

export async function logTagFileChanges(opts: {
  fileIds: string[];
  fileNames: string[];
  addedTagNames: string[];
  removedTagNames: string[];
}): Promise<void> {
  const { fileIds, fileNames, addedTagNames, removedTagNames } = opts;
  const multi = fileIds.length > 1;

  for (const tagName of addedTagNames) {
    const description = multi
      ? `Added tag "${tagName}" to ${fileIds.length} items`
      : `Added tag "${tagName}" to "${fileNames[0] ?? "file"}"`;
    await logActivity({
      type: "tag-add",
      description,
      fileIds: [...fileIds],
      fileNames: [...fileNames],
    });
  }

  for (const tagName of removedTagNames) {
    const description = multi
      ? `Removed tag "${tagName}" from ${fileIds.length} items`
      : `Removed tag "${tagName}" from "${fileNames[0] ?? "file"}"`;
    await logActivity({
      type: "tag-remove",
      description,
      fileIds: [...fileIds],
      fileNames: [...fileNames],
    });
  }
}
