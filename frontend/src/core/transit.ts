import type { TransitKind, TripKind, TripMode } from "./types";

export type { TransitKind, TripKind, TripMode };

export const TRANSIT_KINDS: TransitKind[] = ["metro", "train", "cab", "bus", "flight"];

export const isTransitKind = (x: unknown): x is TransitKind => TRANSIT_KINDS.includes(x as TransitKind);

export function transitLabel(kind: TransitKind): string {
  switch (kind) {
    case "metro":
      return "Metro";
    case "train":
      return "Train";
    case "cab":
      return "Cab or taxi";
    case "bus":
      return "Bus";
    case "flight":
      return "Flight";
    default: {
      const never: never = kind;
      return never;
    }
  }
}

export function isPersonalTrip(trip: { mode?: TripMode }): boolean {
  return trip.mode !== "public";
}

/**
 * Journey cards: a trip the person plans and tracks. Clearly daily public travel —
 * a same-day metro, train, cab, bus or flight — stays a Money category only.
 * A hand-picked `kind` (the "Journey" tap) always wins over the dates.
 */
export function tripKindOf(trip: { kind?: TripKind; mode?: TripMode; transit?: TransitKind; start?: string; end?: string }): TripKind {
  if (trip.kind === "journey" || trip.kind === "transit") return trip.kind;
  if (trip.mode === "public" && !!trip.start && trip.start === trip.end) return "transit";
  return "journey";
}

export const isJourneyTrip = (trip: { kind?: TripKind; mode?: TripMode; transit?: TransitKind; start?: string; end?: string }): boolean =>
  tripKindOf(trip) === "journey";

export function transitExpense(amount: number, transit: TransitKind, date: string): { type: "expense"; amount: number; category: "Travel"; date: string; note: string } {
  return { type: "expense", amount, category: "Travel", date, note: transitLabel(transit) };
}
