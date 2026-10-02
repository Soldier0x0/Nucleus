/** Travel + Home domain logic (pure). */
import type { Appliance, Chore, DB, MaintPlan, PackItem, Trip, TripDoc, Txn, UtilityBill, UtilityKind } from "./types";
import { addDays, addMonths, daysBetween, todayISO, uid } from "./format";

export const PACK_TEMPLATES: Record<string, Record<string, string[]>> = {
  Weekend: { Clothing: ["T-shirts", "Jeans", "Sleepwear", "Underwear"], Toiletries: ["Toothbrush", "Deodorant"], Electronics: ["Phone charger", "Earphones"], Documents: ["ID card", "Wallet"] },
  Business: { Clothing: ["Formal shirts", "Trousers", "Blazer", "Formal shoes"], Electronics: ["Laptop", "Laptop charger", "Phone charger", "Adapter"], Documents: ["ID card", "Business cards", "Tickets"], Toiletries: ["Toothbrush", "Shaving kit"] },
  Beach: { Clothing: ["Swimwear", "Shorts", "Flip-flops", "Sun hat"], Toiletries: ["Sunscreen", "After-sun", "Toothbrush"], Misc: ["Sunglasses", "Beach towel", "Water bottle"], Electronics: ["Phone charger", "Power bank"] },
  Trekking: { Clothing: ["Trek shoes", "Thermals", "Rain jacket", "Wool socks"], Gear: ["Backpack", "Headlamp", "Water bottle", "Trek poles"], Health: ["First-aid kit", "ORS", "Sunscreen"], Documents: ["Permits", "ID card"] },
  International: { Documents: ["Passport", "Visa", "Tickets", "Travel insurance", "Forex card"], Electronics: ["Universal adapter", "Phone charger", "Power bank"], Clothing: ["Jacket", "Comfortable shoes"], Toiletries: ["Toothbrush", "Medicines"] },
  Winter: { Clothing: ["Thermals", "Down jacket", "Gloves", "Beanie", "Wool socks"], Toiletries: ["Moisturiser", "Lip balm"], Electronics: ["Phone charger"], Documents: ["ID card"] },
  Photography: { Gear: ["Camera body", "Lenses", "Spare batteries", "Memory cards", "Tripod", "Lens cloth"], Electronics: ["Battery charger", "Card reader", "Laptop"], Documents: ["ID card"] },
};

export const DEFAULT_DOCS = ["Passport / ID", "Tickets", "Hotel booking", "Travel insurance"];

export const packFromTemplate = (t: string): PackItem[] =>
  Object.entries(PACK_TEMPLATES[t] ?? {}).flatMap(([category, items]) => items.map((name) => ({ id: uid(), name, category, done: false })));

export const newDocs = (names = DEFAULT_DOCS): TripDoc[] => names.map((name) => ({ id: uid(), name, have: false }));

export function tripTxns(db: DB, tripId: string): Txn[] {
  const ids = new Set(db.links.filter((l) => l.from.kind === "trip" && l.from.id === tripId && l.to.kind === "txn").map((l) => l.to.id));
  return db.txns.filter((t) => ids.has(t.id));
}

/** Readiness = packing 50% + documents 30% + budget set 20%. Deterministic and explainable. */
export function readiness(db: DB, t: Trip) {
  const packPct = t.packing.length ? t.packing.filter((p) => p.done).length / t.packing.length : 0;
  const docPct = t.docs.length ? t.docs.filter((d) => d.have).length / t.docs.length : 1;
  const budgetOk = t.budget > 0 ? 1 : 0;
  const score = packPct * 0.5 + docPct * 0.3 + budgetOk * 0.2;
  const missing: string[] = [];
  if (packPct < 1) missing.push(`Packing ${Math.round(packPct * 100)}%`);
  const docsMissing = t.docs.filter((d) => !d.have).length;
  if (docsMissing) missing.push(`${docsMissing} document${docsMissing > 1 ? "s" : ""} missing`);
  if (!budgetOk) missing.push("No budget set");
  const spent = tripTxns(db, t.id).reduce((s, x) => s + x.amount, 0);
  return { score, packPct, docPct, budgetOk, missing, spent, daysToStart: daysBetween(todayISO(), t.start), days: daysBetween(t.start, t.end) + 1 };
}

export const tripStatus = (t: Trip) => {
  const today = todayISO();
  return today < t.start ? "upcoming" : today > t.end ? "past" : "ongoing";
};

/** Previous trip with the most packing items — reuse suggestion. */
export const reuseCandidate = (db: DB, t: Trip) => [...db.trips].filter((x) => x.id !== t.id && x.packing.length).sort((a, b) => b.start.localeCompare(a.start))[0];

