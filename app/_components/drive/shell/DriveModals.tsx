"use client";

import { useRouter } from "next/navigation";
import { isFolder, type DriveFile } from "@/lib/drive/drive";
import { DASHBOARD_PINS_KEY } from "@/lib/pins";
import { driveRoutes } from "@/lib/navigation";
import {
  ConfirmModal, MoveModal, NewFolderModal, RenameModal, ShareModal,
} from "../../ui/Dialogs";
import { FileMenu } from "../menu/FileMenu";
import { TagManageModal } from "../../tags/TagManageModal";
import { TagPickerModal } from "../../tags/TagPickerModal";
import { SaveViewModal } from "../../views/SaveViewModal";
import { SpaceEditorModal } from "../../spaces/SpaceEditorModal";
import { useSpaces } from "../../spaces/SpacesProvider";
import { BulkRenameModal } from "../../ui/BulkRenameModal";
import { usePins } from "../../pins/PinsProvider";
import { useFavorites } from "../../favorites/FavoritesProvider";
import { useHidden } from "../../hidden/HiddenProvider";
import { useInbox } from "../../inbox/InboxProvider";
import { useFolderCovers } from "../../folder-covers/FolderCoversProvider";
import { SetFolderCoverModal } from "../../folder-covers/SetFolderCoverModal";
import { recordRecentFolderWork } from "@/lib/recent-folders";
import { getSelectedDriveFiles, useFilesStore } from "@/lib/stores";
import { useDriveBrowse } from "../context/DriveBrowseProvider";
import { toast } from "@/lib/toast";
import { displayTagName } from "@/lib/tag-kinds";

