/**
 * Deterministic Capture phrases beyond fuel/subscription/money rows.
 * Wired from parseCapture before money; must not break v0.9 money/fuel rules.
 */
import type { CycleProduct, DB, Paper, ServiceKind, Vehicle } from "./types";

export type LexCapture = { label: string; icon: string; apply: (db: DB) => DB } | { error: string };
import { addOdometerLog, addService, addTxn, addVehicleJourney, upsertVehicle } from "./actions";
import { namedVehicle, parseFuelDraft } from "./fuelCapture";
import { classifyMoney } from "./moneyWords";
import { PRODUCTS, SYMPTOMS, markEnd, markStart, restockPack, setStashCount, setSymptom } from "./cycle";
import { motorPaper, pucPaper } from "./vehicleDocs";
import { money, num, todayISO, uid } from "./format";

const SERVICE_WORDS: Record<string, ServiceKind> = {
  oil: "oil",
  tyre: "tyre",
  tire: "tyre",
  battery: "battery",
  brake: "brakes",
  brakes: "brakes",
  general: "general",
  repair: "repair",
};

function stripVehicle(input: string, vehicle: Vehicle): string {
  return input.replace(new RegExp(vehicle.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ").replace(/\s+/g, " ").trim();
}

function productFromWord(word: string): CycleProduct | null {
  const w = word.toLowerCase();
  for (const row of PRODUCTS) {
    if (w === row.id || w === row.label.toLowerCase() || w.startsWith(row.label.toLowerCase())) return row.id;
  }
  if (w === "pads" || w === "pad") return "pad";
  if (w === "tampons" || w === "tampon") return "tampon";
  if (w === "liners" || w === "liner") return "liner";
  if (w === "cups" || w === "cup") return "cup";
  return null;
}

function symptomFromText(s: string): (typeof SYMPTOMS)[number]["id"] | null {
  const hay = s.toLowerCase();
  for (const row of SYMPTOMS) {
    if (hay.includes(row.id) || hay.includes(row.label.toLowerCase())) return row.id;
  }
  return null;
}

export function parseCycleCapture(_db: DB, input: string): LexCapture | null {
  const s = input.trim();
  const today = todayISO();
  if (/\b(period started|cycle start|period began|started period)\b/i.test(s)) {
    return {
      icon: "calendar-heart",
      label: `Cycle · period started · ${today}`,
      apply: (d) => ({ ...d, cycle: { ...d.cycle, days: markStart(d.cycle.days, today) } }),
    };
  }
  if (/\b(period ended|cycle end|ended period)\b/i.test(s)) {
    return {
      icon: "calendar-heart",
      label: `Cycle · period ended · ${today}`,
      apply: (d) => ({ ...d, cycle: { ...d.cycle, days: markEnd(d.cycle.days, today) } }),
    };
  }
  const symptom = symptomFromText(s);
  if (symptom && (/\b(cycle|period|symptom)\b/i.test(s) || s.split(/\s+/).filter(Boolean).length <= 2)) {
    const label = SYMPTOMS.find((row) => row.id === symptom)?.label ?? symptom;
    return {
      icon: "calendar-heart",
      label: `Cycle · ${label} · ${today}`,
      apply: (d) => ({ ...d, cycle: { ...d.cycle, days: setSymptom(d.cycle.days, today, symptom) } }),
    };
  }
  const restock = s.match(/\b(pads?|tampons?|liners?|cups?|discs?)\s+restock(?:\s+(\d+))?\b/i);
  if (restock) {
    const kind = productFromWord(restock[1]);
    if (!kind) return null;
    const count = restock[2] ? Number(restock[2]) : undefined;
    const name = PRODUCTS.find((row) => row.id === kind)?.label ?? kind;
    return {
      icon: "package-variant",
      label: count != null ? `Cycle · ${name} stash · ${count}` : `Cycle · ${name} restock pack`,
      apply: (d) => ({
        ...d,
        cycle: count != null ? setStashCount(d.cycle, kind, count) : restockPack(d.cycle, kind),
      }),
    };
  }
  return null;
}

export function parsePapersCapture(db: DB, input: string): LexCapture | null {
  const s = input.trim();
  const date = s.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1];
  const vehicle = db.vehicles[0];
  if (/\bpuc\b/i.test(s) && date) {
    return {
      icon: "smoke",
      label: `Papers · PUC expiry · ${date}`,
      apply: (d) => upsertPaperExpiry(d, "puc", date, vehicle?.id),
    };
  }
  if (/\b(insurance|motor policy)\b/i.test(s) && date) {
    return {
      icon: "shield-car",
      label: `Papers · insurance expiry · ${date}`,
      apply: (d) => upsertPaperExpiry(d, "insurance", date, vehicle?.id),
    };
  }
  if (/\b(renew|renewal)\b/i.test(s) && date && /\binsurance\b/i.test(s)) {
    return {
      icon: "shield-car",
      label: `Papers · insurance renew · ${date}`,
      apply: (d) => upsertPaperExpiry(d, "insurance", date, vehicle?.id),
    };
  }
  if (/^\s*licen[cs]e\s*$/i.test(s) || /^\s*licen[cs]e\b/i.test(s) && !/\d/.test(s)) {
    return { icon: "card-account-details-outline", label: "Papers · licence (open Papers to attach)", apply: (d) => d };
  }
  return null;
}

function upsertPaperExpiry(db: DB, kind: "puc" | "insurance", expiry: string, vehicleId?: string): DB {
  const existing =
    kind === "puc" && vehicleId
      ? pucPaper(db, vehicleId)
      : vehicleId
        ? motorPaper(db, vehicleId)
        : db.papers.find((p) => p.kind === (kind === "puc" ? "puc" : "insurance"));
  if (existing) {
    const papers = db.papers.map((p) => (p.id === existing.id ? { ...p, expiry } : p));
    return { ...db, papers };
  }
  const paper: Paper = {
    id: uid(),
    kind: kind === "puc" ? "puc" : "insurance",
    title: kind === "puc" ? "PUC" : "Insurance",
    expiry,
    vehicleId,
    createdAt: new Date().toISOString(),
    ...(kind === "insurance" ? { motorCover: "comprehensive" as const } : {}),
  };
  return { ...db, papers: [paper, ...db.papers] };
}

export function parseVehicleCapture(db: DB, input: string): LexCapture | null {
  if (parseFuelDraft(db, input)?.numbers) return null;
  const vehicle = namedVehicle(db, input);
  if (!vehicle) return null;
  const rest = stripVehicle(input, vehicle);
  const cur = db.settings.currency;

  const journey = rest.match(/\bjourney(?:\s+ride)?\s+(\d{3,})\s+(\d{3,})\b/i);
  if (journey) {
    const startOdometer = Math.round(Number(journey[1]));
    const endOdometer = Math.round(Number(journey[2]));
    if (endOdometer < startOdometer) return { error: "End odometer must be after start" };
    const at = new Date().toISOString();
    return {
      icon: "map-marker-distance",
      label: `Journey · ${vehicle.name} · ${num(startOdometer, 0)} → ${num(endOdometer, 0)}`,
      apply: (d) =>
        addVehicleJourney(d, {
          id: uid(),
          vehicleId: vehicle.id,
          startAt: at,
          endAt: at,
          startOdometer,
          endOdometer,
        }),
    };
  }

  const odo = rest.match(/\bodo(?:meter)?\s+(\d+(?:\.\d+)?)\b/i);
  if (odo) {
    const reading = Math.round(Number(odo[1]));
    const at = `${todayISO()}T12:00:00`;
    return {
      icon: "speedometer",
      label: `Odometer · ${vehicle.name} · ${num(reading, 0)}`,
      apply: (d) => addOdometerLog(d, { id: uid(), vehicleId: vehicle.id, at, odometer: reading }),
    };
  }

  const tank = rest.match(/\btank\s+(\d+(?:\.\d+)?)\s*(?:l|litres?)?\b/i);
  if (tank) {
    const litres = Number(tank[1]);
    return {
      icon: "gas-station-outline",
      label: `Vehicle · ${vehicle.name} · tank ${litres} L`,
      apply: (d) => upsertVehicle(d, { ...vehicle, tankLitres: litres }),
    };
  }

  const service = rest.match(/\bservice(?:\s+([a-z]+))?\s+(\d+(?:\.\d+)?)\b/i);
  if (service) {
    const kind = SERVICE_WORDS[(service[1] ?? "general").toLowerCase()] ?? "general";
    const cost = Number(service[2]);
    const odoNow = Math.max(
      vehicle.initialOdometer,
      ...db.fuel.filter((row) => row.vehicleId === vehicle.id).map((row) => row.odometer),
      ...db.services.filter((row) => row.vehicleId === vehicle.id).map((row) => row.odometer),
    );
    return {
      icon: "wrench-outline",
      label: `Service · ${vehicle.name} · ${kind} · ${money(cost, cur)}`,
      apply: (d) =>
        addService(d, {
          id: uid(),
          vehicleId: vehicle.id,
          date: todayISO(),
          odometer: odoNow,
          kind,
          cost,
          details: {},
        }),
    };
  }
  return null;
}

/** Amount-first or word-first expense/income (e.g. uber 180, hotel 3200). */
export function parseMoneyCapture(db: DB, input: string): LexCapture | null {
  const s = input.trim();
  const cur = db.settings.currency;
  if (/^(\+)?[\d.]+\s+\S+/.test(s)) return null;
  const m = s.match(/^(\+)?(\S+)\s+([\d.]+)(?:\s+(.*))?$/);
  if (!m) return null;
  const income = !!m[1];
  const amount = Number(m[3]);
  if (!(amount > 0)) return null;
  const typed = (m[4] ?? "").trim();
  const hit = classifyMoney([m[2], typed].filter(Boolean).join(" "), income ? "income" : "expense");
  if (!hit) return null;
  const category = hit.category;
  const item = hit.item;
  const note = typed || undefined;
  const detail = [category, item, note].filter((part, i, all) => part && all.indexOf(part) === i).join(" · ");
  return {
    icon: income ? "arrow-down-bold-circle-outline" : "arrow-up-bold-circle-outline",
    label: `${income ? "Income" : "Expense"} · ${money(amount, cur)} · ${detail}`,
    apply: (d) =>
      addTxn(d, {
        id: uid(),
        type: income ? "income" : "expense",
        amount,
        category,
        date: todayISO(),
        note,
        ...(item ? { item } : {}),
      }),
  };
}

