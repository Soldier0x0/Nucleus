/** Deterministic sample workspace so users (and testers) can explore insights immediately. */
import type { Appliance, Budget, CycleFlow, CycleState, CycleSymptom, DB, FuelEntry, Note, Rule, ServiceEntry, Subscription, Trip, Txn, Vehicle } from "./types";
import { addDays, addMonths, monthKey, todayISO, uid } from "./format";
import { addFuel, addService } from "./actions";
import { addTripExpense, newDocs, packFromTemplate } from "./domains";
import { markEnd, markStart, setBleeding, setFlowLevel, setSymptom } from "./cycle";

export function withSampleData(db: DB): DB {
  const today = todayISO();
  const v: Vehicle = {
    id: uid(),
    name: "Activa",
    type: "bike",
    make: "Honda",
    model: "Activa 6G",
    plate: "KA 01 AB 1234",
    fuelType: "petrol",
    body: "scooter",
    initialOdometer: 1000,
    serviceIntervalKm: 5000,
    insuranceExpiry: addDays(today, 5),
    pucExpiry: addDays(today, 24),
    createdAt: new Date().toISOString(),
  };
  const car: Vehicle = {
    id: uid(),
    name: "Swift",
    type: "car",
    make: "Maruti",
    model: "Swift VXi",
    fuelType: "petrol",
    body: "hatchback",
    initialOdometer: 32000,
    serviceIntervalKm: 10000,
    insuranceExpiry: addDays(today, 140),
    pucExpiry: addDays(today, 60),
    createdAt: new Date().toISOString(),
  };
  let next: DB = { ...db, vehicles: [...db.vehicles, v, car], settings: { ...db.settings, defaultVehicleId: db.settings.defaultVehicleId ?? v.id } };

  // services: intervals 5100, 5400, 4900, 5200 -> avg 5150; currently ~4700 since last
  const svcOdos = [1000, 6100, 11500, 16400, 21600];
  svcOdos.forEach((odo, i) => {
    const s: ServiceEntry = { id: uid(), vehicleId: v.id, date: addMonths(today, -(svcOdos.length - i) * 4), odometer: odo, kind: i % 2 ? "oil" : "general", cost: 850 + i * 60, details: i % 2 ? { grade: "10W-30", quantity: "0.8 L" } : {} };
    next = addService(next, s);
  });

  // fuel: every ~2 weeks over 6 months, odometer climbing to 26300
  const fills = 13;
  let odo = 21600;
  for (let i = 0; i < fills; i++) {
    odo += i === 0 ? 0 : 360 + ((i * 37) % 40);
    const litres = Number((5.2 + ((i * 13) % 9) / 10).toFixed(2));
    const price = 102 + (i % 4) * 0.6;
    const f: FuelEntry = { id: uid(), vehicleId: v.id, date: addDays(today, -(fills - 1 - i) * 14), odometer: odo, litres, price: Number(price.toFixed(2)), total: Math.round(litres * price) };
    next = addFuel(next, f);
  }
  next = addFuel(next, { id: uid(), vehicleId: car.id, date: addDays(today, -30), odometer: 41200, litres: 32, price: 103.5, total: 3312 });
  next = addFuel(next, { id: uid(), vehicleId: car.id, date: addDays(today, -6), odometer: 41680, litres: 29.5, price: 103.9, total: 3065 });

  // money: 6 months of history; electricity rising; food spike this month
  const txns: Txn[] = [];
  const elec = [2310, 2470, 2520, 2610, 2730, 1450];
  for (let m = 5; m >= 0; m--) {
    const base = addMonths(today, -m);
    const mk = monthKey(base);
    const d = (day: number) => `${mk}-${String(Math.min(day, m === 0 ? Number(today.slice(8, 10)) : 28)).padStart(2, "0")}`;
    txns.push({ id: uid(), type: "income", amount: 85000, category: "Salary", date: d(1), note: "Salary" });
    txns.push({ id: uid(), type: "expense", amount: 18000, category: "Rent", date: d(2), note: "Rent" });
    txns.push({ id: uid(), type: "expense", amount: elec[5 - m], category: "Electricity", date: d(8), note: "BESCOM bill" });
    txns.push({ id: uid(), type: "expense", amount: 3200 + ((m * 410) % 900), category: "Groceries", date: d(6), note: "Weekly groceries" });
    txns.push({ id: uid(), type: "expense", amount: m === 0 ? 7800 : 3400 + ((m * 230) % 600), category: "Food", date: d(10), note: m === 0 ? "Dinners out + party" : "Eating out" });
    txns.push({ id: uid(), type: "expense", amount: 1200 + ((m * 300) % 1500), category: "Shopping", date: d(14) });
  }
  next = { ...next, txns: [...next.txns, ...txns] };

  const subs: Subscription[] = [
    { id: uid(), name: "Netflix", amount: 649, cycle: "monthly", nextRenewal: addDays(today, 2), category: "Subscriptions", active: true },
    { id: uid(), name: "Spotify", amount: 119, cycle: "monthly", nextRenewal: addDays(today, 6), category: "Subscriptions", active: true },
    { id: uid(), name: "Cloud backup", amount: 1950, cycle: "yearly", nextRenewal: addDays(today, 48), category: "Subscriptions", active: true },
    { id: uid(), name: "Broadband", amount: 799, cycle: "monthly", nextRenewal: addDays(today, 19), category: "Bills", active: true },
  ];
  next = { ...next, subscriptions: [...next.subscriptions, ...subs], budget: { monthly: 45000, categories: { Food: 6000, Shopping: 4000 } } };

  // travel: a trip in 5 days, partly packed, 1 document missing
  const packing = packFromTemplate("Beach").map((p, i) => ({ ...p, done: i % 3 !== 0 }));
  const docs = newDocs().map((d, i) => ({ ...d, have: i !== 3 }));
  const trip = { id: uid(), name: "Goa 2026", destination: "Goa, India", place: { name: "Panaji, Goa, India", lat: 15.49, lon: 73.83, country: "India", countryCode: "IN" }, start: addDays(today, 5), end: addDays(today, 9), travellers: 2, budget: 30000, packing, docs, createdAt: new Date().toISOString(),
    itinerary: [
      { id: uid(), date: addDays(today, 5), time: "08:00", title: "Train to Madgaon", place: "Platform 4" },
      { id: uid(), date: addDays(today, 5), time: "14:00", title: "Check-in · Beach resort" },
      { id: uid(), date: addDays(today, 6), time: "10:30", title: "Old Goa churches", place: "Velha Goa" },
      { id: uid(), date: addDays(today, 6), time: "20:00", title: "Dinner at Fisherman's Wharf" },
    ] };
  next = { ...next, trips: [...next.trips, trip] };
  next = addTripExpense(next, trip.id, { id: uid(), type: "expense", amount: 4200, category: "Travel", date: addDays(today, -10), note: "Train tickets" });
  next = addTripExpense(next, trip.id, { id: uid(), type: "expense", amount: 8400, category: "Travel", date: addDays(today, -8), note: "Resort advance" });

  // home: AC with warranty ending soon + overdue service, purifier filter
  next = { ...next, appliances: [...next.appliances,
    { id: uid(), name: "Bedroom AC", brand: "Daikin", model: "FTKF50", room: "Bedroom", purchaseDate: addMonths(today, -23), price: 42000, warrantyUntil: addDays(today, 21), createdAt: new Date().toISOString(), plans: [{ id: uid(), name: "AC service", everyMonths: 6, lastDone: addDays(addMonths(today, -6), -4), cost: 800 }] },
    { id: uid(), name: "Water purifier", brand: "Kent", room: "Kitchen", purchaseDate: addMonths(today, -14), warrantyUntil: addMonths(today, 10), createdAt: new Date().toISOString(), plans: [{ id: uid(), name: "Filter change", everyMonths: 3, lastDone: addDays(addMonths(today, -3), 12), cost: 1200 }] },
    { id: uid(), name: "Washing machine", brand: "LG", room: "Utility", warrantyUntil: addMonths(today, 30), createdAt: new Date().toISOString(), plans: [] },
  ] };

  // notes & a couple of rules to show the automation sentence
  const nowISO = new Date().toISOString();
  next = { ...next, notes: [...next.notes,
    { id: uid(), title: "Service centre numbers", body: "Daikin: 1800-22-xxxx\nCar workshop: ask for Rafiq", checklist: [], pinned: true, createdAt: nowISO, updatedAt: nowISO },
    { id: uid(), title: "Before the Goa trip", body: "", checklist: [{ id: uid(), text: "Download offline maps", done: true }, { id: uid(), text: "Carry printed hotel booking", done: false }, { id: uid(), text: "Switch on travel insurance", done: false }], pinned: true, createdAt: nowISO, updatedAt: nowISO },
  ] };
  next = { ...next, rules: [...next.rules,
    { id: uid(), name: "Renewals heads-up", trigger: { kind: "renewal", value: 5 }, actions: ["attention"], enabled: true, createdAt: nowISO },
    { id: uid(), name: "Big spend check", trigger: { kind: "bigExpense", value: 5000 }, actions: ["attention"], enabled: true, createdAt: nowISO },
  ] };
  const sampled = appendSampleCycle(next.cycle, today);
  next = { ...next, cycle: sampled.cycle };
  const stamped = stampSample(db, next);
  if (!sampled.ids.length) return stamped;
  return {
    ...stamped,
    settings: {
      ...stamped.settings,
      sampleIds: [...new Set([...(stamped.settings.sampleIds ?? []), ...sampled.ids])].slice(0, 800),
    },
  };
}

