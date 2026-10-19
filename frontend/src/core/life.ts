/**
 * Life-desk calculations. Dates, costs and warnings already live in the document.
 * Nothing here calls a network or a model — a phrase like "450 food lunch" is parsed
 * by the capture grammar, not classified.
 */
import type { DB, FuelType, HybridFrom, Paper, Vehicle, VehicleBody } from "./types";
import { daysBetween, monthKey, money, todayISO } from "./format";

export const BODY_LABEL: Record<VehicleBody, string> = {
  scooter: "Scooter",
  sport: "Sports bike",
  naked: "Naked bike",
  cruiser: "Cruiser",
  adventure: "Adventure",
  hatchback: "Hatchback",
  sedan: "Sedan",
  suv: "SUV",
  pickup: "Pickup",
  van: "Van",
  other: "Other",
};

const BIKE_BODIES: VehicleBody[] = ["scooter", "sport", "naked", "cruiser", "adventure"];
const CAR_BODIES: VehicleBody[] = ["hatchback", "sedan", "suv", "pickup", "van"];

export function bodiesFor(type: Vehicle["type"]): VehicleBody[] {
  if (type === "bike") return BIKE_BODIES;
  if (type === "car") return CAR_BODIES;
  return ["other", "van", "pickup"];
}

const RULES: { body: VehicleBody; words: string[] }[] = [
  { body: "scooter", words: ["activa", "jupiter", "access", "dio", "ntorq", "burgman", "fascino", "rayzr", "ray zr", "pleasure", "destini", "aviator", "scooter", "vespa", "aerox"] },
  { body: "sport", words: ["r15", "cbr", "ninja", "rc390", "rc 390", "apache rr", "gsx-r", "gsxr", "yzf", "panigale", "s1000", "sports bike", "sportbike"] },
  { body: "cruiser", words: ["classic 350", "classic", "bullet", "meteor", "hunter 350", "harley", "avenger", "intruder", "rebel", "cruiser"] },
  { body: "adventure", words: ["himalayan", "africa twin", "versys", "v-strom", "vstrom", "adventure"] },
  { body: "naked", words: ["duke", "mt-15", "mt15", "mt 15", "dominar", "pulsar", "gixxer", "cb300", "z900", "monster", "naked"] },
  { body: "suv", words: ["creta", "seltos", "fortuner", "thar", "xuv", "scorpio", "brezza", "nexon", "venue", "hector", "compass", "harrier", "suv", "innova"] },
  { body: "sedan", words: ["honda city", "city", "ciaz", "verna", "slavia", "virtus", "camry", "accord", "amaze", "dzire", "sedan"] },
  { body: "hatchback", words: ["i20", "swift", "baleno", "polo", "altroz", "punch", "wagonr", "wagon r", "kiger", "magnite", "tiago", "alto", "i10", "hatchback", "hatch"] },
  { body: "pickup", words: ["hilux", "pickup", "ranger", "navara"] },
  { body: "van", words: ["van", "eeco"] },
];

export function inferBody(v: { type: Vehicle["type"]; name?: string; make?: string; model?: string }): VehicleBody {
  const hay = `${v.name ?? ""} ${v.make ?? ""} ${v.model ?? ""}`.toLowerCase();
  for (const rule of RULES) {
    if (rule.words.some((w) => hay.includes(w))) return rule.body;
  }
  if (v.type === "bike") return "naked";
  if (v.type === "car") return "hatchback";
  return "other";
}

export function vehicleBody(v: Vehicle): VehicleBody {
  return v.body ?? inferBody(v);
}

const FUEL_NAME: Record<FuelType, string> = { petrol: "Petrol", diesel: "Diesel", cng: "CNG", electric: "Electric", hybrid: "Hybrid", other: "Other" };

export function fuelLabel(v: { fuelType: FuelType; hybridFrom?: HybridFrom }): string {
  if (v.fuelType === "hybrid") return v.hybridFrom === "diesel" ? "Diesel hybrid" : "Petrol hybrid";
  return FUEL_NAME[v.fuelType];
}

