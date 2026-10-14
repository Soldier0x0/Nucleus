import type { DB, HeadsUpChoice } from "./types";
import { addDays } from "./format";
import { repeatingBills } from "./moneyDesk";
import { rangeLeft, serviceLeft } from "./tripMath";
import { askUnsynced } from "./vaultFile";

export type HeadsUp = {
  id: string;
  line: string;
  tone: "plain";
  sound: false;
  actions: string[];
};

const SERVICE_SOON_KM = 500;

function odometer(db: DB, vehicleId: string, initial: number): number {
  const fuel = db.fuel.filter((row) => row.vehicleId === vehicleId).map((row) => row.odometer);
  const services = db.services.filter((row) => row.vehicleId === vehicleId).map((row) => row.odometer);
  return Math.max(initial, ...fuel, ...services);
}

function mileageKmPerL(db: DB, vehicleId: string): number | null {
  const fills = db.fuel.filter((row) => row.vehicleId === vehicleId).sort((a, b) => a.odometer - b.odometer);
  if (fills.length < 2) return null;
  const dist = fills[fills.length - 1].odometer - fills[0].odometer;
  const litres = fills.slice(1).reduce((sum, row) => sum + row.litres, 0);
  if (dist <= 0 || litres <= 0) return null;
  return dist / litres;
}

type FuelState = "none" | "ok" | "short" | "unsure";

function fuelState(db: DB, today: string): { state: FuelState; tripId: string; tripName: string } {
  const trip = db.trips.find((row) => row.end >= today);
  if (!trip) return { state: "none", tripId: "", tripName: "" };
  const vehicle = db.vehicles.find((row) => db.fuel.some((fill) => fill.vehicleId === row.id)) ?? db.vehicles[0];
  if (!vehicle) return { state: "none", tripId: trip.id, tripName: trip.name };
  const fills = db.fuel.filter((row) => row.vehicleId === vehicle.id).sort((a, b) => a.odometer - b.odometer);
  if (fills.length < 2) return { state: fills.length === 1 ? "unsure" : "none", tripId: trip.id, tripName: trip.name };
  const mileage = mileageKmPerL(db, vehicle.id);
  if (mileage === null) return { state: "unsure", tripId: trip.id, tripName: trip.name };
  const last = fills[fills.length - 1];
  const driven = Math.max(0, odometer(db, vehicle.id, vehicle.initialOdometer) - last.odometer);
  const range = rangeLeft(mileage, last.litres, driven);
  return { state: range.warn ? "short" : "ok", tripId: trip.id, tripName: trip.name };
}

function serviceSoon(db: DB): { id: string; km: number } | null {
  for (const vehicle of db.vehicles) {
    const services = db.services.filter((row) => row.vehicleId === vehicle.id).sort((a, b) => a.odometer - b.odometer);
    const last = services.length ? services[services.length - 1].odometer : vehicle.initialOdometer;
    const left = serviceLeft(odometer(db, vehicle.id, vehicle.initialOdometer), last, vehicle.serviceIntervalKm);
    if (left >= 0 && left <= SERVICE_SOON_KM) return { id: vehicle.id, km: left };
  }
  return null;
}

function skipped(db: DB, id: string): boolean {
  return db.settings.headsUp.dismissed.includes(id) || db.settings.headsUp.answers.some((row) => row.id === id);
}

function plain(id: string, line: string, actions: string[] = []): HeadsUp {
  return { id, line, tone: "plain", sound: false, actions };
}

/** One heads-up. A second candidate waits until this one is dismissed. */
export function nextHeadsUp(db: DB, today: string): HeadsUp | null {
  const tomorrow = addDays(today, 1);
  const bill = repeatingBills(db.txns).find((row) => row.next === tomorrow);
  if (bill) {
    const id = `bill:${bill.name}:${bill.next}`;
    if (!skipped(db, id)) return plain(id, `${bill.name} is due tomorrow`);
  }
  const fuel = fuelState(db, today);
  if (fuel.state === "short") {
    const id = `fuel:${fuel.tripId}`;
    if (!skipped(db, id)) return plain(id, `Fuel for ${fuel.tripName}`);
  }
  const service = serviceSoon(db);
  if (service) {
    const id = `service:${service.id}`;
    if (!skipped(db, id)) return plain(id, `Service interval: ${service.km} km`);
  }
  const cloud = db.settings.cloud;
  const unsynced = askUnsynced({
    provider: cloud.provider,
    lastSyncAt: cloud.lastSyncAt ?? null,
    unlockedAt: cloud.unlockedAt ?? "",
    asked: cloud.askedSinceUnlock,
  });
  if (unsynced && cloud.unlockedAt) {
    if (!skipped(db, "backup")) return plain("backup", "Backup has not synced since the last unlock");
  }
  if (fuel.state === "unsure") {
    const id = `ask:fuel:${fuel.tripId}`;
    if (!skipped(db, id)) return plain(id, "Check fuel for this trip?", ["Yes", "No"]);
  }
  return null;
}

export function dismissHeadsUp(db: DB, id: string): DB {
  if (!id || db.settings.headsUp.dismissed.includes(id)) return db;
  return {
    ...db,
    settings: { ...db.settings, headsUp: { ...db.settings.headsUp, dismissed: [...db.settings.headsUp.dismissed, id] } },
  };
}

export function rememberHeadsUp(db: DB, id: string, choice: HeadsUpChoice): DB {
  if (!id) return db;
  const next = dismissHeadsUp(db, id);
  const answers = next.settings.headsUp.answers.filter((row) => row.id !== id);
  return {
    ...next,
    settings: { ...next.settings, headsUp: { ...next.settings.headsUp, answers: [...answers, { id, choice }] } },
  };
}
