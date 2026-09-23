import type { LucideIcon } from "lucide-react";
import {
  Archive, FileImage, FileText, Film, Music,
} from "lucide-react";
import { listFilesByQuery, type DriveListResponse } from "./drive";

export type TypeBrowseCategory = "images" | "videos" | "music" | "documents" | "archives";

export const TYPE_BROWSE_CATEGORIES: TypeBrowseCategory[] = [
  "images", "videos", "music", "documents", "archives",
];

export interface TypeBrowseMeta {
  label: string;
  emptyLabel: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  bgSoft: string;
}

export const TYPE_BROWSE_META: Record<TypeBrowseCategory, TypeBrowseMeta> = {
  images: {
    label: "Images",
    emptyLabel: "No images found",
    icon: FileImage,
    iconBg: "bg-violet-100 dark:bg-violet-950/50",
    iconColor: "text-violet-600 dark:text-violet-400",
    bgSoft: "bg-violet-50 dark:bg-violet-950/40",
  },
  videos: {
    label: "Videos",
    emptyLabel: "No videos found",
    icon: Film,
    iconBg: "bg-pink-100 dark:bg-pink-950/50",
    iconColor: "text-pink-600 dark:text-pink-400",
    bgSoft: "bg-pink-50 dark:bg-pink-950/40",
  },
  music: {
    label: "Music",
    emptyLabel: "No audio files found",
    icon: Music,
    iconBg: "bg-indigo-100 dark:bg-indigo-950/50",
    iconColor: "text-indigo-600 dark:text-indigo-400",
    bgSoft: "bg-indigo-50 dark:bg-indigo-950/40",
  },
  documents: {
    label: "Documents",
    emptyLabel: "No documents found",
    icon: FileText,
    iconBg: "bg-blue-100 dark:bg-blue-950/50",
    iconColor: "text-blue-600 dark:text-blue-400",
    bgSoft: "bg-blue-50 dark:bg-blue-950/40",
  },
  archives: {
    label: "Archives",
    emptyLabel: "No archives found",
    icon: Archive,
    iconBg: "bg-amber-100 dark:bg-amber-950/50",
    iconColor: "text-amber-600 dark:text-amber-400",
    bgSoft: "bg-amber-50 dark:bg-amber-950/40",
  },
};

export function isTypeBrowseCategory(value: string): value is TypeBrowseCategory {
  return (TYPE_BROWSE_CATEGORIES as string[]).includes(value);
}

const DOCUMENT_MIMES = [
  "application/vnd.google-apps.document",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "application/rtf",
  "application/vnd.apple.pages",
] as const;

const NOT_FOLDER = "mimeType != 'application/vnd.google-apps.folder'";

export function buildTypeBrowseQuery(category: TypeBrowseCategory): string {
  const base = "trashed = false and " + NOT_FOLDER;
  switch (category) {
    case "images":
      return `${base} and mimeType contains 'image/'`;
    case "videos":
      return `${base} and mimeType contains 'video/'`;
    case "music":
      return `${base} and mimeType contains 'audio/'`;
    case "documents": {
      const mimeClause = DOCUMENT_MIMES
        .map((m) => `mimeType = '${m}'`)
        .join(" or ");
      return `${base} and (${mimeClause})`;
    }
    case "archives":
      return `${base} and (name contains '.zip' or name contains '.tar' or name contains '.rar' or name contains '.7z' or mimeType = 'application/zip' or mimeType = 'application/x-zip-compressed' or mimeType = 'application/x-7z-compressed' or mimeType = 'application/x-rar-compressed' or mimeType = 'application/gzip')`;
  }
}

export function listFilesByType(
  token: string,
  category: TypeBrowseCategory,
  pageToken?: string,
): Promise<DriveListResponse> {
  return listFilesByQuery({
    token,
    q: buildTypeBrowseQuery(category),
    pageToken,
    pageSize: 50,
    orderBy: "modifiedTime desc",
  });
}
