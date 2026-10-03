/** Where a dragged row lands. `to` is an index in the list after the move. */
export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Index under the pointer. A row whose center is above the dragged center
 * stays above the gap, so the gap opens between two modules instead of
 * jumping a whole row past them.
 */
export function dropIndex(from: number, translationY: number, rowHeight: number, count: number): number {
  "worklet";
  if (count <= 1 || rowHeight <= 0) return Math.max(0, Math.min(Math.max(count - 1, 0), from));
  const center = from * rowHeight + translationY + rowHeight / 2;
  let next = 0;
  for (let i = 0; i < count; i++) {
    if (i === from) continue;
    if (i * rowHeight + rowHeight / 2 < center) next += 1;
  }
  if (next < 0) return 0;
  if (next > count - 1) return count - 1;
  return next;
}

/** How far another row shifts, in row heights, to open the landing gap. */
export function shiftFor(index: number, from: number, hover: number): number {
  "worklet";
  if (from < 0 || hover < 0 || index === from || from === hover) return 0;
  if (from < hover && index > from && index <= hover) return -1;
  if (hover < from && index >= hover && index < from) return 1;
  return 0;
}
