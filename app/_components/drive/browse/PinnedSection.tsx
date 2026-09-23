"use client";

import { useCallback, useState } from "react";
import { isFolder, type DriveFile } from "@/lib/drive/drive";
import { driveActions } from "@/lib/drive/drive-actions-bridge";
import { usePins } from "@/app/_components/pins/PinsProvider";
import { useBrowseStore } from "@/lib/stores";
import { FileCard } from "../items/FileCard";
import { FileRow } from "../items/FileRow";
import { FolderCard } from "../items/FolderCard";

interface PinnedSectionProps {
  folderKey: string;
  items: DriveFile[];
  isTrashView: boolean;
  folderDropTarget: string | null;
}

export function PinnedSection({
  folderKey, items, isTrashView, folderDropTarget,
}: PinnedSectionProps) {
  const view = useBrowseStore((s) => s.view);
  const { reorderPins } = usePins();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const handleDrop = useCallback(async (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ids = items.map((i) => i.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, dragId);
    await reorderPins(folderKey, next);
    setDragId(null);
    setOverId(null);
  }, [dragId, folderKey, items, reorderPins]);

  if (!items.length) return null;

  return (
    <section className="mb-10">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Pinned</h2>
      {view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {items.map((item, i) => {
            const folder = isFolder(item);
            const dragging = dragId === item.id;
            const over = overId === item.id && dragId !== item.id;
            const cardProps = {
              onDragStart: (e: React.DragEvent) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/pin-id", item.id);
                setDragId(item.id);
              },
              onDragEnd: () => { setDragId(null); setOverId(null); },
              onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOverId(item.id); },
              onDragLeave: () => { if (overId === item.id) setOverId(null); },
              onDrop: (e: React.DragEvent) => {
                e.preventDefault();
                void handleDrop(item.id);
              },
            };

            return (
              <div
                key={item.id}
                className={`relative ${dragging ? "opacity-50" : ""} ${over ? "ring-2 ring-blue-400 rounded-2xl" : ""}`}
                draggable
                {...cardProps}
              >
                {folder ? (
                  <FolderCard
                    folder={item}
                    tintIndex={i}
                    isPinned
                    isDropTarget={folderDropTarget === item.id}
                    onOpen={driveActions.openFile}
                    onSelect={driveActions.handleItemSelect}
                    onMenu={!isTrashView ? driveActions.openMenu : undefined}
                    onDragStart={undefined}
                    onDragOver={(e) => driveActions.onFolderDragOver(e, item.id)}
                    onDragLeave={driveActions.onFolderDragLeave}
                    onDrop={(e) => driveActions.onFolderDrop(e, item.id)}
                  />
                ) : (
                  <FileCard
                    file={item}
                    isPinned
                    onOpen={driveActions.openFile}
                    onSelect={driveActions.handleItemSelect}
                    onToggleStar={!isTrashView ? driveActions.handleToggleStar : undefined}
                    onMenu={!isTrashView ? driveActions.openMenu : undefined}
                    onDragStart={undefined}
                    isTrash={isTrashView}
                    onRestore={isTrashView ? driveActions.handleRestoreOne : undefined}
                    onDeleteForever={isTrashView ? driveActions.setDeleteForeverOne : undefined}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-700 overflow-hidden shadow-sm dark:shadow-none">
          <div className="grid grid-cols-[1fr_180px_160px_120px_40px] gap-4 px-5 py-2.5 border-b border-zinc-200 dark:border-zinc-700 text-[11px] uppercase tracking-wider font-medium text-zinc-500 bg-zinc-50/40 dark:bg-zinc-800/40">
            <span className="pl-7">Name</span>
            <span>Owner</span>
            <span>Modified</span>
            <span>Size</span>
            <span />
          </div>
          {items.map((item) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => setDragId(item.id)}
              onDragEnd={() => { setDragId(null); setOverId(null); }}
              onDragOver={(e) => { e.preventDefault(); setOverId(item.id); }}
              onDrop={(e) => { e.preventDefault(); void handleDrop(item.id); }}
              className={`${dragId === item.id ? "opacity-50" : ""} ${overId === item.id && dragId !== item.id ? "ring-2 ring-inset ring-blue-400" : ""}`}
            >
              <FileRow
                file={item}
                isPinned
                showDragHandle
                onOpen={driveActions.openFile}
                onSelect={driveActions.handleItemSelect}
                onMenu={!isTrashView ? driveActions.openMenu : undefined}
                onDragStart={undefined}
                isTrash={isTrashView}
                onRestore={isTrashView ? driveActions.handleRestoreOne : undefined}
                onDeleteForever={isTrashView ? driveActions.setDeleteForeverOne : undefined}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
