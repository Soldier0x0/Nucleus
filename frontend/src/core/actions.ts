/**
 * Domain actions + event reactors.
 * Actions are pure (db -> db) and emit domain events. Reactors subscribe to events and
 * apply cross-module effects (e.g. fuel.added -> Money expense + link). Modules never
 * call each other directly; they only meet through events and the links table.
 */
import type { DB, EntityKind, FuelEntry, OdometerLog, Ref, ServiceEntry, Subscription, Txn, Vehicle, VehicleJourney } from "./types";
import { addDays, addMonths, todayISO, uid } from "./format";
import { bestEffortDeletePaperFiles } from "./paperFiles";
import { syncVehicleExpiryFields } from "./vehicleDocs";

export type DomainEvent =
  | { type: "fuel.added"; entry: FuelEntry }
  | { type: "service.added"; entry: ServiceEntry }
  | { type: "subscription.paid"; sub: Subscription; date: string }
  | { type: "entity.deleted"; ref: Ref };

type Reactor = (db: DB, ev: any) => DB;

const moduleOn = (db: DB, id: string) => db.settings.modules.find((m) => m.id === id)?.enabled ?? false;

const link = (from: Ref, to: Ref, rel: string) => ({ id: uid(), from, to, rel, createdAt: new Date().toISOString() });

const vehicleName = (db: DB, id: string) => db.vehicles.find((v) => v.id === id)?.name ?? "Vehicle";

const SERVICE_LABEL: Record<string, string> = { general: "General service", oil: "Engine oil", tyre: "Tyres", battery: "Battery", brakes: "Brakes", repair: "Repair", other: "Maintenance" };

const reactors: Record<string, Reactor[]> = {
  "fuel.added": [
    (db, ev: { entry: FuelEntry }) => {
      if (!moduleOn(db, "money") || !db.settings.autoLinkExpenses || ev.entry.total <= 0) return db;
      const txn: Txn = { id: uid(), type: "expense", amount: ev.entry.total, category: "Fuel", date: ev.entry.date, note: `${vehicleName(db, ev.entry.vehicleId)} · ${ev.entry.litres} L` };
      return {
        ...db,
        txns: [...db.txns, txn],
        links: [...db.links, link({ kind: "fuel", id: ev.entry.id }, { kind: "txn", id: txn.id }, "expense"), link({ kind: "vehicle", id: ev.entry.vehicleId }, { kind: "txn", id: txn.id }, "expense")],
      };
    },
  ],
  "service.added": [
    (db, ev: { entry: ServiceEntry }) => {
      if (!moduleOn(db, "money") || !db.settings.autoLinkExpenses || ev.entry.cost <= 0) return db;
      const txn: Txn = { id: uid(), type: "expense", amount: ev.entry.cost, category: "Vehicle", date: ev.entry.date, note: `${vehicleName(db, ev.entry.vehicleId)} · ${SERVICE_LABEL[ev.entry.kind]}` };
      return {
        ...db,
        txns: [...db.txns, txn],
        links: [...db.links, link({ kind: "service", id: ev.entry.id }, { kind: "txn", id: txn.id }, "expense"), link({ kind: "vehicle", id: ev.entry.vehicleId }, { kind: "txn", id: txn.id }, "expense")],
      };
    },
  ],
  "subscription.paid": [
    (db, ev: { sub: Subscription; date: string }) => {
      const txn: Txn = { id: uid(), type: "expense", amount: ev.sub.amount, category: ev.sub.category, date: ev.date, note: ev.sub.name };
      return { ...db, txns: [...db.txns, txn], links: [...db.links, link({ kind: "subscription", id: ev.sub.id }, { kind: "txn", id: txn.id }, "payment")] };
    },
  ],
  "entity.deleted": [
    // Remove dangling relationships; auto-generated expenses go with their source record.
    (db, ev: { ref: Ref }) => {
      const touching = db.links.filter((l) => same(l.from, ev.ref) || same(l.to, ev.ref));
      const autoTxnIds =
        ev.ref.kind === "fuel" || ev.ref.kind === "service"
          ? touching.filter((l) => same(l.from, ev.ref) && l.to.kind === "txn").map((l) => l.to.id)
          : [];
      const attachKind = ev.ref.kind === "paper" || ev.ref.kind === "subscription" || ev.ref.kind === "vehicle" ? ev.ref.kind : null;
      return {
        ...db,
        // A reminder attached to the deleted record goes with it (one delete, one confirm).
        reminders: attachKind ? (db.reminders ?? []).filter((r) => !(r.attach.kind === attachKind && r.attach.id === ev.ref.id)) : db.reminders,
        txns: db.txns.filter((t) => !autoTxnIds.includes(t.id)),
        links: db.links.filter((l) => !touching.includes(l) && !(l.to.kind === "txn" && autoTxnIds.includes(l.to.id))),
      };
    },
  ],
};

