"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bookmark, ChevronRight, GripVertical, Hash, LayoutGrid, Plus } from "lucide-react";
import { TYPE_BROWSE_CATEGORIES, TYPE_BROWSE_META } from "@/lib/drive/type-browse";
import { driveRoutes } from "@/lib/navigation";
import {
  displayLabel,
  ORGANIZE_BUILTIN_VIEW_IDS,
  type NavExtraId,
} from "@/lib/sidebar-nav";
import { getTagBgSoft, getTagTextClass } from "@/lib/tag-colors";
import { getViewIcon } from "@/lib/view-icons";
import { BUILTIN_VIEW_IDS, type SavedView } from "@/lib/views";
import type { TypeBrowseCount } from "@/lib/hooks/useTypeBrowseCounts";
import type { ParsedDriveRoute } from "@/lib/navigation";
import type { TypeBrowseCategory } from "@/lib/drive/type-browse";
import type { DriveFile } from "@/lib/drive/drive";
import type { Tag } from "@/lib/tags";
import type { SmartSpace } from "@/lib/spaces";
import { displayTagName, groupTagsByKind, TAG_KIND_META, TAG_KINDS } from "@/lib/tag-kinds";
import {
  EmptyHint, FolderRow, SectionHeader, ShowMoreButton, navRowClass,
} from "./items";

export const TAGS_VISIBLE_CAP = 5;
export const FAVORITES_VISIBLE_CAP = 5;
const VIEW_DRAG_MIME = "application/x-drive-view-id";

export interface SidebarExtrasProps {
  route: ParsedDriveRoute;
  typeCounts: Partial<Record<TypeBrowseCategory, TypeBrowseCount>>;
  tags: Tag[];
  tagCounts: Map<string, number>;
  views: SavedView[];
  spaces: SmartSpace[];
  favoriteFolders: DriveFile[];
  recentFolders: DriveFile[];
  onManageTags: () => void;
  onTagClick: (tagId: string, e: React.MouseEvent) => void;
  onOpenView: (viewId: string) => void;
  onReorderViews: (sourceId: string, targetId: string) => void;
  onViewMenu: (view: SavedView, x: number, y: number) => void;
  onCreateSpace: () => void;
  onOpenSpace: (spaceId: string) => void;
  onSpaceMenu: (space: SmartSpace, x: number, y: number) => void;
  onFolderDrop?: (e: React.DragEvent, folderId: string) => void;
}

export function renderNavExtra(id: NavExtraId, props: SidebarExtrasProps) {
  const Extra = EXTRA_RENDERERS[id];
  return Extra ? <Extra key={id} {...props} /> : null;
}

const EXTRA_RENDERERS: Record<NavExtraId, (props: SidebarExtrasProps) => React.ReactNode> = {
  browse: BrowseExtra,
  tags: TagsExtra,
  views: ViewsExtra,
  spaces: SpacesExtra,
  favorites: FavoritesExtra,
  "recent-folders": RecentFoldersExtra,
};

