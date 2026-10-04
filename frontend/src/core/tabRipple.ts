/** A small, short splash so a bottom-bar tap does not leave a large slow circle. */
export function tabRipple(): { radius: number; durationMs: number } {
  return { radius: 16, durationMs: 120 };
}
