import type { DB, ServiceEntry, Vehicle } from "./types";

/** Every part that can have its own service interval (Phase 6, spec A). */
export const PART_IDS = ["engine_oil", "oil_filter", "air_filter", "chain_sprocket", "chain_lube", "brake_pads", "disc_care", "brake_fluid", "clutch", "coolant", "spark_plug", "tyres", "battery"] as const;
export type PartId = (typeof PART_IDS)[number];
export type PartSetting = { id: PartId; on: boolean; everyKm: number; everyMonths: number };

export const PART_LABEL: Record<PartId, string> = {
  engine_oil: "Engine oil",
  oil_filter: "Oil filter",
  air_filter: "Air filter",
  chain_sprocket: "Chain + sprocket",
  chain_lube: "Chain lube",
  brake_pads: "Brake pads",
  disc_care: "Disc lube + cleaner",
  brake_fluid: "Brake fluid",
  clutch: "Clutch",
  coolant: "Coolant",
  spark_plug: "Spark plug",
  tyres: "Tyres",
  battery: "Battery",
};

// [km, months]; null = off by default for that vehicle type.
const BIKE: Record<PartId, [number, number] | null> = {
  engine_oil: [3000, 3], oil_filter: [6000, 6], air_filter: [6000, 6], chain_sprocket: [20000, 24], chain_lube: [500, 1], brake_pads: [15000, 12],
  disc_care: [3000, 3], brake_fluid: [20000, 24], clutch: [10000, 12], coolant: [20000, 24], spark_plug: [8000, 12], tyres: [15000, 36], battery: [20000, 24],
};
const CAR: Record<PartId, [number, number] | null> = {
  engine_oil: [10000, 6], oil_filter: [10000, 6], air_filter: [15000, 12], chain_sprocket: null, chain_lube: null, brake_pads: [30000, 24],
  disc_care: [10000, 6], brake_fluid: [20000, 24], clutch: [40000, 24], coolant: [40000, 24], spark_plug: [30000, 24], tyres: [40000, 48], battery: [30000, 36],
};

/** Older service logs had one kind; map it to the parts it covered. */
const KIND_PARTS: Record<string, PartId[]> = { general: ["engine_oil", "oil_filter", "air_filter"], oil: ["engine_oil"], tyre: ["tyres"], battery: ["battery"], brakes: ["brake_pads"] };

/** Coolant only applies to liquid-cooled engines. Bikes default to air-cooled, cars to liquid. */
export const isLiquidCooled = (v: Vehicle) => (v.cooling ?? (v.type === "car" ? "liquid" : "air")) === "liquid";

/** The vehicle's part list: saved settings, else defaults by type. Engine oil seeds from serviceIntervalKm. */
export function vehicleParts(v: Vehicle): PartSetting[] {
  const table = v.type === "car" ? CAR : BIKE;
  const saved = new Map((v.parts ?? []).map((p) => [p.id, p]));
  return PART_IDS.filter((id) => id !== "coolant" || isLiquidCooled(v)).map((id) => {
    const s = saved.get(id);
    if (s) return s;
    const d = table[id];
    const km = id === "engine_oil" && v.serviceIntervalKm > 0 ? v.serviceIntervalKm : d?.[0] ?? 10000;
    return { id, on: !!d, everyKm: km, everyMonths: d?.[1] ?? 12 };
  });
}

export const partsOf = (s: ServiceEntry): PartId[] => (s.parts?.length ? s.parts : KIND_PARTS[s.kind] ?? []);

/** Highest reading from fuel, services, odometer logs and the starting odometer. */
export function latestOdometer(db: DB, v: Vehicle): number {
  const id = v.id;
  return Math.max(v.initialOdometer || 0, ...db.fuel.filter((f) => f.vehicleId === id).map((f) => f.odometer || 0), ...db.services.filter((s) => s.vehicleId === id).map((s) => s.odometer || 0), ...db.odometerLogs.filter((o) => o.vehicleId === id).map((o) => o.odometer || 0));
}

export type DueState = "ok" | "soon" | "due";
export type PartDue = { part: PartSetting; lastOdo: number; lastDate: string; dueOdo: number; kmLeft: number; dueDate: string; daysLeft: number; state: DueState };

const addMonthsISO = (iso: string, n: number) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  d.setUTCDate(Math.min(day, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()));
  return d.toISOString().slice(0, 10);
};
const daysBetweenISO = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/**
 * Due = last done + interval, in km or months, whichever comes first (Q2: never done counts from odometer 0
 * and the purchase/added date). Due soon = within 10% of the km interval (at most 500 km) or 10% of the months (at least 7 days).
 */
export function partDue(db: DB, v: Vehicle, part: PartSetting, today: string, odoNow = latestOdometer(db, v)): PartDue {
  const last = db.services
    .filter((s) => s.vehicleId === v.id && partsOf(s).includes(part.id))
    .sort((a, b) => b.odometer - a.odometer || b.date.localeCompare(a.date))[0];
  const lastOdo = last?.odometer ?? 0;
  const lastDate = last?.date ?? (v.purchaseDate || v.createdAt.slice(0, 10));
  const dueOdo = lastOdo + part.everyKm;
  const kmLeft = dueOdo - odoNow;
  const dueDate = addMonthsISO(lastDate, part.everyMonths);
  const daysLeft = daysBetweenISO(today, dueDate);
  const kmSoon = Math.min(part.everyKm * 0.1, 500);
  const daySoon = Math.max(7, Math.round(part.everyMonths * 3));
  const state: DueState = kmLeft <= 0 || daysLeft <= 0 ? "due" : kmLeft <= kmSoon || daysLeft <= daySoon ? "soon" : "ok";
  return { part, lastOdo, lastDate, dueOdo, kmLeft, dueDate, daysLeft, state };
}

/** Enabled parts with their due state, most urgent first. */
export function serviceSchedule(db: DB, v: Vehicle, today: string): PartDue[] {
  const odo = latestOdometer(db, v);
  const rank = { due: 0, soon: 1, ok: 2 };
  return vehicleParts(v)
    .filter((p) => p.on)
    .map((p) => partDue(db, v, p, today, odo))
    .sort((a, b) => rank[a.state] - rank[b.state] || a.kmLeft - b.kmLeft);
}

/** Parts to pre-tick in the service log: everything due or due soon. */
export const preTicked = (db: DB, v: Vehicle, today: string): PartId[] => serviceSchedule(db, v, today).filter((d) => d.state !== "ok").map((d) => d.part.id);
