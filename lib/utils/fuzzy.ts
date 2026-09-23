/** Simple fuzzy match — returns score > 0 if query matches, higher = better. */
export function fuzzyScore(text: string, query: string): number {
  const t = text.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 1;
  if (t.includes(q)) return 100 + (100 - t.indexOf(q));

  let ti = 0;
  let score = 0;
  let consecutive = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    let found = false;
    while (ti < t.length) {
      if (t[ti] === ch) {
        score += 10 + consecutive * 5;
        consecutive++;
        ti++;
        found = true;
        break;
      }
      consecutive = 0;
      ti++;
    }
    if (!found) return 0;
  }
  return score;
}

export function fuzzyFilter<T>(items: T[], query: string, getText: (item: T) => string): T[] {
  if (!query.trim()) return items;
  return items
    .map((item) => ({ item, score: fuzzyScore(getText(item), query) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item);
}