/** All drive-related modals — mounted once at app shell level. */
export function DriveModals() {
  const b = useDriveBrowse();
  const { editorOpen, editorSpace, closeEditor } = useSpaces();
  const router = useRouter();
  const { isPinned } = usePins();
  const { isFavorite } = useFavorites();
  const { isHidden } = useHidden();
  const { isInInbox, add: addToInbox, archive } = useInbox();
  const { getCover } = useFolderCovers();

  const pinScope = !b.isTrashView && !b.isActivityView;
  const hideScope = !b.isTrashView && !b.isActivityView;
  const coverScope = !b.isTrashView && !b.isActivityView;
  const folderKey = DASHBOARD_PINS_KEY;

  function recordBrowseFolderWork(items: DriveFile[]) {
    recordRecentFolderWork({
      locationFolderId: b.currentFolder.id ?? b.routeFolderId,
      items,
    });
  }

  const moveModalOpen = b.moveTargets !== null;
  const moveModalName = b.moveTargets?.length === 1
    ? b.moveTargets[0].name
    : `${b.moveTargets?.length ?? 0} items`;

  return (
    <>
      <NewFolderModal open={b.showNewFolder} onClose={() => b.setShowNewFolder(false)} onCreate={b.handleCreateFolder} />
      <RenameModal
        open={b.renameTarget !== null}
        initialName={b.renameTarget?.name || ""}
        onClose={() => b.setRenameTarget(null)}
        onRename={async (name) => { if (b.renameTarget) await b.handleRename(b.renameTarget, name); }}
      />
      <ShareModal
        open={b.shareTarget !== null}
        fileId={b.shareTarget?.id || null}
        fileName={b.shareTarget?.name || ""}
        fileMime={b.shareTarget?.mimeType || ""}
        onClose={() => b.setShareTarget(null)}
        onSharingChanged={() => {
          if (b.shareTarget) recordBrowseFolderWork([b.shareTarget]);
        }}
      />
      <MoveModal
        open={moveModalOpen}
        fileName={moveModalName}
        currentParentId={b.currentFolder.id}
        excludeFolderId={
          b.moveTargets?.length === 1 && b.moveTargets[0] && isFolder(b.moveTargets[0])
            ? b.moveTargets[0].id
            : undefined
        }
        onClose={() => b.setMoveTargets(null)}
        onMove={async (newParentId, destName) => {
          if (b.moveTargets) await b.handleMoveMany(b.moveTargets, newParentId, destName);
          b.setMoveTargets(null);
        }}
      />
      <ConfirmModal
        open={b.deleteForeverTargets !== null}
        title="Delete forever?"
        message={
          b.deleteForeverTargets?.length === 1
            ? `"${b.deleteForeverTargets[0].name}" will be permanently deleted. This cannot be undone.`
            : `${b.deleteForeverTargets?.length} items will be permanently deleted. This cannot be undone.`
        }
        confirmLabel="Delete forever"
        confirmVariant="danger"
        onClose={() => b.setDeleteForeverTargets(null)}
        onConfirm={async () => {
          if (b.deleteForeverTargets) await b.handleDeleteForever(b.deleteForeverTargets);
          b.setDeleteForeverTargets(null);
        }}
      />
      <ConfirmModal
        open={b.emptyTrashConfirm}
        title="Empty trash?"
        message="All items in trash will be permanently deleted. This cannot be undone."
        confirmLabel="Empty trash"
        confirmVariant="danger"
        onClose={() => b.setEmptyTrashConfirm(false)}
        onConfirm={async () => {
          await b.handleEmptyTrash();
          b.setEmptyTrashConfirm(false);
        }}
      />
      <BulkRenameModal
        open={b.bulkRenameOpen}
        files={getSelectedDriveFiles().filter((f) => !isFolder(f))}
        allNames={b.files.map((f) => f.name)}
        onClose={() => b.setBulkRenameOpen(false)}
        onComplete={(updated) => {
          updated.forEach(b.onFileChanged);
          recordBrowseFolderWork(updated);
        }}
      />
      <SetFolderCoverModal
        open={b.coverModalFolder !== null}
        folder={b.coverModalFolder}
        onClose={() => b.setCoverModalFolder(null)}
        onSelectCover={async (coverFileId) => {
          if (b.coverModalFolder) {
            await b.handleSetFolderCover(b.coverModalFolder.id, coverFileId);
          }
        }}
        onUploadCover={async (file) => {
          if (b.coverModalFolder) {
            await b.handleUploadFolderCover(b.coverModalFolder, file);
          }
        }}
      />
      <FileMenu
        open={b.menu !== null}
        anchorRect={b.menu?.rect ?? null}
        pointer={b.menu?.pointer}
        onClose={() => b.setMenu(null)}
        onDownload={() => b.menu && b.handleDownload(b.menu.file)}
        onRename={() => b.menu && b.setRenameTarget(b.menu.file)}
        onShare={() => b.menu && b.setShareTarget(b.menu.file)}
        onMove={() => b.menu && b.setMoveTargets([b.menu.file])}
        onTag={() => b.menu && b.openTagPicker([b.menu.file])}
        showPin={!!(pinScope && b.menu && !isFolder(b.menu.file))}
        isPinned={!!(b.menu && !isFolder(b.menu.file) && isPinned(folderKey, b.menu.file.id))}
        onTogglePin={() => b.menu && void b.handleTogglePin([b.menu.file])}
        showFavorite={!!(pinScope && b.menu && isFolder(b.menu.file))}
        isFavorite={!!(b.menu && isFolder(b.menu.file) && isFavorite(b.menu.file.id))}
        onToggleFavorite={() => b.menu && void b.handleToggleFavorite([b.menu.file])}
        showHide={!!(hideScope && b.menu)}
        isHidden={!!(b.menu && isHidden(b.menu.file.id))}
        onToggleHide={() => b.menu && void b.handleToggleHidden([b.menu.file])}
        showAddToInbox={!!(hideScope && b.menu && !isFolder(b.menu.file) && !isInInbox(b.menu.file.id) && !b.isInboxView)}
        onAddToInbox={() => {
          if (!b.menu || isFolder(b.menu.file)) return;
          void addToInbox([b.menu.file.id]).then(() => {
            toast.success(`Added "${b.menu!.file.name}" to Inbox`);
          }).catch(() => toast.error("Couldn't add to Inbox"));
        }}
        showArchive={!!(b.menu && isInInbox(b.menu.file.id))}
        onArchive={() => {
          const file = b.menu?.file;
          if (!file) return;
          void archive([file.id]).then(() => {
            toast.success(`Archived "${file.name}"`);
            if (b.isInboxView) useFilesStore.getState().removeFile(file.id);
          }).catch(() => toast.error("Couldn't archive"));
        }}
        showCover={!!(coverScope && b.menu && isFolder(b.menu.file))}
        hasCover={!!(b.menu && isFolder(b.menu.file) && getCover(b.menu.file.id))}
        onSetCover={() => b.menu && b.setCoverModalFolder(b.menu.file)}
        onRemoveCover={() => b.menu && void b.handleRemoveFolderCover(b.menu.file.id)}
        onTrash={() => b.menu && b.handleTrashFiles([b.menu.file])}
      />
      <TagManageModal
        open={b.tagManageOpen}
        onClose={() => b.setTagManageOpen(false)}
        tags={b.tags}
        counts={b.counts}
      />
      <TagPickerModal
        open={b.tagPickerOpen}
        onClose={() => b.setTagPickerOpen(false)}
        fileIds={b.tagPickerFileIds}
        fileNames={b.tagPickerFileNames}
        fileLabel={b.tagPickerLabel}
        tags={b.tags}
        onManageTags={() => { b.setTagPickerOpen(false); b.setTagManageOpen(true); }}
        onTagsApplied={() => {
          const items = b.files.filter((f) => b.tagPickerFileIds.includes(f.id));
          recordBrowseFolderWork(items);
        }}
        mimeTypes={
          b.tagPickerFileIds
            .map((id) => b.files.find((f) => f.id === id)?.mimeType)
            .filter((m): m is string => !!m)
        }
        initialTagIds={
          b.tagPickerFileIds.length === 1
            ? (b.tagsByFileId.get(b.tagPickerFileIds[0]) ?? []).map((t) => t.id)
            : b.tagPickerFileIds.reduce<string[]>((acc, fid, i) => {
                const ids = (b.tagsByFileId.get(fid) ?? []).map((t) => t.id);
                return i === 0 ? ids : acc.filter((id) => ids.includes(id));
              }, [])
        }
      />
      <SaveViewModal
        open={b.saveViewOpen}
        onClose={() => b.setSaveViewOpen(false)}
        scope={b.captureCurrentViewScope()}
        filters={b.filters}
        search={b.search}
        sort={b.fileSort}
        layout={b.view === "list" ? "list" : "grid"}
        tagNames={b.routeTagIds.map((id) => {
          const tag = b.tags.find((t) => t.id === id);
          return tag ? displayTagName(tag) : id;
        })}
        onSaved={(viewId) => router.push(driveRoutes.view(viewId))}
      />
      <SpaceEditorModal
        open={editorOpen}
        space={editorSpace}
        onClose={closeEditor}
        onSaved={(spaceId) => router.push(driveRoutes.space(spaceId))}
      />
    </>
  );
}
