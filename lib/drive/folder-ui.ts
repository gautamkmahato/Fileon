import type { DriveFile } from "./drive";

/** Total background images in `public/background/` (image_1.png … image_N.png). */
export const FOLDER_TEXTURE_BACKGROUND_COUNT = 71;

export const FOLDER_TEXTURE_BACKGROUNDS = Array.from(
  { length: FOLDER_TEXTURE_BACKGROUND_COUNT },
  (_, i) => `/background/image_${i + 1}.png`,
) as readonly string[];

/** Google-managed folders (Colab, AI Studio, etc.) — user cannot delete them. */
export function isSystemGeneratedFolder(folder: DriveFile): boolean {
  return folder.capabilities?.canDelete === false;
}

export function shouldUseFolderTextureBackground(
  folder: DriveFile,
  hasUserCover: boolean,
): boolean {
  if (hasUserCover) return false;
  return !isSystemGeneratedFolder(folder);
}

/** Sequential texture: index 0 → image_1, wraps when index ≥ image count. */
export function folderTextureBackgroundUrl(index: number): string {
  return FOLDER_TEXTURE_BACKGROUNDS[index % FOLDER_TEXTURE_BACKGROUNDS.length];
}
