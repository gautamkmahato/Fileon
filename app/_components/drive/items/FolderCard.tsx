"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { FileText, MoreVertical } from "lucide-react";
import type { DriveFile } from "@/lib/drive/drive";
import { FOLDER_TINTS } from "@/lib/types/file-types";
import { useBulkSelectionActive, useIsSelected, useIsCut } from "@/lib/stores";
import { useAuth } from "../../auth/AuthProvider";
import { useFileTags } from "../../tags/TagsProvider";
import { TagDots } from "../../tags/TagDisplay";
import { useFolderCover, useFolderCovers } from "../../folder-covers/FolderCoversProvider";
import { PinBadge } from "./PinBadge";
import { FavoriteBadge } from "./FavoriteBadge";
import { HiddenBadge } from "./HiddenBadge";
import { FolderCoverImage } from "./FolderCoverImage";
import {
  formatFolderItemCount,
  getCachedFolderItemCount,
  loadFolderItemCount,
  type FolderItemCount,
} from "@/lib/cache/folder-item-count-cache";
import {
  folderTextureBackgroundUrl,
  shouldUseFolderTextureBackground,
} from "@/lib/drive/folder-ui";

interface FolderCardProps {
  folder: DriveFile;
  tintIndex: number;
  isPinned?: boolean;
  isFavorite?: boolean;
  isHidden?: boolean;
  isDropTarget?: boolean;
  onOpen: (folder: DriveFile) => void;
  onSelect?: (folder: DriveFile, e: React.MouseEvent) => void;
  onMenu?: (folder: DriveFile, anchor: HTMLElement, e?: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent, fileId: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnter?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

const COVER_GRADIENTS = [
  "from-violet-600 to-purple-800",
  "from-orange-500 to-amber-700",
  "from-emerald-500 to-teal-700",
  "from-rose-500 to-pink-700",
  "from-sky-500 to-blue-700",
  "from-amber-500 to-orange-700",
];

export const FolderCard = memo(function FolderCard({
  folder, tintIndex, isPinned, isFavorite, isHidden, isDropTarget,
  onOpen, onSelect, onMenu,
  onDragStart, onDragOver, onDragEnter, onDragLeave, onDrop,
}: FolderCardProps) {
  const { token } = useAuth();
  const selected = useIsSelected(folder.id);
  const isCut = useIsCut(folder.id);
  const bulkSelectionActive = useBulkSelectionActive();
  const fileTags = useFileTags(folder.id);
  const tint = FOLDER_TINTS[tintIndex % FOLDER_TINTS.length];
  const gradient = COVER_GRADIENTS[tintIndex % COVER_GRADIENTS.length];
  const coverRecord = useFolderCover(folder.id);
  const { removeCover } = useFolderCovers();
  const [coverActive, setCoverActive] = useState(true);
  const [itemCount, setItemCount] = useState<FolderItemCount | undefined>(
    () => getCachedFolderItemCount(folder.id),
  );

  useEffect(() => {
    setCoverActive(true);
  }, [coverRecord?.coverFileId]);

  useEffect(() => {
    if (!token) return;
    void loadFolderItemCount(token, folder.id).then(setItemCount);
  }, [token, folder.id]);

  const handleCoverInvalid = useCallback(() => {
    setCoverActive(false);
    void removeCover(folder.id);
  }, [folder.id, removeCover]);

  const showCover = coverRecord && coverActive;
  const showTexture = shouldUseFolderTextureBackground(folder, !!showCover);
  const textureSrc = folderTextureBackgroundUrl(tintIndex);
  const countLabel = formatFolderItemCount(itemCount);

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={(e) => onDragStart?.(e, folder.id)}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={(e) => onSelect?.(folder, e)}
      onDoubleClick={() => onOpen(folder)}
      onContextMenu={(e) => {
        if (!onMenu) return;
        e.preventDefault();
        e.stopPropagation();
        onMenu(folder, e.currentTarget as HTMLElement, e);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(folder); }}
      className={`group relative min-w-0 rounded-2xl overflow-hidden cursor-pointer transition-all focus:outline-none ${
        isCut
          ? "opacity-55 ring-2 ring-dashed ring-amber-500"
          : isHidden
          ? "opacity-60 ring-1 ring-zinc-200/80 dark:ring-zinc-700 hover:ring-zinc-300 dark:hover:ring-zinc-600"
          : selected
          ? "ring-2 ring-blue-500"
          : isDropTarget
          ? "ring-2 ring-blue-500"
          : "ring-1 ring-zinc-200/80 dark:ring-zinc-700 hover:ring-zinc-300 dark:hover:ring-zinc-600 focus:ring-2 focus:ring-blue-400"
      }`}
    >
      <div className="relative aspect-[3/2] overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {showCover ? (
          <FolderCoverImage
            coverFileId={coverRecord.coverFileId}
            position={coverRecord.position}
            alt={folder.name}
            onInvalid={handleCoverInvalid}
            className="transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : showTexture ? (
          <>
            <div
              aria-hidden
              className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-300 group-hover:scale-[1.03]"
              style={{ backgroundImage: `url(${textureSrc})` }}
            />
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-60`} />
          </>
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
        )}

        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.35) 42%, transparent 72%)",
          }}
        />

        {isFavorite && <FavoriteBadge className="top-2.5 left-2.5" />}
        {isPinned && !isFavorite && <PinBadge className="top-2.5 left-2.5" />}
        {isHidden && <HiddenBadge className="absolute top-2.5 right-12 z-10" />}

        {onMenu && !bulkSelectionActive && (
          <button
            onClick={(e) => { e.stopPropagation(); onMenu(folder, e.currentTarget); }}
            className={`absolute top-2.5 right-2.5 z-30 w-7 h-7 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-sm text-white/90 hover:bg-black/55 transition-all ${
              selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
            aria-label="More actions"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        )}

        <div className="absolute bottom-0 left-0 right-0 z-20 px-3 pb-3 pt-8 pointer-events-none">
          <div className="flex items-center gap-2 min-w-0">
            <FolderFilledIcon className={`w-5 h-5 shrink-0 ${tint.icon} drop-shadow-sm`} />
            <p
              className="text-sm font-semibold text-white truncate drop-shadow-sm"
              title={folder.name}
            >
              {folder.name}
            </p>
          </div>
          {countLabel && (
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/85 tabular-nums">
              <FileText className="w-3 h-3 shrink-0 opacity-90" strokeWidth={2} />
              <span>{countLabel}</span>
            </div>
          )}
          {fileTags.length > 0 && (
            <div className="mt-1.5">
              <TagDots tags={fileTags} className="[&_span]:ring-white/20" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

function FolderFilledIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M3 6a2 2 0 0 1 2-2h4.586a2 2 0 0 1 1.414.586l1.414 1.414a2 2 0 0 0 1.414.586H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" />
    </svg>
  );
}
