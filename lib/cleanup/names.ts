/** Strip extension, copy suffixes, and version tokens so related files bucket together. */
export function normalizeCleanupName(name: string): string {
  const trimmed = (name ?? "").trim().toLowerCase();
  if (!trimmed) return "";

  const withoutExt = trimmed.replace(/\.[a-z0-9]{1,8}$/i, "");
  const stripped = withoutExt
    .replace(/[\s._-]*copy(\s*\(\d+\))?$/i, "")
    .replace(/[\s._-]*copie$/i, "")
    .replace(/[\s._-]*\(\d+\)$/g, "")
    .replace(/[\s._-]*\[\d+\]$/g, "")
    .replace(/[\s._-]*(final|draft|wip|backup|old|new)$/i, "")
    .replace(/[\s._-]*v(ersion)?[\s._-]*\d+(\.\d+)*$/i, "")
    .replace(/[\s._-]*\d{4}[-_]\d{2}[-_]\d{2}$/g, "");

  return stripped.replace(/[^a-z0-9]+/g, "") || withoutExt.replace(/[^a-z0-9]+/g, "");
}

export function fileExtension(name: string): string {
  const match = (name ?? "").trim().toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  return match ? match[1] : "";
}

export function levenshtein(a: string, b: string): number {
  const left = a.slice(0, 64);
  const right = b.slice(0, 64);
  if (left === right) return 0;
  const rows = left.length;
  const cols = right.length;
  if (!rows) return cols;
  if (!cols) return rows;

  const prev = new Array<number>(cols + 1);
  const next = new Array<number>(cols + 1);
  for (let j = 0; j <= cols; j++) prev[j] = j;

  for (let i = 1; i <= rows; i++) {
    next[0] = i;
    const ca = left.charCodeAt(i - 1);
    for (let j = 1; j <= cols; j++) {
      const cost = ca === right.charCodeAt(j - 1) ? 0 : 1;
      next[j] = Math.min(next[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= cols; j++) prev[j] = next[j];
  }
  return prev[cols];
}

export function nameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const max = Math.max(a.length, b.length);
  if (!max) return 0;
  return 1 - levenshtein(a, b) / max;
}
