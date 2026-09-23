const KEY = "drive_recent_searches";
const MAX = 8;

export function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

export function addRecentSearch(query: string): void {
  const q = query.trim();
  if (!q) return;
  const prev = getRecentSearches().filter((s) => s !== q);
  localStorage.setItem(KEY, JSON.stringify([q, ...prev].slice(0, MAX)));
}
