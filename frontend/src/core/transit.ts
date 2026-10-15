import type { TransitKind, TripMode } from "./types";

export type { TransitKind, TripMode };

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
    default: {
      const never: never = kind;
      return never;
    }
  }
}

export function isPersonalTrip(trip: { mode?: TripMode }): boolean {
  return trip.mode !== "public";
}

export function transitExpense(amount: number, transit: TransitKind, date: string): { type: "expense"; amount: number; category: "Travel"; date: string; note: string } {
  return { type: "expense", amount, category: "Travel", date, note: transitLabel(transit) };
}
