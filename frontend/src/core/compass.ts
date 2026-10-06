const MARKS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
const WORDS = ["North", "Northeast", "East", "Southeast", "South", "Southwest", "West", "Northwest"] as const;

export type Cardinal = (typeof MARKS)[number];

export type Heading = {
  degrees: number;
  cardinal: Cardinal;
  word: (typeof WORDS)[number];
};

/** Horizontal field, in microteslas, below which a heading would be a guess. */
const MIN_FIELD = 8;

/**
 * Degrees clockwise from north for the top of a phone held flat.
 * x points to the right of the phone, y toward the top, both in microteslas.
 */
export function headingFromField(x: number, y: number): Heading | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (Math.hypot(x, y) < MIN_FIELD) return null;
  const raw = (Math.atan2(-x, y) * 180) / Math.PI;
  const degrees = Math.round((raw + 360) % 360) % 360;
  const index = Math.round(degrees / 45) % 8;
  const cardinal = MARKS[index];
  const word = WORDS[index];
  if (!cardinal || !word) return null;
  return { degrees, cardinal, word };
}

/** Next dial angle along the short arc, so a turn across north does not spin the long way. */
export function headingTurn(from: number, to: number): number {
  const delta = ((to - from + 540) % 360) - 180;
  return from + delta;
}