function BrowseExtra({ route, typeCounts }: SidebarExtrasProps) {
  if (TYPE_BROWSE_CATEGORIES.length === 0) {
    return <EmptyHint>No browse categories</EmptyHint>;
  }
  return (
    <ul className="space-y-0.5">
      {TYPE_BROWSE_CATEGORIES.map((category) => {
        const meta = TYPE_BROWSE_META[category];
        if (!meta) return null;
        const Icon = meta.icon;
        const isActive = route.view === "type" && route.typeCategory === category;
        const countInfo = typeCounts[category];
        const countLabel = countInfo
          ? countInfo.hasMore ? `${countInfo.count}+` : String(countInfo.count)
          : "—";
        return (
          <li key={category}>
            <Link
              href={driveRoutes.typeBrowse(category)}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
                isActive
                  ? `${meta.bgSoft} font-semibold text-zinc-900 dark:text-zinc-100`
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${meta.iconColor}`} strokeWidth={isActive ? 2.25 : 1.75} />
              <span className="truncate flex-1">{meta.label}</span>
              <span className={`text-[11px] tabular-nums shrink-0 ${isActive ? "text-zinc-600 dark:text-zinc-400 font-semibold" : "text-zinc-400"}`}>
                {countLabel}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function TagsExtra({ route, tags, tagCounts, onManageTags, onTagClick }: SidebarExtrasProps) {
  const grouped = useMemo(() => groupTagsByKind(tags), [tags]);
  const [expanded, setExpanded] = useState<Partial<Record<string, boolean>>>({});

  return (
    <section>
      <SectionHeader
        label="Tags"
        actionIcon={Plus}
        onAction={onManageTags}
      />
      <div className="space-y-3">
        {TAG_KINDS.map((kind) => {
          const list = grouped.get(kind) ?? [];
          if (kind !== "user" && kind !== "status" && kind !== "system" && list.length === 0) {
            return null;
          }
          const collapsible = kind === "user" || kind === "people" || kind === "project";
          const showAll = !!expanded[kind];
          const capped = collapsible && !showAll ? list.slice(0, TAGS_VISIBLE_CAP) : list;
          return (
            <div key={kind}>
              <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">
                {TAG_KIND_META[kind].label}
              </p>
              <ul className="space-y-0.5">
                {capped.map((tag) => {
                  if (!tag?.id) return null;
                  const isActive = route.view === "tags" && route.tagIds.includes(tag.id);
                  const count = tagCounts.get(tag.id) ?? 0;
                  return (
                    <li key={tag.id}>
                      <button
                        type="button"
                        onClick={(e) => onTagClick(tag.id, e)}
                        title="⌘/Ctrl+click to multi-select"
                        className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
                          isActive
                            ? `${getTagBgSoft(tag.colorId)} font-semibold text-zinc-900 dark:text-zinc-100`
                            : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                        }`}
                      >
                        {tag.emoji ? (
                          <span className="w-4 h-4 shrink-0 flex items-center justify-center text-[13px] leading-none">
                            {tag.emoji}
                          </span>
                        ) : (
                          <Hash className={`w-4 h-4 shrink-0 ${getTagTextClass(tag.colorId)}`} strokeWidth={isActive ? 2.5 : 2} />
                        )}
                        <span className="truncate flex-1 text-left">{displayLabel(displayTagName(tag), "Untitled tag")}</span>
                        <span className={`text-[11px] tabular-nums shrink-0 ${isActive ? `${getTagTextClass(tag.colorId)} font-semibold` : "text-zinc-400"}`}>
                          {count}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {collapsible && list.length > TAGS_VISIBLE_CAP && (
                  <li>
                    <ShowMoreButton
                      expanded={showAll}
                      total={list.length}
                      onClick={() => setExpanded((prev) => ({ ...prev, [kind]: !showAll }))}
                    />
                  </li>
                )}
                {list.length === 0 && (
                  <li><EmptyHint>{kind === "user" ? "No labels yet" : `No ${TAG_KIND_META[kind].label.toLowerCase()}`}</EmptyHint></li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ViewsExtra({
  route, views, onOpenView, onReorderViews, onViewMenu,
}: SidebarExtrasProps) {
  const [expanded, setExpanded] = useState(true);
  const [dragViewId, setDragViewId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const builtin = useMemo(
    () => ORGANIZE_BUILTIN_VIEW_IDS
      .map((id) => views.find((v) => v.id === id))
      .filter((v): v is SavedView => !!v),
    [views],
  );
  const custom = useMemo(
    () => views.filter((v) => v && !v.builtIn && v.id !== BUILTIN_VIEW_IDS.SHARED),
    [views],
  );
  const rows = [...builtin, ...custom];

  return (
    <section>
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className={navRowClass(false)}
      >
        <Bookmark className="w-4 h-4 shrink-0" strokeWidth={1.75} />
        <span className="truncate flex-1 text-left">Views</span>
        <ChevronRight className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${expanded ? "rotate-90" : ""}`} strokeWidth={2} />
      </button>
      {expanded && (
        <ul className="mt-0.5 space-y-0.5">
          {rows.map((view) => {
            const Icon = getViewIcon(view.icon);
            const isActive = route.view === "saved" && route.savedViewId === view.id;
            const isDropTarget = dropTargetId === view.id && dragViewId !== view.id;
            return (
              <li
                key={view.id}
                draggable={!view.builtIn}
                onDragStart={(e) => {
                  if (view.builtIn) return;
                  setDragViewId(view.id);
                  e.dataTransfer.setData(VIEW_DRAG_MIME, view.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => { setDragViewId(null); setDropTargetId(null); }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragViewId && dragViewId !== view.id) setDropTargetId(view.id);
                }}
                onDragLeave={() => setDropTargetId(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  const sourceId = e.dataTransfer.getData(VIEW_DRAG_MIME) || dragViewId;
                  if (sourceId) onReorderViews(sourceId, view.id);
                  setDragViewId(null);
                  setDropTargetId(null);
                }}
                className={isDropTarget ? "ring-2 ring-blue-400 ring-inset rounded-lg" : undefined}
              >
                <button
                  type="button"
                  onClick={() => onOpenView(view.id)}
                  onContextMenu={(e) => {
                    if (view.builtIn) return;
                    e.preventDefault();
                    onViewMenu(view, e.clientX, e.clientY);
                  }}
                  className={navRowClass(isActive, true)}
                >
                  {!view.builtIn && (
                    <GripVertical className="w-3.5 h-3.5 shrink-0 text-zinc-300 cursor-grab active:cursor-grabbing" />
                  )}
                  {view.emoji ? (
                    <span className="w-4 h-4 shrink-0 flex items-center justify-center text-[14px] leading-none">{view.emoji}</span>
                  ) : (
                    <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                  )}
                  <span className="truncate flex-1 text-left">{displayLabel(view.name, "Untitled view")}</span>
                </button>
              </li>
            );
          })}
          {rows.length === 0 && (
            <li><EmptyHint>Save a filter as a view from the toolbar</EmptyHint></li>
          )}
        </ul>
      )}
    </section>
  );
}

function SpacesExtra({
  route, spaces, onCreateSpace, onOpenSpace, onSpaceMenu,
}: SidebarExtrasProps) {
  const [expanded, setExpanded] = useState(true);
  return (
    <section>
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className={`${navRowClass(false)} flex-1`}
        >
          <LayoutGrid className="w-4 h-4 shrink-0" strokeWidth={1.75} />
          <span className="truncate flex-1 text-left">Spaces</span>
          <ChevronRight className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${expanded ? "rotate-90" : ""}`} strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={onCreateSpace}
          className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0"
          aria-label="New Smart Space"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      {expanded && (
        <ul className="mt-0.5 space-y-0.5">
          {spaces.map((space) => {
            const isActive = route.view === "spaces" && route.spaceId === space.id;
            return (
              <li key={space.id}>
                <button
                  type="button"
                  onClick={() => onOpenSpace(space.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onSpaceMenu(space, e.clientX, e.clientY);
                  }}
                  className={navRowClass(isActive, true)}
                >
                  <span className="w-4 h-4 shrink-0 flex items-center justify-center text-[14px] leading-none">
                    {space.emoji || "📁"}
                  </span>
                  <span className="truncate flex-1 text-left">{displayLabel(space.name, "Untitled space")}</span>
                </button>
              </li>
            );
          })}
          {spaces.length === 0 && (
            <li><EmptyHint>Create a rule-based virtual folder</EmptyHint></li>
          )}
        </ul>
      )}
    </section>
  );
}

function FavoritesExtra({
  route, favoriteFolders, onFolderDrop,
}: SidebarExtrasProps) {
  const [showAll, setShowAll] = useState(false);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  if (favoriteFolders.length === 0) return null;
  const visible = showAll ? favoriteFolders : favoriteFolders.slice(0, FAVORITES_VISIBLE_CAP);

  return (
    <section>
      <SectionHeader
        label="Favorites"
        count={favoriteFolders.length > FAVORITES_VISIBLE_CAP && !showAll ? favoriteFolders.length : undefined}
      />
      <div className={`space-y-0.5 ${showAll ? "max-h-[400px] overflow-y-auto" : ""}`}>
        {visible.map((folder) => (
          <FolderRow
            key={folder.id}
            folder={folder}
            active={route.view === "drive" && route.folderId === folder.id}
            onFolderDrop={onFolderDrop}
            dropTargetId={dropTargetId}
            setDropTargetId={setDropTargetId}
          />
        ))}
      </div>
      {favoriteFolders.length > FAVORITES_VISIBLE_CAP && (
        <ShowMoreButton
          expanded={showAll}
          total={favoriteFolders.length}
          onClick={() => setShowAll((v) => !v)}
        />
      )}
    </section>
  );
}

function RecentFoldersExtra({
  route, recentFolders, onFolderDrop,
}: SidebarExtrasProps) {
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  if (recentFolders.length === 0) return null;
  return (
    <section>
      <SectionHeader label="Recent folders" />
      <ul className="space-y-0.5">
        {recentFolders.map((folder) => (
          <li key={folder.id}>
            <FolderRow
              folder={folder}
              active={route.view === "drive" && route.folderId === folder.id}
              onFolderDrop={onFolderDrop}
              dropTargetId={dropTargetId}
              setDropTargetId={setDropTargetId}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