const SAMPLE_STASH: Record<CycleState["stash"][number]["kind"], { home: number; bag: number }> = {
  pad: { home: 14, bag: 2 },
  liner: { home: 20, bag: 4 },
  tampon: { home: 8, bag: 2 },
  cup: { home: 1, bag: 0 },
  disc: { home: 1, bag: 1 },
  underwear: { home: 1, bag: 1 },
};

/** Four recent periods, with flow and symptoms, so the guess can use her own length. */
function appendSampleCycle(cycle: CycleState, today: string): { cycle: CycleState; ids: string[] } {
  if (cycle.days.some((day) => day.id.startsWith("sample-cycle-"))) return { cycle, ids: [] };
  const flows: CycleFlow[] = ["heavy", "heavy", "medium", "light", "light"];
  const symptoms: (CycleSymptom | null)[] = ["cramps", "headache", null, "backache", null];
  const offsets = [-90, -61, -32, -3];
  let days = cycle.days;
  for (const offset of offsets) {
    const start = addDays(today, offset);
    const length = offset === -3 ? 4 : 5;
    for (let i = 0; i < length; i++) {
      const date = addDays(start, i);
      if (days.some((day) => day.date === date)) continue;
      days = markStart(days, date);
      days = setFlowLevel(days, date, flows[i] ?? "medium");
      const symptom = symptoms[i];
      if (symptom) days = setSymptom(days, date, symptom);
      if (i === length - 1 && offset !== -3) days = markEnd(days, date);
    }
    if (offset === -61) {
      const spot = addDays(start, 6);
      if (!days.some((day) => day.date === spot)) days = setBleeding(days, spot, "spotting");
    }
  }
  const prior = new Set(cycle.days.map((day) => day.date));
  const tagged = days.map((day) => (prior.has(day.date) ? day : { ...day, id: `sample-cycle-${day.date}` }));
  const ids = tagged.filter((day) => day.id.startsWith("sample-cycle-")).map((day) => day.id);
  const stash = cycle.stash.map((item) => {
    const demo = SAMPLE_STASH[item.kind];
    return { ...item, count: item.count ?? demo.home, carry: item.carry ?? demo.bag };
  });
  return { cycle: { ...cycle, days: tagged, stash }, ids };
}

