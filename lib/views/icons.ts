import type { LucideIcon } from "lucide-react";
import {
  Bookmark, FileText, Folder, Star, Tag, Clock, Filter, Layers, Search,
} from "lucide-react";

export type ViewIconId =
  | "bookmark"
  | "file"
  | "folder"
  | "star"
  | "tag"
  | "clock"
  | "filter"
  | "layers"
  | "search";

export const VIEW_ICONS: Array<{ id: ViewIconId; label: string; Icon: LucideIcon }> = [
  { id: "bookmark", label: "Bookmark", Icon: Bookmark },
  { id: "file", label: "Document", Icon: FileText },
  { id: "folder", label: "Folder", Icon: Folder },
  { id: "star", label: "Star", Icon: Star },
  { id: "tag", label: "Tag", Icon: Tag },
  { id: "clock", label: "Clock", Icon: Clock },
  { id: "filter", label: "Filter", Icon: Filter },
  { id: "layers", label: "Layers", Icon: Layers },
  { id: "search", label: "Search", Icon: Search },
];

export function getViewIcon(id?: ViewIconId): LucideIcon {
  return VIEW_ICONS.find((i) => i.id === id)?.Icon ?? Bookmark;
}
