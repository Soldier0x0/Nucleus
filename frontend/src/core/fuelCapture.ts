import type { DB, FuelEntry, Vehicle } from "./types";
import { daysBetween } from "./format";

export type FuelNumbers = { litres: number; total: number; rate: number };

const round2 = (n: number) => Number(n.toFixed(2));

/** Two of litres, total, and rate fill the third, to 2 decimals. */
export function completeFuelNumbers(bits: { litres?: number; total?: number; rate?: number }): FuelNumbers | null {
  let litres = bits.litres;
  let total = bits.total;
  let rate = bits.rate;
  const ok = (n: number | undefined): n is number => n != null && Number.isFinite(n) && n > 0;
  if ([litres, total, rate].filter(ok).length < 2) return null;
  if (!ok(litres) && ok(total) && ok(rate)) litres = total / rate;
  if (!ok(total) && ok(litres) && ok(rate)) total = litres * rate;
  if (!ok(rate) && ok(litres) && ok(total)) rate = total / litres;
  if (!ok(litres) || !ok(total) || !ok(rate)) return null;
  return { litres: round2(litres), total: round2(total), rate: round2(rate) };
}

export function namedVehicle(db: DB, input: string): Vehicle | null {
  const hay = ` ${input.toLowerCase()} `;
  let best: Vehicle | null = null;
  let bestLen = 0;
  for (const vehicle of db.vehicles) {
    const name = vehicle.name.trim().toLowerCase();
    if (name.length < 2) continue;
    if (!hay.includes(` ${name} `)) continue;
    if (name.length > bestLen) {
      best = vehicle;
      bestLen = name.length;
    }
  }
  return best;
}

export type FuelDraft = {
  vehicle: Vehicle | null;
  numbers: FuelNumbers | null;
  odometer?: number;
  date?: string;
  station?: string;
  fillKind?: "full" | "partial";
  loggedAt?: string;
};

