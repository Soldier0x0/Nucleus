import type { DB, FuelEntry, Vehicle } from "./types";
import { daysBetween, num, todayISO } from "./format";

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

const isoDay = (raw: string | undefined): string | null =>
  typeof raw === "string" && /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null;

/** Typed odometer readings from fill-ups, odometer logs and services, oldest first. */
export function odometerReadings(db: DB, vehicle: Vehicle): { date: string; odometer: number; source: "fuel" | "log" | "service" }[] {
  const rows: { date: string; odometer: number; source: "fuel" | "log" | "service" }[] = [];
  for (const fill of db.fuel) {
    const date = isoDay(fill.date);
    if (fill.vehicleId !== vehicle.id || fill.odometerEstimated || !date || !Number.isFinite(fill.odometer)) continue;
    rows.push({ date, odometer: fill.odometer, source: "fuel" });
  }
  for (const log of db.odometerLogs) {
    const date = isoDay(log.at);
    if (log.vehicleId !== vehicle.id || !date || !Number.isFinite(log.odometer)) continue;
    rows.push({ date, odometer: log.odometer, source: "log" });
  }
  for (const service of db.services) {
    const date = isoDay(service.date);
    if (service.vehicleId !== vehicle.id || !date || !Number.isFinite(service.odometer)) continue;
    rows.push({ date, odometer: service.odometer, source: "service" });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.odometer - b.odometer);
}

export type OdometerNow = {
  value: number;
  estimated: boolean;
  stale: boolean;
  daysAgo: number;
  perDay: number;
  lastDate: string | null;
  readings: number;
};

/**
 * Live odometer: the last typed reading plus the average daily km between all typed readings.
 * Estimates while the last reading is at most 30 days old; after that the maths stops and the
 * last known value is marked stale. A reading typed today clears the estimate at once.
 */
export function odometerEstimate(db: DB, vehicle: Vehicle, today = todayISO()): OdometerNow {
  const rows = odometerReadings(db, vehicle);
  const last = rows[rows.length - 1];
  if (!last) {
    return { value: Math.round(vehicle.initialOdometer || 0), estimated: false, stale: false, daysAgo: 0, perDay: 0, lastDate: null, readings: 0 };
  }
  const first = rows[0];
  const span = daysBetween(first.date, last.date);
  const gain = last.odometer - first.odometer;
  const perDay = rows.length >= 2 && span > 0 && gain > 0 ? gain / span : 0;
  const daysAgo = Math.max(0, daysBetween(last.date, today));
  const estimated = perDay > 0 && daysAgo > 0 && daysAgo <= 30;
  return {
    value: estimated ? Math.round(last.odometer + perDay * daysAgo) : Math.round(last.odometer),
    estimated,
    stale: daysAgo > 30,
    daysAgo,
    perDay,
    lastDate: last.date,
    readings: rows.length,
  };
}

/** "12,340", or "~12,340" while the value is projected from earlier readings. */
export const odometerEstimateLabel = (estimate: OdometerNow): string => `${estimate.estimated ? "~" : ""}${num(estimate.value, 0)}`;

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

/** Edit-sheet values -> setFuelFacts patch. A cleared date or blank/invalid odometer is left out. */
export function fuelFactsPatch(date: string, station: string, odoText: string): { date?: string; odometer?: number; station: string } {
  const odometer = Number(odoText);
  return { ...(date ? { date } : {}), station, ...(odoText.trim() && Number.isFinite(odometer) ? { odometer } : {}) };
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

