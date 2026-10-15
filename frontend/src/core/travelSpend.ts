import { monthKey } from "./format";
import { isPersonalTrip, transitLabel } from "./transit";
import type { DB, TransitKind } from "./types";

const KINDS: TransitKind[] = ["metro", "train", "cab", "bus"];

export function transitTileId(kind: TransitKind): string {
  return `transit-${kind}`;
}

const TILE_KIND: Record<string, TransitKind> = {
  transitmetro: "metro",
  transittrain: "train",
  transitcab: "cab",
  transitbus: "bus",
};

export function parseTransitTileId(id: string): TransitKind | null {
  return TILE_KIND[id] ?? null;
}

function noteMatchesTransit(note: string, kind: TransitKind): boolean {
  const hay = note.toLowerCase();
  const label = transitLabel(kind).toLowerCase();
  if (hay.includes(label)) return true;
  if (kind === "cab" && (hay.includes("taxi") || hay.includes("uber") || hay.includes("ola"))) return true;
  return false;
}

/** Public transport spend for one month. Fuel and personal vehicle costs stay out. */
export function publicTransitSpend(db: DB, month: string, kind?: TransitKind): number {
  const hasPublicTrip = db.trips.some((trip) => !isPersonalTrip(trip));
  return db.txns
    .filter((t) => t.type === "expense" && !t.transfer && monthKey(t.date) === month)
    .filter((t) => t.category === "Travel" || (hasPublicTrip && t.category !== "Fuel" && t.category !== "Vehicle"))
    .filter((t) => {
      if (t.category === "Fuel" || t.category === "Vehicle") return false;
      const note = t.note ?? "";
      if (!kind) {
        return KINDS.some((k) => noteMatchesTransit(note, k)) || (hasPublicTrip && t.category === "Travel");
      }
      return noteMatchesTransit(note, kind);
    })
    .reduce((sum, row) => sum + row.amount, 0);
}

/** Fuel logged for named vehicles. Not used on the Travel board. */
export function vehicleFuelSpendMonth(db: DB, month: string): number {
  const vehicleIds = new Set(db.vehicles.map((v) => v.id));
  return db.fuel
    .filter((row) => vehicleIds.has(row.vehicleId) && monthKey(row.date) === month)
    .reduce((sum, row) => sum + row.total, 0);
}

export function transitSpendLine(db: DB, month: string, kind: TransitKind): string {
  const amount = publicTransitSpend(db, month, kind);
  if (amount <= 0) return `No ${transitLabel(kind).toLowerCase()} yet`;
  return `${transitLabel(kind)} · ${amount}`;
}