export function weekLeft(db: DB, today = todayISO()) {
  const mk = monthKey(today);
  // Transfers are moves between this user's own accounts, not spend.
  const spent = db.txns.filter((t) => t.type === "expense" && !t.transfer && monthKey(t.date) === mk).reduce((s, t) => s + t.amount, 0);
  const budget = db.budget.monthly;
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const day = Number(today.slice(8, 10));
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - day + 1);
  const left = budget - spent;
  const thisWeek = (left / daysLeft) * Math.min(7, daysLeft);
  return { spent, budget, left, daysLeft, thisWeek, daysInMonth };
}

function odometerOf(db: DB, v: Vehicle) {
  const readings = [v.initialOdometer, ...db.fuel.filter((f) => f.vehicleId === v.id).map((f) => f.odometer), ...db.services.filter((s) => s.vehicleId === v.id).map((s) => s.odometer)];
  return Math.max(...readings);
}

export function vehicleOwnership(db: DB, vehicleId: string) {
  const v = db.vehicles.find((x) => x.id === vehicleId);
  if (!v) return null;
  const fuel = db.fuel.filter((f) => f.vehicleId === v.id).reduce((s, f) => s + f.total, 0);
  const service = db.services.filter((s) => s.vehicleId === v.id).reduce((s, x) => s + x.cost, 0);
  const auto = new Set(db.links.filter((l) => (l.from.kind === "fuel" || l.from.kind === "service") && l.to.kind === "txn").map((l) => l.to.id));
  const otherIds = new Set(db.links.filter((l) => l.from.kind === "vehicle" && l.from.id === v.id && l.to.kind === "txn" && !auto.has(l.to.id)).map((l) => l.to.id));
  const other = db.txns.filter((t) => otherIds.has(t.id) && t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const total = fuel + service + other;
  const distance = Math.max(0, odometerOf(db, v) - v.initialOdometer);
  return { fuel, service, other, total, distance, perKm: distance > 0 ? total / distance : Number.NaN };
}

/** One glyph per appliance, from the name. Unknown names stay on the home mark. */
export function applianceIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("dish")) return "dishwasher";
  if (n.includes("wash")) return "washing-machine";
  if (n.includes("purif")) return "air-filter";
  if (n.includes("fridge") || n.includes("refrigerat")) return "fridge-outline";
  if (/\btv\b/.test(n) || n.includes("television")) return "television";
  if (n.includes("geyser") || n.includes("heater")) return "water-boiler";
  if (/\bfan\b/.test(n)) return "fan";
  if (n.includes("microwave")) return "microwave";
  if (n.includes("vacuum")) return "vacuum";
  if (/\bac\b/.test(n) || n.includes("cooler") || n.includes("air condition")) return "air-conditioner";
  return "home-outline";
}

