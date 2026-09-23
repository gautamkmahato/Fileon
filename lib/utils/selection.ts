export function computeSelection(
  id: string,
  orderedIds: string[],
  selectedIds: Set<string>,
  lastSelectedId: string | null,
  opts: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }
): { selectedIds: Set<string>; lastSelectedId: string } {
  const additive = opts.metaKey || opts.ctrlKey;

  if (opts.shiftKey && lastSelectedId) {
    const a = orderedIds.indexOf(lastSelectedId);
    const b = orderedIds.indexOf(id);
    if (a >= 0 && b >= 0) {
      const [start, end] = a < b ? [a, b] : [b, a];
      const next = new Set(selectedIds);
      for (let i = start; i <= end; i++) next.add(orderedIds[i]);
      return { selectedIds: next, lastSelectedId: id };
    }
  }

  if (additive) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return { selectedIds: next, lastSelectedId: id };
  }

  return { selectedIds: new Set([id]), lastSelectedId: id };
}