const SAMPLE_SERVICE_ODOS = [1000, 6100, 11500, 16400, 21600];

function rowIds(db: DB): string[] {
  const ids: string[] = [];
  for (const row of db.vehicles) ids.push(row.id);
  for (const row of db.fuel) ids.push(row.id);
  for (const row of db.services) ids.push(row.id);
  for (const row of db.txns) ids.push(row.id);
  for (const row of db.subscriptions) ids.push(row.id);
  for (const row of db.links) ids.push(row.id);
  for (const trip of db.trips) {
    ids.push(trip.id, ...trip.packing.map((item) => item.id), ...trip.itinerary.map((item) => item.id), ...trip.docs.map((item) => item.id));
  }
  for (const appliance of db.appliances) ids.push(appliance.id, ...appliance.plans.map((plan) => plan.id));
  for (const note of db.notes) ids.push(note.id, ...note.checklist.map((item) => item.id));
  for (const rule of db.rules) ids.push(rule.id);
  return ids;
}

function stampSample(before: DB, next: DB): DB {
  const prior = new Set(rowIds(before));
  const added = rowIds(next).filter((id) => !prior.has(id));
  return {
    ...next,
    settings: {
      ...next.settings,
      sampleIds: [...new Set([...(before.settings.sampleIds ?? []), ...added])],
      sampleBudget: before.settings.sampleBudget ?? before.budget,
    },
  };
}

