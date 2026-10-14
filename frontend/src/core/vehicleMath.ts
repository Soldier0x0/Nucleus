import type { FuelEntry, FuelFillKind, Vehicle } from "./types";

export function costPerKmLine(perKm: number, unit: "km" | "mi"): string | null {
  if (!Number.isFinite(perKm)) return null;
  const shown = Math.round(perKm * 100) / 100;
  return `${shown} per ${unit}`;
}

/** @deprecated Misleading tank fraction — kept for tests only. */
export function fuelAgainstTank(litres: number, tankLitres: number): { litres: number; tank: number; line: string } {
  const litresShown = Math.round(litres * 10) / 10;
  const tankShown = Math.round(tankLitres * 10) / 10;
  return { litres: litresShown, tank: tankShown, line: `${litresShown} L of a ${tankShown} L tank` };
}

export function serviceLeftLine(km: number): string {
  const left = Math.round(km);
  if (left <= 0) return `${-left} km past service`;
  return `${left} km to service`;
}

export function fillKindOf(entry: FuelEntry): FuelFillKind {
  return entry.fillKind === "partial" ? "partial" : "full";
}

function sortFuel(entries: FuelEntry[]): FuelEntry[] {
  return [...entries].sort((a, b) => {
    const ad = a.loggedAt ?? `${a.date}T00:00:00`;
    const bd = b.loggedAt ?? `${b.date}T00:00:00`;
    if (ad !== bd) return ad.localeCompare(bd);
    return a.odometer - b.odometer;
  });
}

/** Mileage points from full-to-full chains; partial fills do not start a segment. */
export function fuelMileagePoints(entries: FuelEntry[]): { date: string; value: number }[] {
  const sorted = sortFuel(entries);
  const out: { date: string; value: number }[] = [];
  let anchor: FuelEntry | null = null;
  for (const row of sorted) {
    if (fillKindOf(row) !== "full") continue;
    if (anchor) {
      const dist = row.odometer - anchor.odometer;
      if (dist > 0 && row.litres > 0) out.push({ date: row.date, value: dist / row.litres });
    }
    anchor = row;
  }
  return out;
}

/** Range estimate after a full fill when tank size and average km/L are known. */
export function rangeAfterFullLine(avgKmPerL: number, tankLitres: number, unit: "km" | "mi"): string | null {
  if (!Number.isFinite(avgKmPerL) || avgKmPerL <= 0 || !Number.isFinite(tankLitres) || tankLitres <= 0) return null;
  const km = Math.round(avgKmPerL * tankLitres);
  return unit === "mi" ? `≈ ${Math.round(km * 0.621)} mi range` : `≈ ${km} km range`;
}

export function lastFullFill(entries: FuelEntry[]): FuelEntry | undefined {
  const sorted = sortFuel(entries);
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (fillKindOf(sorted[i]) === "full") return sorted[i];
  }
  return undefined;
}

export function fuelFillSummary(entry: FuelEntry): string {
  return fillKindOf(entry) === "partial" ? "Partial fill" : "Full tank";
}

export function motorPolicyBadges(motor: { rsaAddOn?: boolean; zeroDepAddOn?: boolean } | undefined): string[] {
  if (!motor) return [];
  const badges: string[] = [];
  if (motor.rsaAddOn) badges.push("RSA");
  if (motor.zeroDepAddOn) badges.push("ZeroDep");
  return badges;
}