// ---------- Home ----------
export const ROOMS = ["Kitchen", "Living", "Bedroom", "Bathroom", "Utility", "Garage", "Other"];
export const nextDue = (p: MaintPlan) => addMonths(p.lastDone, p.everyMonths);

export function homeSchedule(db: DB) {
  const today = todayISO();
  return db.appliances
    .flatMap((a) => a.plans.map((p) => ({ a, p, due: nextDue(p), days: daysBetween(today, nextDue(p)) })))
    .sort((x, y) => x.due.localeCompare(y.due));
}

export function upsertTrip(db: DB, t: Trip): DB {
  const exists = db.trips.some((x) => x.id === t.id);
  return { ...db, trips: exists ? db.trips.map((x) => (x.id === t.id ? t : x)) : [...db.trips, t] };
}

export function upsertAppliance(db: DB, a: Appliance): DB {
  const exists = db.appliances.some((x) => x.id === a.id);
  return { ...db, appliances: exists ? db.appliances.map((x) => (x.id === a.id ? a : x)) : [...db.appliances, a] };
}

const link = (from: any, to: any, rel: string) => ({ id: uid(), from, to, rel, createdAt: new Date().toISOString() });

export function addTripExpense(db: DB, tripId: string, txn: Txn): DB {
  return { ...db, txns: [...db.txns, txn], links: [...db.links, link({ kind: "trip", id: tripId }, { kind: "txn", id: txn.id }, "trip expense")] };
}

export function logMaintenance(db: DB, applianceId: string, planId: string, cost: number): DB {
  const a = db.appliances.find((x) => x.id === applianceId);
  if (!a) return db;
  const today = todayISO();
  const plan = a.plans.find((p) => p.id === planId);
  let next = upsertAppliance(db, { ...a, plans: a.plans.map((p) => (p.id === planId ? { ...p, lastDone: today } : p)) });
  if (cost > 0 && db.settings.modules.find((m) => m.id === "money")?.enabled) {
    const txn: Txn = { id: uid(), type: "expense", amount: cost, category: "Bills", date: today, note: `${a.name} · ${plan?.name ?? "Maintenance"}` };
    next = { ...next, txns: [...next.txns, txn], links: [...next.links, link({ kind: "appliance", id: a.id }, { kind: "txn", id: txn.id }, "maintenance")] };
  }
  return next;
}

export const UTILITY_KINDS: { id: UtilityKind; label: string; unit: string; icon: string }[] = [
  { id: "electricity", label: "Electricity", unit: "kWh", icon: "flash" },
  { id: "water", label: "Water", unit: "kL", icon: "water" },
  { id: "lpg", label: "LPG", unit: "kg", icon: "fire" },
  { id: "internet", label: "Internet", unit: "", icon: "web" },
];

export function utilityEstimate(bills: UtilityBill[], kind: UtilityKind) {
  const rows = bills.filter((b) => b.kind === kind).sort((a, b) => a.date.localeCompare(b.date));
  const last = rows[rows.length - 1];
  const earlier = rows.slice(0, -1).slice(-3);
  const usual = earlier.length ? earlier.reduce((s, b) => s + b.amount, 0) / earlier.length : undefined;
  return { rows, last, usual };
}

export function choreDueDate(c: Chore, today = todayISO()) {
  return daysBetween(today, addDays(c.lastDone, c.everyDays));
}

export function completeChore(db: DB, id: string): DB {
  const today = todayISO();
  return { ...db, chores: db.chores.map((c) => (c.id === id ? { ...c, lastDone: today } : c)) };
}

export type RoomStatus = "urgent" | "upcoming" | "ok";

export function roomSummaries(db: DB, today = todayISO()) {
  return ROOMS.map((room) => {
    const appliances = db.appliances.filter((a) => a.room === room);
    const chores = db.chores.filter((c) => c.room === room);
    if (!appliances.length && !chores.length) return null;
    const maintDays = appliances.flatMap((a) => a.plans.map((p) => daysBetween(today, nextDue(p))));
    const maintLate = maintDays.some((d) => d < 0);
    const maintSoon = maintDays.some((d) => d >= 0 && d <= 7);
    const choreLate = chores.some((c) => choreDueDate(c, today) < 0);
    const choreSoon = chores.some((c) => {
      const d = choreDueDate(c, today);
      return d >= 0 && d <= 1;
    });
    const warrantySoon = appliances.some((a) => a.warrantyUntil && daysBetween(today, a.warrantyUntil) <= 30 && daysBetween(today, a.warrantyUntil) >= 0);
    const status: RoomStatus = maintLate || choreLate ? "urgent" : maintSoon || choreSoon || warrantySoon ? "upcoming" : "ok";
    return { room, appliances: appliances.length, chores: chores.length, status };
  }).filter((x): x is { room: string; appliances: number; chores: number; status: RoomStatus } => !!x);
}