function sampleFuelOdometers(which: "activa" | "swift"): number[] {
  if (which === "swift") return [41200, 41680];
  const odos: number[] = [];
  let odo = 21600;
  for (let i = 0; i < 13; i++) {
    odo += i === 0 ? 0 : 360 + ((i * 37) % 40);
    odos.push(odo);
  }
  return odos;
}

function isSampleActiva(vehicle: Vehicle): boolean {
  return vehicle.name === "Activa" && vehicle.make === "Honda" && vehicle.model === "Activa 6G" && vehicle.plate === "KA 01 AB 1234";
}

function isSampleSwift(vehicle: Vehicle): boolean {
  return vehicle.name === "Swift" && vehicle.make === "Maruti" && vehicle.model === "Swift VXi" && vehicle.initialOdometer === 32000 && !vehicle.plate;
}

function isSampleTxn(txn: Txn): boolean {
  if (txn.note === "Salary" && txn.amount === 85000 && txn.category === "Salary") return true;
  if (txn.note === "Rent" && txn.amount === 18000 && txn.category === "Rent") return true;
  if (txn.note === "BESCOM bill" && txn.category === "Electricity") return true;
  if (txn.note === "Weekly groceries" || txn.note === "Eating out") return true;
  if (txn.note === "Dinners out + party" && txn.amount === 7800) return true;
  if (txn.note === "Train tickets" && txn.amount === 4200) return true;
  if (txn.note === "Resort advance" && txn.amount === 8400) return true;
  if (!txn.note && txn.category === "Shopping") {
    for (let month = 0; month <= 5; month++) {
      if (txn.amount === 1200 + ((month * 300) % 1500)) return true;
    }
  }
  return false;
}

function isSampleSubscription(sub: Subscription): boolean {
  return (sub.name === "Netflix" && sub.amount === 649 && sub.cycle === "monthly")
    || (sub.name === "Spotify" && sub.amount === 119 && sub.cycle === "monthly")
    || (sub.name === "Cloud backup" && sub.amount === 1950 && sub.cycle === "yearly")
    || (sub.name === "Broadband" && sub.amount === 799 && sub.cycle === "monthly");
}

function isSampleTrip(trip: Trip): boolean {
  return trip.name === "Goa 2026" && trip.destination.includes("Goa");
}

function isSampleAppliance(appliance: Appliance): boolean {
  if (appliance.name === "Bedroom AC" && appliance.brand === "Daikin" && appliance.model === "FTKF50") return true;
  if (appliance.name === "Water purifier" && appliance.brand === "Kent" && appliance.room === "Kitchen") return true;
  return appliance.name === "Washing machine" && appliance.brand === "LG" && appliance.room === "Utility" && appliance.plans.length === 0;
}

function isSampleNote(note: Note): boolean {
  return note.title === "Service centre numbers" || note.title === "Before the Goa trip";
}

function isSampleRule(rule: Rule): boolean {
  return (rule.name === "Renewals heads-up" && rule.trigger.kind === "renewal" && rule.trigger.value === 5)
    || (rule.name === "Big spend check" && rule.trigger.kind === "bigExpense" && rule.trigger.value === 5000);
}

