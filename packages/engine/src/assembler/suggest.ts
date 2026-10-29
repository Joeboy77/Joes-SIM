/** Edit distance between two strings (insertions, deletions, substitutions, transpositions). */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const row = d[i] as number[];
      const above = d[i - 1] as number[];
      let best = Math.min(
        (above[j] as number) + 1,
        (row[j - 1] as number) + 1,
        (above[j - 1] as number) + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, ((d[i - 2] as number[])[j - 2] as number) + 1);
      }
      row[j] = best;
    }
  }
  return (d[a.length] as number[])[b.length] as number;
}

/**
 * The closest candidate, if it is close enough to be a likely typo. A case-only difference
 * always counts as close.
 */
export function closest(word: string, candidates: Iterable<string>): string | undefined {
  let best: string | undefined;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    if (candidate.toLowerCase() === word.toLowerCase()) return candidate;
    const distance = editDistance(word.toLowerCase(), candidate.toLowerCase());
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  // Very short words are too easy to confuse, so only suggest exact case-only matches for them.
  const limit = word.length <= 2 ? 0 : word.length <= 4 ? 1 : 2;
  return bestDistance <= limit ? best : undefined;
}
