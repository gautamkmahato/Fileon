"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Archive, Download, Bookmark, Eye, EyeOff, FolderInput, Image, ImageOff, Inbox, Pencil, Pin, PinOff, Share2, Tag, Trash2 } from "lucide-react";

export interface MenuPointer {
  x: number;
  y: number;
}

interface FileMenuProps {
  open: boolean;
  anchorRect: DOMRect | null;
  pointer?: MenuPointer | null;
  onClose: () => void;
  onDownload: () => void;
  onRename: () => void;
  onShare: () => void;
  onMove: () => void;
  onTag: () => void;
  onTogglePin?: () => void;
  isPinned?: boolean;
  showPin?: boolean;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
  showFavorite?: boolean;
  onToggleHide?: () => void;
  isHidden?: boolean;
  showHide?: boolean;
  showAddToInbox?: boolean;
  onAddToInbox?: () => void;
  showArchive?: boolean;
  onArchive?: () => void;
  showCover?: boolean;
  hasCover?: boolean;
  onSetCover?: () => void;
  onRemoveCover?: () => void;
  onTrash: () => void;
}

export function FileMenu({
  open, anchorRect, pointer, onClose,
  onDownload, onRename, onShare, onMove, onTag, onTogglePin, isPinned, showPin,
  onToggleFavorite, isFavorite, showFavorite,
  onToggleHide, isHidden, showHide,
  showAddToInbox, onAddToInbox, showArchive, onArchive,
  showCover, hasCover, onSetCover, onRemoveCover,
  onTrash,
}: FileMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !ref.current) {
      setPos(null);
      return;
    }
    const menu = ref.current;
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top: number;
    let left: number;

    if (pointer) {
      top = pointer.y;
      left = pointer.x;
    } else if (anchorRect) {
      top = anchorRect.bottom + 6;
      left = anchorRect.right - mw;
    } else {
      setPos(null);
      return;
    }

    if (left + mw > vw - pad) left = vw - mw - pad;
    if (left < pad) left = pad;
    if (top + mh > vh - pad) top = Math.max(pad, (pointer?.y ?? top) - mh);
    if (top < pad) top = pad;

    setPos({ top, left });
  }, [open, anchorRect, pointer]);

  useEffect(() => {
    if (!open) return;
    function onClickAway(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onClickAway);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickAway);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open, onClose]);

  if (!open || (!anchorRect && !pointer)) return null;

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        zIndex: 60,
        visibility: pos ? "visible" : "hidden",
        minWidth: 180,
      }}
      className="bg-white dark:bg-zinc-900 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-zinc-200/80 dark:border-zinc-700 py-1.5"
    >
      <MenuItem icon={Download} label="Download" onClick={() => { onClose(); onDownload(); }} />
      <MenuItem icon={Pencil} label="Rename" onClick={() => { onClose(); onRename(); }} />
      <MenuItem icon={Share2} label="Share" onClick={() => { onClose(); onShare(); }} />
      <MenuItem icon={FolderInput} label="Move to…" onClick={() => { onClose(); onMove(); }} />
      <MenuItem icon={Tag} label="Add tags…" onClick={() => { onClose(); onTag(); }} />
      {showFavorite && onToggleFavorite && (
        <MenuItem
          icon={Bookmark}
          label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          onClick={() => { onClose(); onToggleFavorite(); }}
        />
      )}
      {showPin && onTogglePin && (
        <MenuItem
          icon={isPinned ? PinOff : Pin}
          label={isPinned ? "Unpin" : "Pin"}
          onClick={() => { onClose(); onTogglePin(); }}
        />
      )}
      {showHide && onToggleHide && (
        <MenuItem
          icon={isHidden ? Eye : EyeOff}
          label={isHidden ? "Unhide" : "Hide"}
          onClick={() => { onClose(); onToggleHide(); }}
        />
      )}
      {showAddToInbox && onAddToInbox && (
        <MenuItem icon={Inbox} label="Add to Inbox" onClick={() => { onClose(); onAddToInbox(); }} />
      )}
      {showArchive && onArchive && (
        <MenuItem icon={Archive} label="Archive from Inbox" onClick={() => { onClose(); onArchive(); }} />
      )}
      {showCover && onSetCover && (
        <MenuItem
          icon={Image}
          label="Set cover image"
          onClick={() => { onClose(); onSetCover(); }}
        />
      )}
      {showCover && hasCover && onRemoveCover && (
        <MenuItem
          icon={ImageOff}
          label="Remove cover"
          onClick={() => { onClose(); onRemoveCover(); }}
        />
      )}
      <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
      <MenuItem icon={Trash2} label="Move to trash" onClick={() => { onClose(); onTrash(); }} danger />
    </div>
  );
}

function MenuItem({
  icon: Icon, label, onClick, danger,
}: {
  icon: typeof Download;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left ${
        danger
          ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
          : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