export function parseFuelDraft(db: DB, input: string): FuelDraft | null {
  const raw = input.trim();
  if (!raw) return null;
  const vehicle = namedVehicle(db, raw);
  let rest = raw;
  if (vehicle) rest = rest.replace(new RegExp(vehicle.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ");
  const date = rest.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1];
  if (date) rest = rest.replace(date, " ");
  const time = rest.match(/\b(\d{1,2}):(\d{2})\b/)?.[0];
  let loggedAt: string | undefined;
  if (time && date) {
    const [hh, mm] = time.split(":");
    loggedAt = `${date}T${hh.padStart(2, "0")}:${mm}:00`;
    rest = rest.replace(time, " ");
  }
  const fillKind: "full" | "partial" | undefined = /\b(partial|top[- ]?up|half)\b/i.test(raw)
    ? "partial"
    : /\b(full|full tank|tank full|brim)\b/i.test(raw)
      ? "full"
      : undefined;
  const stationMatch = rest.match(/\b(?:at|station)\s+([A-Za-z][A-Za-z .'-]{0,32})/i);
  const station = stationMatch?.[1]?.trim().replace(/[.'-]+$/, "");
  if (stationMatch && station) rest = rest.replace(stationMatch[0], " ");
  const litres = numberBefore(rest, /\b(\d+(?:\.\d+)?)\s*l\b/i);
  const rate = numberBefore(rest, /\b(\d+(?:\.\d+)?)\s*(?:\/\s*l|per\s*l)\b/i) ?? numberBefore(rest, /@\s*(\d+(?:\.\d+)?)/i);
  const odometer = numberBefore(rest, /\b(\d+(?:\.\d+)?)\s*km\b/i);
  let bare = rest
    .replace(/\b\d+(?:\.\d+)?\s*l\b/gi, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:\/\s*l|per\s*l)\b/gi, " ")
    .replace(/@\s*\d+(?:\.\d+)?/gi, " ")
    .replace(/\b\d+(?:\.\d+)?\s*km\b/gi, " ")
    .replace(/\b(?:fuel|petrol|diesel|cng|at|station|partial|top[- ]?up|full tank|tank full|brim|full|half)\b/gi, " ");
  const nums = [...bare.matchAll(/\b\d+(?:\.\d+)?\b/g)].map((hit) => Number(hit[0])).filter((n) => n > 0);
  let total: number | undefined;
  let odo = odometer;
  if (nums.length === 1) {
    if (litres == null && rate == null && nums[0] >= 1000 && Number.isInteger(nums[0])) odo = nums[0];
    else total = nums[0];
  } else if (nums.length >= 2) {
    const sorted = [...nums].sort((a, b) => b - a);
    if (sorted[0] >= 1000 && Number.isInteger(sorted[0])) {
      odo = odo ?? sorted[0];
      total = sorted[1];
    } else {
      total = sorted[0];
    }
  }
  const numbers = completeFuelNumbers({ litres, total, rate });
  const fuelish = /\b(fuel|petrol|diesel|cng)\b/i.test(raw) || litres != null || rate != null;
  if (!fuelish && !vehicle) return null;
  if (!numbers && !vehicle) return null;
  return {
    vehicle,
    numbers,
    ...(odo != null ? { odometer: odo } : {}),
    ...(date ? { date } : {}),
    ...(station ? { station } : {}),
    ...(fillKind ? { fillKind } : {}),
    ...(loggedAt ? { loggedAt } : {}),
  };
}

function numberBefore(text: string, pattern: RegExp): number | undefined {
  const hit = text.match(pattern);
  if (!hit) return undefined;
  const value = Number(hit[1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export function estimateOdometer(entries: FuelEntry[], vehicle: Vehicle, date?: string): number {
  const known = entries
    .filter((row) => row.vehicleId === vehicle.id && !row.odometerEstimated && row.date)
    .sort((a, b) => a.date.localeCompare(b.date) || a.odometer - b.odometer);
  const last = known[known.length - 1];
  const base = last?.odometer ?? vehicle.initialOdometer;
  if (!date || !last?.date || known.length < 2) return base;
  const prev = known[known.length - 2];
  const span = daysBetween(prev.date, last.date);
  if (span <= 0) return base;
  const perDay = (last.odometer - prev.odometer) / span;
  const ahead = daysBetween(last.date, date);
  if (ahead <= 0) return base;
  return Math.round(base + perDay * ahead);
}

/** Known readings stay. Estimated fills between them are spaced again. */
export function recomputeFuelEstimates(entries: FuelEntry[], vehicleId: string): FuelEntry[] {
  const mine = entries.filter((row) => row.vehicleId === vehicleId);
  const rest = entries.filter((row) => row.vehicleId !== vehicleId);
  const sorted = [...mine].sort((a, b) => {
    if (a.date && b.date && a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return a.id.localeCompare(b.id);
  });
  const knownAt = sorted.map((row, index) => (row.odometerEstimated ? -1 : index)).filter((index) => index >= 0);
  const next = sorted.map((row) => ({ ...row }));
  for (let k = 0; k < knownAt.length - 1; k++) {
    const left = knownAt[k];
    const right = knownAt[k + 1];
    const gap = right - left;
    if (gap <= 1) continue;
    const start = next[left].odometer;
    const end = next[right].odometer;
    for (let step = 1; step < gap; step++) {
      if (!next[left + step].odometerEstimated) continue;
      next[left + step].odometer = Math.round(start + ((end - start) * step) / gap);
    }
  }
  return [...rest, ...next];
}

export function setFuelFacts(db: DB, id: string, patch: { date?: string; odometer?: number; station?: string }): DB {
  let vehicleId = "";
  const fuel = db.fuel.map((row) => {
    if (row.id !== id) return row;
    vehicleId = row.vehicleId;
    const next: FuelEntry = { ...row };
    if (patch.date !== undefined) next.date = patch.date;
    if (patch.station !== undefined) next.station = patch.station.trim() || undefined;
    if (patch.odometer !== undefined && Number.isFinite(patch.odometer)) {
      next.odometer = Math.round(patch.odometer);
      next.odometerEstimated = false;
    }
    return next;
  });
  return { ...db, fuel: vehicleId ? recomputeFuelEstimates(fuel, vehicleId) : fuel };
}

