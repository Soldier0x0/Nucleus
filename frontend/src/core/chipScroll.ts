/** Horizontal offset that puts a chip in view, centered when the row has room. */
export function chipScrollX(chipX: number, chipW: number, viewW: number, contentW: number): number {
  const max = Math.max(0, contentW - viewW);
  if (viewW <= 0) return 0;
  const centered = chipX - (viewW - chipW) / 2;
  if (centered <= 0) return 0;
  if (centered >= max) return max;
  return centered;
}

/** Jump on the first layout. Later selection changes ease, unless motion is reduced. */
export function chipScrollAnimated(previous: number | null, next: number, reducedMotion: boolean): boolean {
  return previous !== null && previous !== next && !reducedMotion;
}
