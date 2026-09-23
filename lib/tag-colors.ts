/** Preset tag colors — 12 options with light/dark styling */
export interface TagColorPreset {
  id: string;
  hex: string;
  pill: string;
  dot: string;
}

export const TAG_COLORS: TagColorPreset[] = [
  { id: "red", hex: "#ef4444", pill: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300", dot: "bg-red-500" },
  { id: "orange", hex: "#f97316", pill: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300", dot: "bg-orange-500" },
  { id: "amber", hex: "#f59e0b", pill: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300", dot: "bg-amber-500" },
  { id: "yellow", hex: "#eab308", pill: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-300", dot: "bg-yellow-500" },
  { id: "lime", hex: "#84cc16", pill: "bg-lime-100 text-lime-800 dark:bg-lime-950/50 dark:text-lime-300", dot: "bg-lime-500" },
  { id: "green", hex: "#22c55e", pill: "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300", dot: "bg-green-500" },
  { id: "teal", hex: "#14b8a6", pill: "bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300", dot: "bg-teal-500" },
  { id: "cyan", hex: "#06b6d4", pill: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300", dot: "bg-cyan-500" },
  { id: "blue", hex: "#3b82f6", pill: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300", dot: "bg-blue-500" },
  { id: "indigo", hex: "#6366f1", pill: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300", dot: "bg-indigo-500" },
  { id: "purple", hex: "#a855f7", pill: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300", dot: "bg-purple-500" },
  { id: "pink", hex: "#ec4899", pill: "bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300", dot: "bg-pink-500" },
  { id: "zinc", hex: "#71717a", pill: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300", dot: "bg-zinc-400" },
];

export const TAG_ICONS = [
  "tag", "star", "briefcase", "home", "book", "flag", "heart", "zap",
] as const;

export type TagIconId = (typeof TAG_ICONS)[number];

export function getTagColor(id: string): TagColorPreset {
  return TAG_COLORS.find((c) => c.id === id) ?? TAG_COLORS[8];
}

const TAG_TEXT: Record<string, string> = {
  red: "text-red-500",
  orange: "text-orange-500",
  amber: "text-amber-500",
  yellow: "text-yellow-600",
  lime: "text-lime-600",
  green: "text-green-600",
  teal: "text-teal-600",
  cyan: "text-cyan-600",
  blue: "text-blue-500",
  indigo: "text-indigo-500",
  purple: "text-purple-500",
  pink: "text-pink-500",
  zinc: "text-zinc-500",
};

const TAG_BG_SOFT: Record<string, string> = {
  red: "bg-red-50 dark:bg-red-950/40",
  orange: "bg-orange-50 dark:bg-orange-950/40",
  amber: "bg-amber-50 dark:bg-amber-950/40",
  yellow: "bg-yellow-50 dark:bg-yellow-950/40",
  lime: "bg-lime-50 dark:bg-lime-950/40",
  green: "bg-green-50 dark:bg-green-950/40",
  teal: "bg-teal-50 dark:bg-teal-950/40",
  cyan: "bg-cyan-50 dark:bg-cyan-950/40",
  blue: "bg-blue-50 dark:bg-blue-950/40",
  indigo: "bg-indigo-50 dark:bg-indigo-950/40",
  purple: "bg-purple-50 dark:bg-purple-950/40",
  pink: "bg-pink-50 dark:bg-pink-950/40",
  zinc: "bg-zinc-100 dark:bg-zinc-800/60",
};

export function getTagTextClass(id: string): string {
  return TAG_TEXT[id] ?? TAG_TEXT.blue;
}

export function getTagBgSoft(id: string): string {
  return TAG_BG_SOFT[id] ?? TAG_BG_SOFT.blue;
}

export function defaultTagColorId(): string {
  return TAG_COLORS[8].id;
}
