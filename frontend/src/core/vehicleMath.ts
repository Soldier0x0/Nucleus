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
  if (entry.fillKind === "empty") return "empty";
  return entry.fillKind === "partial" ? "partial" : "full";
}

const LEVEL_FRACTION: Record<string, number> = { reserve: 0.1, quarter: 0.25, half: 0.5, "three-quarter": 0.75 };

function sortFuel(entries: FuelEntry[]): FuelEntry[] {
  return [...entries].sort((a, b) => {
    const ad = a.loggedAt ?? `${a.date}T00:00:00`;
    const bd = b.loggedAt ?? `${b.date}T00:00:00`;
    if (ad !== bd) return ad.localeCompare(bd);
    return a.odometer - b.odometer;
  });
}

/**
 * Mileage points across tank landmarks (v0.12 model). A landmark is a brim
 * ("to my usual full") or a dry tank ("was empty before this"). Consumed
 * kilometres / litres work through a cycle: partial fills and extra cans all
 * count their litres, the distance comes only from the readings at the two
 * landmarks.
 */
export function fuelMileagePoints(entries: FuelEntry[]): { date: string; value: number }[] {
  const sorted = sortFuel(entries);
  const out: { date: string; value: number }[] = [];
  let anchor: FuelEntry | null = null;
  let litres = 0;
  for (const row of sorted) {
    const kind = fillKindOf(row);
    if (!anchor) {
      anchor = row;
      litres = kind === "empty" ? row.litres : 0;
      continue;
    }
    litres += row.litres;
    if (kind === "partial") continue;
    const dist = row.odometer - anchor.odometer;
    if (dist > 0 && litres > 0) out.push({ date: row.date, value: dist / litres });
    anchor = row;
    litres = kind === "empty" ? row.litres : 0;
  }
  return out;
}

/** Usable tank learned from level-chip fills, e.g. a ¾ partial toned to brim. */
export function usableTankEstimate(entries: FuelEntry[]): number | undefined {
  const sorted = sortFuel(entries);
  const candidates: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i];
    if (fillKindOf(row) !== "partial" || !row.levelChip) continue;
    const fraction = LEVEL_FRACTION[row.levelChip];
    if (!fraction) continue;
    let pumped = row.litres;
    for (let j = i + 1; j < sorted.length; j++) {
      pumped += sorted[j].litres;
      if (fillKindOf(sorted[j]) === "full" || fillKindOf(sorted[j]) === "empty") break;
    }
    const estimate = pumped / Math.max(0.25, 1 - fraction);
    if (Number.isFinite(estimate) && estimate >= 3 && estimate <= 90) candidates.push(estimate);
  }
  if (!candidates.length) return undefined;
  const sortedCandidates = [...candidates].sort((a, b) => a - b);
  const mid = Math.floor(sortedCandidates.length / 2);
  return Math.round(sortedCandidates.length % 2 === 1 ? sortedCandidates[mid] : (sortedCandidates[mid - 1] + sortedCandidates[mid]) / 2);
}

/**
 * "Missed a fill?" — the cycle ladder tells a lie when a pump stop went
 * unlogged: one cycle drinks far more than the shape of the rest, or two
 * landmarks sit beyond what the tank can span.
 */
export function missedFillHint(entries: FuelEntry[], tankLitres?: number): string | null {
  const points = fuelMileagePoints(entries);
  if (points.length < 2) return null;
  const last = points[points.length - 1].value;
  const historic = points.slice(0, -1).map((p) => p.value).sort((a, b) => a - b);
  const mid = Math.floor(historic.length / 2);
  const median = historic.length % 2 === 1 ? historic[mid] : (historic[mid - 1] + historic[mid]) / 2;
  if (median > 0 && last > median * 2.2) return "Missed a fill?";
  if (tankLitres && Number.isFinite(tankLitres) && tankLitres > 0 && median > 0) {
    const span = pointsSpan(entries);
    if (span != null && span > tankLitres * median * 0.9) return "Missed a fill?";
  }
  return null;
}

function pointsSpan(entries: FuelEntry[]): number | undefined {
  const sorted = sortFuel(entries);
  const anchors = sorted.filter((row) => fillKindOf(row) !== "partial").map((row) => row.odometer);
  if (anchors.length < 2) return undefined;
  let widest = 0;
  for (let i = 1; i < anchors.length; i++) widest = Math.max(widest, anchors[i] - anchors[i - 1]);
  return widest;
}

/** Infobox for the tank size. Level-chip learning wins over the machine spec. */
export function tankCapacityLine(entries: FuelEntry[], tankLitres?: number): string | null {
  const learned = usableTankEstimate(entries);
  const size = learned ?? (Number.isFinite(tankLitres) && tankLitres ? tankLitres : undefined);
  if (!size) return null;
  return `Tank ≈ ${Math.round(size)} L${learned ? " · learned from your fills" : ""}`;
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
    const kind = fillKindOf(sorted[i]);
    if (kind === "full" || kind === "empty") return sorted[i];
  }
  return undefined;
}

export function fuelFillSummary(entry: FuelEntry): string {
  const kind = fillKindOf(entry);
  if (kind === "empty") return "From empty";
  return kind === "partial" ? "Partial fill" : "Full tank";
}

export function motorPolicyBadges(motor: { rsaAddOn?: boolean; zeroDepAddOn?: boolean } | undefined): string[] {
  if (!motor) return [];
  const badges: string[] = [];
  if (motor.rsaAddOn) badges.push("RSA");
  if (motor.zeroDepAddOn) badges.push("ZeroDep");
  return badges;
}
