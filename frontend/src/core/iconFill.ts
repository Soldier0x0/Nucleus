/**
 * The home-screen mark fills the masked circle.
 * Android still crops the bitmap. The ground is opaque, so this is not a transparent icon.
 */
export const MARK_CANVAS = 100;
/** Outer edge of the ring, in the same units as MARK_CANVAS. */
export const MARK_OUTER_RADIUS = 47;
export const ICON_GROUND_OPAQUE = true;
export const ICON_CLAIMS_FULL_TRANSPARENCY = false;

export function markFillRatio(): number {
  return (MARK_OUTER_RADIUS * 2) / MARK_CANVAS;
}
