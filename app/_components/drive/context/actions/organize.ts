import { type DriveFile, isFolder, setStarred } from "@/lib/drive/drive";
import { toast } from "@/lib/ui/toast";
import { logActivity } from "@/lib/activity/log";
import { DASHBOARD_PINS_KEY } from "@/lib/collections/pins";
import { getSelectedDriveFiles } from "@/lib/stores";
import type { usePins } from "../../../pins/PinsProvider";
import type { useFavorites } from "../../../favorites/FavoritesProvider";
import type { useHidden } from "../../../hidden/HiddenProvider";
import type { DriveActionContext } from "./types";

/** Provider-backed collection toggles this group depends on. */
interface OrganizeDeps {
  pins: Pick<ReturnType<typeof usePins>, "pin" | "unpin" | "isPinned">;
  favorites: Pick<ReturnType<typeof useFavorites>, "favorite" | "unfavorite" | "isFavorite">;
  hidden: Pick<ReturnType<typeof useHidden>, "hideMany" | "unhideMany" | "isHidden">;
}

/** Star, favorite, pin, and hide toggles. */
export function createOrganizeActions(ctx: DriveActionContext, deps: OrganizeDeps) {
  const { token, route, filesCtx, clearSelection, markFolderWork, onFileChanged } = ctx;
  const { isTrashView, isActivityView, isHiddenView } = route;
  const { folderContext } = filesCtx;
  const { pin, unpin, isPinned: checkPinned } = deps.pins;
  const { favorite, unfavorite, isFavorite: checkFavorite } = deps.favorites;
  const { hideMany, unhideMany, isHidden: checkHidden } = deps.hidden;

  async function handleToggleStar(file: DriveFile) {
    if (!token) return;
    const optimistic = { ...file, starred: !file.starred };
    onFileChanged(optimistic);
    try {
      const updated = await setStarred(token, file.id, !file.starred);
      onFileChanged(updated);
      await logActivity({
        type: updated.starred ? "star" : "unstar",
        description: updated.starred ? `Starred ${file.name}` : `Unstarred ${file.name}`,
        fileIds: [file.id],
        fileNames: [file.name],
        folderContext,
      });
      toast.success(
        updated.starred ? `Starred "${file.name}"` : `Unstarred "${file.name}"`
      );
      markFolderWork(file);
    } catch (err) {
      console.error(err);
      onFileChanged(file);
      toast.error("Failed to update star");
    }
  }

  async function handleToggleFavorite(targets?: DriveFile[]) {
    const items = (targets ?? getSelectedDriveFiles()).filter(isFolder);
    if (!items.length) return;
    if (isTrashView || isActivityView) {
      toast.info("Cannot favorite items here");
      return;
    }
    const allFavorited = items.every((f) => checkFavorite(f.id));
    if (allFavorited) {
      await Promise.all(items.map((f) => unfavorite(f.id)));
      await Promise.all(items.map((f) => logActivity({
        type: "unpin",
        description: `Removed ${f.name} from favorites`,
        fileIds: [f.id],
        fileNames: [f.name],
        folderContext,
      })));
      toast.success(
        items.length === 1
          ? `Removed "${items[0].name}" from favorites`
          : `Removed ${items.length} folders from favorites`,
      );
    } else {
      const toFavorite = items.filter((f) => !checkFavorite(f.id));
      await Promise.all(toFavorite.map((f) => favorite(f.id)));
      await Promise.all(toFavorite.map((f) => logActivity({
        type: "pin",
        description: `Added ${f.name} to favorites`,
        fileIds: [f.id],
        fileNames: [f.name],
        folderContext,
      })));
      toast.success(
        toFavorite.length === 1
          ? `Added "${toFavorite[0].name}" to favorites`
          : `Added ${toFavorite.length} folders to favorites`,
      );
    }
    markFolderWork(items);
  }

  async function handleTogglePin(targets?: DriveFile[]) {
    const all = targets ?? getSelectedDriveFiles();
    if (!all.length) return;

    const folders = all.filter(isFolder);
    const files = all.filter((f) => !isFolder(f));

    if (folders.length) await handleToggleFavorite(folders);
    if (!files.length) return;

    const items = files;
    if (isTrashView || isActivityView) {
      toast.info("Cannot pin items here");
      return;
    }
    const folderKey = DASHBOARD_PINS_KEY;
    const allPinned = items.every((f) => checkPinned(folderKey, f.id));
    if (allPinned) {
      await Promise.all(items.map((f) => unpin(folderKey, f.id)));
      await Promise.all(items.map((f) => logActivity({
        type: "unpin",
        description: `Unpinned ${f.name}`,
        fileIds: [f.id],
        fileNames: [f.name],
        folderContext,
      })));
      toast.success(items.length === 1 ? `Unpinned "${items[0].name}"` : `Unpinned ${items.length} items`);
    } else {
      const toPin = items.filter((f) => !checkPinned(folderKey, f.id));
      await Promise.all(toPin.map((f) => pin(folderKey, f.id)));
      await Promise.all(toPin.map((f) => logActivity({
        type: "pin",
        description: `Pinned ${f.name}`,
        fileIds: [f.id],
        fileNames: [f.name],
        folderContext,
      })));
      toast.success(toPin.length === 1 ? `Pinned "${toPin[0].name}"` : `Pinned ${toPin.length} items`);
    }
    markFolderWork(items);
  }

  async function handleToggleHidden(targets?: DriveFile[]) {
    const items = targets ?? getSelectedDriveFiles();
    if (!items.length) return;
    if (isTrashView || isActivityView) {
      toast.info("Cannot hide items here");
      return;
    }
    const ids = items.map((f) => f.id);
    const allHidden = items.every((f) => checkHidden(f.id));
    if (allHidden || isHiddenView) {
      await unhideMany(ids);
      await Promise.all(items.map((f) => logActivity({
        type: "unhide",
        description: `Unhid ${f.name}`,
        fileIds: [f.id],
        fileNames: [f.name],
        folderContext,
      })));
      toast.success(
        items.length === 1
          ? `Unhid "${items[0].name}"`
          : `Unhid ${items.length} items`,
      );
    } else {
      const toHide = items.filter((f) => !checkHidden(f.id));
      await hideMany(toHide.map((f) => f.id));
      await Promise.all(toHide.map((f) => logActivity({
        type: "hide",
        description: `Hid ${f.name}`,
        fileIds: [f.id],
        fileNames: [f.name],
        folderContext,
      })));
      toast.success(
        toHide.length === 1
          ? `Hid "${toHide[0].name}" — still visible in Google Drive`
          : `Hid ${toHide.length} items — still visible in Google Drive`,
      );
    }
    clearSelection();
    markFolderWork(items);
  }

  return { handleToggleStar, handleToggleFavorite, handleTogglePin, handleToggleHidden };
}
