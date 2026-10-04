/** A full offline map is not part of this release. */
export const OFFLINE_MAP = false;

export type MarkedStop = { id: string; kind: "fuel" | "snack" | "city"; name: string; at: string };

export function timeline(stops: MarkedStop[]): MarkedStop[] {
  return [...stops].sort((a, b) => a.at.localeCompare(b.at) || a.name.localeCompare(b.name));
}

/** Remaining range from your mileage and the last fill. Warn before it runs out. */
export function rangeLeft(mileageKmPerL: number, lastFillLitres: number, drivenKm: number): { remainingKm: number; warn: boolean } {
  const remainingKm = Math.round((mileageKmPerL * lastFillLitres - drivenKm) * 10) / 10;
  return { remainingKm, warn: remainingKm < 50 };
}

/** Kilometers left in the interval you set for this vehicle. */
export function serviceLeft(odometer: number, lastServiceKm: number, intervalKm: number): number {
  return intervalKm - (odometer - lastServiceKm);
}

export function reusableStops(past: MarkedStop[], current: MarkedStop[]): MarkedStop[] {
  const names = new Set(current.map((stop) => stop.name.toLowerCase()));
  const seen = new Set<string>();
  const out: MarkedStop[] = [];
  for (const stop of past) {
    const key = stop.name.toLowerCase();
    if (names.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(stop);
  }
  return out;
}

export function remindSaveWeather(saved: boolean): boolean {
  return !saved;
}

export function weatherReminder(saved: boolean, alreadySent: boolean): boolean {
  return !saved && !alreadySent;
}

export function reuseMarkedStops(past: MarkedStop[], current: MarkedStop[]): MarkedStop[] {
  return reusableStops(past, current);
}

export function weatherAlong(online: boolean, cities: string[]): { available: boolean; cities: string[] } {
  if (!online) return { available: false, cities: [] };
  return { available: true, cities };
}