/** Demo rows already saved before they were tagged. A matching real salary stays when the demo vehicles are gone. */
function legacySampleIds(db: DB): Set<string> {
  const ids = new Set<string>();
  const activas = db.vehicles.filter(isSampleActiva);
  const swifts = db.vehicles.filter(isSampleSwift);
  const activaOdo = new Set(sampleFuelOdometers("activa"));
  const swiftOdo = new Set(sampleFuelOdometers("swift"));
  const serviceOdo = new Set(SAMPLE_SERVICE_ODOS);
  for (const vehicle of activas) ids.add(vehicle.id);
  for (const vehicle of swifts) ids.add(vehicle.id);
  for (const fuel of db.fuel) {
    if (activas.some((vehicle) => vehicle.id === fuel.vehicleId) && activaOdo.has(fuel.odometer)) ids.add(fuel.id);
    if (swifts.some((vehicle) => vehicle.id === fuel.vehicleId) && swiftOdo.has(fuel.odometer)) ids.add(fuel.id);
  }
  for (const service of db.services) {
    if (activas.some((vehicle) => vehicle.id === service.vehicleId) && serviceOdo.has(service.odometer)) ids.add(service.id);
  }
  const trips = db.trips.filter(isSampleTrip);
  for (const trip of trips) ids.add(trip.id);
  const demo = activas.length > 0 || swifts.length > 0 || trips.length > 0;
  if (!demo) return ids;
  for (const txn of db.txns) if (isSampleTxn(txn)) ids.add(txn.id);
  for (const sub of db.subscriptions) if (isSampleSubscription(sub)) ids.add(sub.id);
  for (const appliance of db.appliances) if (isSampleAppliance(appliance)) ids.add(appliance.id);
  for (const note of db.notes) if (isSampleNote(note)) ids.add(note.id);
  for (const rule of db.rules) if (isSampleRule(rule)) ids.add(rule.id);
  for (const link of db.links) {
    if (ids.has(link.from.id) || ids.has(link.to.id)) ids.add(link.id);
  }
  return ids;
}

function dropSampleRows(db: DB, drop: Set<string>, restoreBudget: Budget | undefined): DB {
  if (!drop.size && !restoreBudget) return db;
  const fuel = db.fuel.filter((row) => !drop.has(row.id));
  const services = db.services.filter((row) => !drop.has(row.id));
  const vehicles = db.vehicles.filter((row) => !drop.has(row.id));
  const keptVehicles = new Set(vehicles.map((row) => row.id));
  const txns = db.txns.filter((row) => !drop.has(row.id));
  const trips = db.trips.filter((row) => !drop.has(row.id));
  const appliances = db.appliances.filter((row) => !drop.has(row.id));
  const defaultVehicleId = db.settings.defaultVehicleId && keptVehicles.has(db.settings.defaultVehicleId) ? db.settings.defaultVehicleId : undefined;
  const { sampleBudget: _prior, ...settings } = db.settings;
  return {
    ...db,
    settings: { ...settings, sampleIds: [], defaultVehicleId },
    vehicles,
    fuel,
    services,
    txns,
    subscriptions: db.subscriptions.filter((row) => !drop.has(row.id)),
    links: db.links.filter((row) => !drop.has(row.id) && !drop.has(row.from.id) && !drop.has(row.to.id)),
    trips,
    appliances,
    notes: db.notes.filter((row) => !drop.has(row.id)),
    rules: db.rules.filter((row) => !drop.has(row.id)),
    budget: restoreBudget ?? db.budget,
    cycle: { ...db.cycle, days: db.cycle.days.filter((day) => !drop.has(day.id)) },
  };
}

const SAMPLE_BUDGET: Budget = { monthly: 45000, categories: { Food: 6000, Shopping: 4000 } };

function sameBudget(a: Budget, b: Budget): boolean {
  if (a.monthly !== b.monthly) return false;
  const left = Object.keys(a.categories).sort();
  const right = Object.keys(b.categories).sort();
  if (left.length !== right.length) return false;
  return left.every((key, index) => key === right[index] && a.categories[key] === b.categories[key]);
}

const FUEL_MIRROR = /^(.+) · (\d+(?:\.\d+)?) L$/;
const SERVICE_MIRROR = /^(.+) · (General service|Engine oil|Tyres|Battery|Brakes|Repair|Maintenance)$/;

function mirrorVehicleName(note: string): string | null {
  const fuel = FUEL_MIRROR.exec(note);
  if (fuel) return fuel[1];
  const service = SERVICE_MIRROR.exec(note);
  if (service) return service[1];
  return null;
}

function budgetAfterDemo(db: DB): Budget | undefined {
  if (!sameBudget(db.budget, SAMPLE_BUDGET)) return undefined;
  return db.settings.sampleBudget ?? { monthly: 0, categories: {} };
}

