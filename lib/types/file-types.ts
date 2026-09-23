import {
  FileText,
  FileSpreadsheet,
  Presentation,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileCode,
  FileQuestion,
  Folder,
  type LucideIcon,
} from "lucide-react";

export interface FileTypeInfo {
  icon: LucideIcon;
  label: string;
  /** Color tokens — designed to match a Figma-style bold-icon look. */
  tint: string;       // text color for the icon
  bg: string;         // background color of the icon tile (cards)
  rowTint: string;    // text color for the smaller icon in list rows
  rowBg: string;      // background of the icon tile in list rows
}

const TYPE_MAP: Record<string, FileTypeInfo> = {
  // Folder
  "application/vnd.google-apps.folder": {
    icon: Folder, label: "Folder",
    tint: "text-orange-500", bg: "bg-transparent",
    rowTint: "text-orange-500", rowBg: "bg-orange-50",
  },

  // Google native
  "application/vnd.google-apps.document": {
    icon: FileText, label: "Google Doc",
    tint: "text-white", bg: "bg-blue-500",
    rowTint: "text-blue-600", rowBg: "bg-blue-50",
  },
  "application/vnd.google-apps.spreadsheet": {
    icon: FileSpreadsheet, label: "Google Sheet",
    tint: "text-white", bg: "bg-emerald-500",
    rowTint: "text-emerald-600", rowBg: "bg-emerald-50",
  },
  "application/vnd.google-apps.presentation": {
    icon: Presentation, label: "Google Slides",
    tint: "text-white", bg: "bg-orange-500",
    rowTint: "text-orange-600", rowBg: "bg-orange-50",
  },
  "application/vnd.google-apps.form": {
    icon: FileQuestion, label: "Google Form",
    tint: "text-white", bg: "bg-violet-500",
    rowTint: "text-violet-600", rowBg: "bg-violet-50",
  },

  // MS Office
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    icon: FileText, label: "Word",
    tint: "text-white", bg: "bg-blue-600",
    rowTint: "text-blue-600", rowBg: "bg-blue-50",
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    icon: FileSpreadsheet, label: "Excel",
    tint: "text-white", bg: "bg-emerald-600",
    rowTint: "text-emerald-700", rowBg: "bg-emerald-50",
  },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    icon: Presentation, label: "PowerPoint",
    tint: "text-white", bg: "bg-orange-600",
    rowTint: "text-orange-700", rowBg: "bg-orange-50",
  },

  // PDF & docs
  "application/pdf": {
    icon: FileText, label: "PDF",
    tint: "text-white", bg: "bg-red-500",
    rowTint: "text-red-600", rowBg: "bg-red-50",
  },
  "text/plain": {
    icon: FileText, label: "Text",
    tint: "text-zinc-600", bg: "bg-zinc-100",
    rowTint: "text-zinc-600", rowBg: "bg-zinc-100",
  },
  "text/markdown": {
    icon: FileText, label: "Markdown",
    tint: "text-zinc-700", bg: "bg-zinc-100",
    rowTint: "text-zinc-700", rowBg: "bg-zinc-100",
  },
  "application/zip": {
    icon: FileArchive, label: "Zip",
    tint: "text-white", bg: "bg-amber-500",
    rowTint: "text-amber-700", rowBg: "bg-amber-50",
  },
  "image/svg+xml": {
    icon: FileImage, label: "SVG",
    tint: "text-white", bg: "bg-fuchsia-500",
    rowTint: "text-fuchsia-600", rowBg: "bg-fuchsia-50",
  },
};

export function getFileType(mimeType: string): FileTypeInfo {
  const exact = TYPE_MAP[mimeType];
  if (exact) return exact;

  if (mimeType.startsWith("image/")) {
    return {
      icon: FileImage, label: "Image",
      tint: "text-white", bg: "bg-violet-400",
      rowTint: "text-violet-600", rowBg: "bg-violet-50",
    };
  }
  if (mimeType.startsWith("video/")) {
    return {
      icon: FileVideo, label: "Video",
      tint: "text-white", bg: "bg-pink-500",
      rowTint: "text-pink-600", rowBg: "bg-pink-50",
    };
  }
  if (mimeType.startsWith("audio/")) {
    return {
      icon: FileAudio, label: "Audio",
      tint: "text-white", bg: "bg-indigo-500",
      rowTint: "text-indigo-600", rowBg: "bg-indigo-50",
    };
  }
  if (mimeType.startsWith("text/") || mimeType.includes("javascript") || mimeType.includes("typescript") || mimeType.includes("json")) {
    return {
      icon: FileCode, label: "Code",
      tint: "text-white", bg: "bg-cyan-600",
      rowTint: "text-cyan-700", rowBg: "bg-cyan-50",
    };
  }
  return {
    icon: FileQuestion, label: "File",
    tint: "text-zinc-500", bg: "bg-zinc-100",
    rowTint: "text-zinc-500", rowBg: "bg-zinc-100",
  };
}

/** Colored folder card tints, cycled by index so the folders row looks alive. */
export const FOLDER_TINTS = [
  { bg: "bg-violet-100", icon: "text-violet-600" },
  { bg: "bg-orange-100", icon: "text-orange-500" },
  { bg: "bg-emerald-100", icon: "text-emerald-600" },
  { bg: "bg-rose-100", icon: "text-rose-500" },
  { bg: "bg-sky-100", icon: "text-sky-600" },
  { bg: "bg-amber-100", icon: "text-amber-600" },
];