export function applianceOwnership(db: DB, applianceId: string) {
  const a = db.appliances.find((x) => x.id === applianceId);
  if (!a) return null;
  const ids = new Set(db.links.filter((l) => l.from.kind === "appliance" && l.from.id === a.id && l.to.kind === "txn").map((l) => l.to.id));
  const repairs = db.txns.filter((t) => ids.has(t.id) && t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const price = a.price ?? 0;
  return { price, repairs, total: price + repairs };
}

export function dueDayLabel(days: number): string {
  if (days < 0) return `was due ${-days} days ago`;
  if (days === 0) return "today";
  return `${days} days`;
}

export type HealthIssue = { id: string; title: string; detail: string };

export function dataHealth(db: DB): HealthIssue[] {
  const out: HealthIssue[] = [];
  for (const v of db.vehicles) {
    const rows = [
      ...db.fuel.filter((f) => f.vehicleId === v.id).map((f) => ({ date: f.date, odo: f.odometer, id: `f:${f.id}` })),
      ...db.services.filter((s) => s.vehicleId === v.id).map((s) => ({ date: s.date, odo: s.odometer, id: `s:${s.id}` })),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.odo - b.odo);
    let prev = v.initialOdometer;
    for (const r of rows) {
      if (r.odo + 0.5 < prev) {
        out.push({ id: `odo:${r.id}`, title: `${v.name} odometer went backwards`, detail: `${Math.round(r.odo)} is below the earlier reading of ${Math.round(prev)}.` });
        break;
      }
      prev = Math.max(prev, r.odo);
    }
  }
  const seen = new Map<string, string>();
  for (const t of db.txns) {
    if (t.type !== "expense") continue;
    const key = `${t.date}|${t.amount}|${t.category}`;
    const priorId = seen.get(key);
    if (priorId) {
      const prior = db.txns.find((row) => row.id === priorId)?.note ?? "";
      const notes = [prior, t.note ?? ""].filter(Boolean);
      const named = notes.length ? notes.join(" · ") : "Could not tell the note";
      out.push({
        id: `dup:${t.id}`,
        title: `Two ${t.category} expenses on ${t.date} · ${named}`,
        detail: `Both are ${t.amount}. ${named}.`,
      });
    } else seen.set(key, t.id);
  }
  return out;
}

export type CalEvent = { date: string; title: string; route: string; icon: string };

export function calendarEvents(db: DB): CalEvent[] {
  const out: CalEvent[] = [];
  const on = (id: string) => db.settings.modules.find((m) => m.id === id)?.enabled;
  if (on("vehicles")) {
    for (const v of db.vehicles) {
      if (v.insuranceExpiry) out.push({ date: v.insuranceExpiry, title: `${v.name} insurance`, route: `/vehicles/${v.id}`, icon: "shield-car" });
      if (v.pucExpiry) out.push({ date: v.pucExpiry, title: `${v.name} PUC`, route: `/vehicles/${v.id}`, icon: "smoke" });
    }
  }
  if (on("money")) {
    for (const s of db.subscriptions) if (s.active) out.push({ date: s.nextRenewal, title: `${s.name} renews`, route: "/money?tab=subscriptions", icon: "autorenew" });
  }
  if (on("travel")) {
    for (const t of db.trips) {
      out.push({ date: t.start, title: `${t.name} starts`, route: `/travel/${t.id}`, icon: "bag-suitcase-outline" });
      for (const d of t.docs) if (d.expiry) out.push({ date: d.expiry, title: `${t.name} · ${d.name}`, route: `/travel/${t.id}`, icon: "file-document-outline" });
      for (const i of t.itinerary) out.push({ date: i.date, title: i.title, route: `/travel/${t.id}`, icon: "map-marker-outline" });
    }
  }
  if (on("home")) {
    for (const a of db.appliances) {
      if (a.warrantyUntil) out.push({ date: a.warrantyUntil, title: `${a.name} warranty`, route: "/home", icon: "washing-machine" });
      for (const p of a.plans) {
        const due = addMonthsSafe(p.lastDone, p.everyMonths);
        out.push({ date: due, title: `${a.name} · ${p.name}`, route: "/home", icon: "wrench-clock" });
      }
    }
    for (const c of db.chores) {
      const due = addDaysSafe(c.lastDone, c.everyDays);
      out.push({ date: due, title: c.name, route: "/home", icon: "broom" });
    }
  }
  if (on("papers")) {
    for (const p of db.papers) if (p.expiry) out.push({ date: p.expiry, title: p.title, route: "/papers", icon: "file-document-outline" });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

function addDaysSafe(s: string, n: number) {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + n);
  return toISO(dt);
}
function addMonthsSafe(s: string, n: number) {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, 1);
  dt.setMonth(dt.getMonth() + n);
  const last = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  dt.setDate(Math.min(d || 1, last));
  return toISO(dt);
}
function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function eventsOn(events: CalEvent[], date: string) {
  return events.filter((e) => e.date === date);
}

export function morningLine(db: DB, today = todayISO()): string {
  const soon = calendarEvents(db)
    .map((e) => ({ ...e, days: daysBetween(today, e.date) }))
    .filter((e) => e.days >= 0 && e.days <= 21)
    .sort((a, b) => a.days - b.days)[0];
  const week = weekLeft(db, today);
  const parts: string[] = [];
  if (soon) parts.push(soon.days === 0 ? `${soon.title} is today` : soon.days === 1 ? `${soon.title} is tomorrow` : `${soon.title} in ${soon.days} days`);
  if (week.budget > 0) parts.push(`${money(Math.max(0, week.left), db.settings.currency, { decimals: false })} left this month`);
  if (!parts.length) return "";
  return parts.join(" · ");
}

export type LifeAlert = { key: string; title: string; subtitle: string; severity: "urgent" | "upcoming" | "info"; icon: string; route: string; summary: string; facts: { label: string; value: string }[]; rule: string };

export function lifeAlerts(db: DB, today = todayISO()): LifeAlert[] {
  const out: LifeAlert[] = [];
  const on = (id: string) => db.settings.modules.find((m) => m.id === id)?.enabled;
  if (on("papers")) {
    for (const p of db.papers) {
      if (!p.expiry) continue;
      const d = daysBetween(today, p.expiry);
      if (d > 30) continue;
      out.push({
        key: `paper:${p.id}:${p.expiry}`,
        title: d < 0 ? `${p.title} expired` : d === 0 ? `${p.title} expires today` : `${p.title} expires in ${d} days`,
        subtitle: p.number ? `No. ${p.number}` : "Paper",
        severity: d < 0 ? "urgent" : d <= 14 ? "upcoming" : "info",
        icon: "file-document-outline",
        route: "/papers",
        summary: `${p.title} is dated ${p.expiry}.`,
        facts: [{ label: "Expiry", value: p.expiry }, { label: "Days", value: String(d) }],
        rule: "Shown from 30 days before the date on the paper. Urgent once that date has passed.",
      });
    }
  }
  if (on("vehicles")) {
    for (const part of db.parts) {
      if (!part.everyKm || part.odometer == null) continue;
      const v = db.vehicles.find((x) => x.id === part.vehicleId);
      if (!v) continue;
      const since = odometerOf(db, v) - part.odometer;
      const left = part.everyKm - since;
      if (left > Math.max(300, part.everyKm * 0.15)) continue;
      out.push({
        key: `part:${part.id}:${part.odometer}`,
        title: left <= 0 ? `${v.name} ${part.name} is due` : `${v.name} ${part.name} due in ${Math.round(left)} km`,
        subtitle: `Fitted at ${Math.round(part.odometer)} · every ${part.everyKm} km`,
        severity: left <= 0 ? "urgent" : "upcoming",
        icon: "tire",
        route: `/vehicles/${v.id}`,
        summary: `${part.name} was recorded at ${Math.round(part.odometer)}. ${Math.round(since)} km have passed. The interval you set is ${part.everyKm} km.`,
        facts: [{ label: "Since fitting", value: `${Math.round(since)} km` }, { label: "Interval", value: `${part.everyKm} km` }],
        rule: "Upcoming inside 15% of the interval (at least 300 km). Urgent once the interval is passed.",
      });
    }
  }
  for (const issue of dataHealth(db)) {
    out.push({
      key: `health:${issue.id}`,
      title: issue.title,
      subtitle: issue.detail,
      severity: "info",
      icon: "alert-circle-outline",
      route: issue.id.startsWith("odo:") ? "/vehicles" : "/money",
      summary: issue.detail,
      facts: [{ label: "Check", value: issue.title }],
      rule: "A reading lower than the one before it, or two expenses with the same day, amount and category.",
    });
  }
  return out;
}

export const PAPER_KINDS: { id: Paper["kind"]; label: string }[] = [
  { id: "licence", label: "Licence" },
  { id: "registration", label: "Registration" },
  { id: "insurance", label: "Insurance" },
  { id: "personal_accident", label: "Personal accident" },
  { id: "puc", label: "PUC" },
  { id: "passport", label: "Passport" },
  { id: "fastag", label: "FASTag" },
  { id: "warranty", label: "Warranty" },
  { id: "other", label: "Other" },
];
