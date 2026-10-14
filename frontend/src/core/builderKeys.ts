// Short formula names for Builder inputs (a, b, … z, then k26, k27, …).

/** The next short name not already used, scanning forward from `cursor`. */
export function nextInputKey(used: Iterable<string>, cursor: number): { key: string; cursor: number } {
  const taken = new Set(used);
  for (let n = Math.max(0, cursor); ; n++) {
    const key = n < 26 ? String.fromCharCode(97 + n) : `k${n}`;
    if (!taken.has(key)) return { key, cursor: n + 1 };
  }
}

/** Short names that appear more than once, each listed once. */
export function duplicateKeys(keys: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const k of keys) (seen.has(k) ? dup : seen).add(k);
  return [...dup];
}
