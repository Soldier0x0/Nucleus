/** Deterministic sample workspace so users (and testers) can explore insights immediately. */
import type { Appliance, Budget, DB, FuelEntry, Note, Rule, ServiceEntry, Subscription, Trip, Txn, Vehicle } from "./types";
import { addDays, addMonths, monthKey, todayISO, uid } from "./format";
import { addFuel, addService } from "./actions";
import { addTripExpense, newDocs, packFromTemplate } from "./domains";

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
  return stampSample(db, next);
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
  };
}

export function hasSampleData(db: DB): boolean {
  return (db.settings.sampleIds?.length ?? 0) > 0 || legacySampleIds(db).size > 0;
}

const SAMPLE_BUDGET: Budget = { monthly: 45000, categories: { Food: 6000, Shopping: 4000 } };

function sameBudget(a: Budget, b: Budget): boolean {
  if (a.monthly !== b.monthly) return false;
  const left = Object.keys(a.categories).sort();
  const right = Object.keys(b.categories).sort();
  if (left.length !== right.length) return false;
  return left.every((key, index) => key === right[index] && a.categories[key] === b.categories[key]);
}

/** Remove demo rows. Rows added by hand stay, including a fill logged on the demo vehicle. */
export function withoutSampleData(db: DB): DB {
  const tagged = new Set(db.settings.sampleIds ?? []);
  if (tagged.size) {
    const restore = db.settings.sampleBudget && sameBudget(db.budget, SAMPLE_BUDGET) ? db.settings.sampleBudget : undefined;
    return dropSampleRows(db, tagged, restore);
  }
  return dropSampleRows(db, legacySampleIds(db), undefined);
}