function leftoverMirrorIds(db: DB): Set<string> {
  return mirrorIdsAgainst(db, new Set(db.vehicles.map((vehicle) => vehicle.name)));
}

function mirrorIdsAgainst(db: DB, keptNames: Set<string>): Set<string> {
  const ids = new Set<string>();
  for (const txn of db.txns) {
    if (txn.type !== "expense" || !txn.note) continue;
    const name = mirrorVehicleName(txn.note);
    if (!name || keptNames.has(name)) continue;
    ids.add(txn.id);
  }
  return ids;
}

/** Fuel and service rows whose vehicle is already gone, matching the demo odometers. */
function orphanDemoIds(db: DB): Set<string> {
  const kept = new Set(db.vehicles.map((vehicle) => vehicle.id));
  const activaOdo = new Set(sampleFuelOdometers("activa"));
  const swiftOdo = new Set(sampleFuelOdometers("swift"));
  const serviceOdo = new Set(SAMPLE_SERVICE_ODOS);
  const ids = new Set<string>();
  for (const fuel of db.fuel) {
    if (kept.has(fuel.vehicleId)) continue;
    if (activaOdo.has(fuel.odometer) || swiftOdo.has(fuel.odometer)) ids.add(fuel.id);
  }
  for (const service of db.services) {
    if (kept.has(service.vehicleId)) continue;
    if (serviceOdo.has(service.odometer)) ids.add(service.id);
  }
  return ids;
}

/** Money rows the fuel and service reactors created. Dropping the source id does not run that reactor. */
function linkedTxnIds(db: DB, sources: Set<string>): Set<string> {
  const ids = new Set<string>();
  for (const link of db.links) {
    if ((link.from.kind === "fuel" || link.from.kind === "service") && sources.has(link.from.id) && link.to.kind === "txn") ids.add(link.to.id);
  }
  return ids;
}

function unnamedPairIds(db: DB, touched: Set<string>): Set<string> {
  const groups = new Map<string, string[]>();
  for (const txn of db.txns) {
    if (txn.type !== "expense" || txn.note?.trim()) continue;
    if (txn.category !== "Fuel" && txn.category !== "Vehicle") continue;
    const key = `${txn.date}|${txn.amount}|${txn.category}`;
    const list = groups.get(key) ?? [];
    list.push(txn.id);
    groups.set(key, list);
  }
  const ids = new Set<string>();
  for (const list of groups.values()) {
    if (list.length < 2 || !list.some((id) => touched.has(id))) continue;
    for (const id of list) ids.add(id);
  }
  return ids;
}

function demoResidue(db: DB): boolean {
  return (db.settings.sampleIds?.length ?? 0) > 0
    || legacySampleIds(db).size > 0
    || leftoverMirrorIds(db).size > 0
    || orphanDemoIds(db).size > 0
    || sameBudget(db.budget, SAMPLE_BUDGET);
}

export function hasSampleData(db: DB): boolean {
  return demoResidue(db);
}

/** Remove demo rows. Rows added by hand stay, including a fill logged on the demo vehicle. */
export function withoutSampleData(db: DB): DB {
  const tagged = new Set(db.settings.sampleIds ?? []);
  const base = tagged.size ? tagged : legacySampleIds(db);
  const droppingVehicles = new Set(db.vehicles.filter((vehicle) => base.has(vehicle.id)).map((vehicle) => vehicle.id));
  const keptNames = new Set(db.vehicles.filter((vehicle) => !droppingVehicles.has(vehicle.id)).map((vehicle) => vehicle.name));
  const drop = new Set(base);
  for (const id of mirrorIdsAgainst(db, keptNames)) drop.add(id);
  for (const id of orphanDemoIds(db)) drop.add(id);
  const sources = new Set<string>();
  for (const fuel of db.fuel) if (drop.has(fuel.id)) sources.add(fuel.id);
  for (const service of db.services) if (drop.has(service.id)) sources.add(service.id);
  for (const id of linkedTxnIds(db, sources)) drop.add(id);
  for (const id of unnamedPairIds(db, drop)) drop.add(id);
  for (const day of db.cycle.days) {
    if (day.id.startsWith("sample-cycle-")) drop.add(day.id);
  }
  return dropSampleRows(db, drop, budgetAfterDemo(db));
}