export const same = (a: Ref, b: Ref) => a.kind === b.kind && a.id === b.id;

export function dispatch(db: DB, events: DomainEvent[]): DB {
  let next = db;
  for (const ev of events) for (const r of reactors[ev.type] ?? []) next = r(next, ev);
  return next;
}

// ---------- actions ----------
export function upsertVehicle(db: DB, v: Vehicle): DB {
  const exists = db.vehicles.some((x) => x.id === v.id);
  const vehicles = exists ? db.vehicles.map((x) => (x.id === v.id ? v : x)) : [...db.vehicles, v];
  const settings = db.settings.defaultVehicleId ? db.settings : { ...db.settings, defaultVehicleId: v.id };
  return { ...db, vehicles, settings };
}

export function deleteVehicle(db: DB, id: string): DB {
  const fuelIds = db.fuel.filter((f) => f.vehicleId === id).map((f) => f.id);
  const svcIds = db.services.filter((s) => s.vehicleId === id).map((s) => s.id);
  let next: DB = {
    ...db,
    vehicles: db.vehicles.filter((v) => v.id !== id),
    settings: { ...db.settings, defaultVehicleId: db.settings.defaultVehicleId === id ? db.vehicles.find((v) => v.id !== id)?.id : db.settings.defaultVehicleId },
  };
  next = dispatch(next, [
    ...fuelIds.map((fid) => ({ type: "entity.deleted" as const, ref: { kind: "fuel" as const, id: fid } })),
    ...svcIds.map((sid) => ({ type: "entity.deleted" as const, ref: { kind: "service" as const, id: sid } })),
    { type: "entity.deleted", ref: { kind: "vehicle", id } },
  ]);
  return {
    ...next,
    fuel: next.fuel.filter((f) => f.vehicleId !== id),
    services: next.services.filter((s) => s.vehicleId !== id),
    parts: next.parts.filter((p) => p.vehicleId !== id),
    odometerLogs: next.odometerLogs.filter((row) => row.vehicleId !== id),
    vehicleJourneys: next.vehicleJourneys.filter((row) => row.vehicleId !== id),
  };
}

export function addFuel(db: DB, entry: FuelEntry): DB {
  return dispatch({ ...db, fuel: [...db.fuel, entry] }, [{ type: "fuel.added", entry }]);
}

export function addService(db: DB, entry: ServiceEntry): DB {
  return dispatch({ ...db, services: [...db.services, entry] }, [{ type: "service.added", entry }]);
}

export function addOdometerLog(db: DB, entry: OdometerLog): DB {
  return { ...db, odometerLogs: [...db.odometerLogs, entry] };
}

export function addVehicleJourney(db: DB, entry: VehicleJourney): DB {
  return { ...db, vehicleJourneys: [...db.vehicleJourneys, entry] };
}

export function closeVehicleJourney(db: DB, id: string, endAt: string, endOdometer: number): DB {
  return {
    ...db,
    vehicleJourneys: db.vehicleJourneys.map((row) =>
      row.id === id ? { ...row, endAt, endOdometer: Math.round(endOdometer) } : row,
    ),
  };
}

export function addTxn(db: DB, txn: Txn): DB {
  return { ...db, txns: [...db.txns, txn] };
}

