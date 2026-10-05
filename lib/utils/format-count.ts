/** Compact display for large integers (e.g. 1.2k, 15k). */
export function formatCompactCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  if (n < 1000) return String(n);
  const k = n / 1000;
  if (k < 10) {
    const rounded = Math.round(k * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded}k` : `${rounded}k`;
  }
  if (k < 1000) {
    return `${Math.round(k)}k`;
  }
  const m = n / 1_000_000;
  if (m < 10) {
    const rounded = Math.round(m * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded}m` : `${rounded}m`;
  }
  return `${Math.round(m)}m`;
}