export function upsertSubscription(db: DB, s: Subscription): DB {
  const exists = db.subscriptions.some((x) => x.id === s.id);
  return { ...db, subscriptions: exists ? db.subscriptions.map((x) => (x.id === s.id ? s : x)) : [...db.subscriptions, s] };
}

export function nextCycleDate(date: string, cycle: Subscription["cycle"]) {
  if (cycle === "weekly") return addDays(date, 7);
  if (cycle === "monthly") return addMonths(date, 1);
  if (cycle === "quarterly") return addMonths(date, 3);
  return addMonths(date, 12);
}

export function paySubscription(db: DB, id: string): DB {
  const sub = db.subscriptions.find((s) => s.id === id);
  if (!sub) return db;
  const updated = { ...sub, nextRenewal: nextCycleDate(sub.nextRenewal, sub.cycle) };
  return dispatch(upsertSubscription(db, updated), [{ type: "subscription.paid", sub, date: todayISO() }]);
}

export function removePaper(db: DB, id: string): DB {
  const paper = db.papers.find((p) => p.id === id);
  if (!paper) return db;
  bestEffortDeletePaperFiles(paper);
  const vehicleId = paper.vehicleId;
  let next = dispatch(
    { ...db, papers: db.papers.filter((p) => p.id !== id) },
    [{ type: "entity.deleted", ref: { kind: "paper", id } }],
  );
  if (vehicleId) next = syncVehicleExpiryFields(next, vehicleId);
  return next;
}

export function deleteEntity(db: DB, ref: Ref): DB {
  const key: Record<EntityKind, keyof DB> = { vehicle: "vehicles", fuel: "fuel", service: "services", txn: "txns", subscription: "subscriptions", trip: "trips", appliance: "appliances", note: "notes", media: "media", paper: "papers" };
  if (ref.kind === "vehicle") return deleteVehicle(db, ref.id);
  if (ref.kind === "paper") return removePaper(db, ref.id);
  const list = (db[key[ref.kind]] as { id: string }[]).filter((x) => x.id !== ref.id);
  return dispatch({ ...db, [key[ref.kind]]: list }, [{ type: "entity.deleted", ref }]);
}

/** All records linked to `ref`, in either direction. */
export function linkedRefs(db: DB, ref: Ref): { ref: Ref; rel: string }[] {
  const out: { ref: Ref; rel: string }[] = [];
  for (const l of db.links) {
    if (same(l.from, ref)) out.push({ ref: l.to, rel: l.rel });
    else if (same(l.to, ref)) out.push({ ref: l.from, rel: l.rel });
  }
  // implicit structural relations
  if (ref.kind === "fuel" || ref.kind === "service") {
    const rec = (ref.kind === "fuel" ? db.fuel : db.services).find((x) => x.id === ref.id);
    if (rec && !out.some((o) => o.ref.kind === "vehicle")) out.push({ ref: { kind: "vehicle", id: rec.vehicleId }, rel: "vehicle" });
  }
  return out.filter((o) => getEntity(db, o.ref));
}

export function getEntity(db: DB, ref: Ref): any {
  switch (ref.kind) {
    case "vehicle":
      return db.vehicles.find((x) => x.id === ref.id);
    case "fuel":
      return db.fuel.find((x) => x.id === ref.id);
    case "service":
      return db.services.find((x) => x.id === ref.id);
    case "txn":
      return db.txns.find((x) => x.id === ref.id);
    case "subscription":
      return db.subscriptions.find((x) => x.id === ref.id);
    case "trip":
      return db.trips.find((x) => x.id === ref.id);
    case "appliance":
      return db.appliances.find((x) => x.id === ref.id);
    case "note":
      return db.notes.find((x) => x.id === ref.id);
    case "media":
      return db.media.find((x) => x.id === ref.id);
    case "paper":
      return db.papers.find((x) => x.id === ref.id);
    default: {
      const unknown: never = ref.kind;
      return unknown;
    }
  }
}

export { SERVICE_LABEL };
