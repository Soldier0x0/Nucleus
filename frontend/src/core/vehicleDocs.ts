import type { DB, Paper } from "./types";
import { daysBetween, todayISO } from "./format";
import { motorPolicyBadges } from "./vehicleMath";

export type VehicleDocTileId = "vdoc-motor" | "vdoc-pa" | "vdoc-puc";

export function motorPaper(db: DB, vehicleId: string): Paper | undefined {
  return db.papers.find(
    (p) =>
      p.vehicleId === vehicleId &&
      p.kind === "insurance" &&
      (p.motorCover === "comprehensive" || p.motorCover === "third-party"),
  );
}

export function personalAccidentPaper(db: DB, vehicleId: string): Paper | undefined {
  return db.papers.find((p) => p.vehicleId === vehicleId && p.kind === "personal_accident");
}

export function pucPaper(db: DB, vehicleId: string): Paper | undefined {
  return db.papers.find((p) => p.vehicleId === vehicleId && p.kind === "puc");
}

export function vehicleDocTileIds(db: DB, vehicleId: string): VehicleDocTileId[] {
  const out: VehicleDocTileId[] = [];
  if (motorPaper(db, vehicleId)) out.push("vdoc-motor");
  if (personalAccidentPaper(db, vehicleId)) out.push("vdoc-pa");
  if (pucPaper(db, vehicleId)) out.push("vdoc-puc");
  return out;
}

export function vehicleDocBoardItems(db: DB): { id: string; size: "large" | "small" }[] {
  const vehicle = db.vehicles[0];
  if (!vehicle) return [];
  return vehicleDocTileIds(db, vehicle.id).map((id) => ({ id, size: id === "vdoc-motor" ? "large" as const : "small" as const }));
}

export function paperForVehicleDocTile(db: DB, vehicleId: string, tile: VehicleDocTileId): Paper | undefined {
  switch (tile) {
    case "vdoc-motor":
      return motorPaper(db, vehicleId);
    case "vdoc-pa":
      return personalAccidentPaper(db, vehicleId);
    case "vdoc-puc":
      return pucPaper(db, vehicleId);
    default: {
      const never: never = tile;
      return never;
    }
  }
}

/** One motor policy per vehicle. Saving a new cover drops the other motor row. */
export function applyMotorXor(db: DB, saved: Paper): Paper[] {
  if (saved.kind !== "insurance" || !saved.vehicleId || !saved.motorCover) {
    return db.papers.some((p) => p.id === saved.id)
      ? db.papers.map((p) => (p.id === saved.id ? saved : p))
      : [saved, ...db.papers];
  }
  const rest = db.papers.filter(
    (p) =>
      p.id === saved.id ||
      p.vehicleId !== saved.vehicleId ||
      p.kind !== "insurance" ||
      !(p.motorCover === "comprehensive" || p.motorCover === "third-party"),
  );
  const merged = rest.some((p) => p.id === saved.id) ? rest.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...rest];
  return merged;
}

export function syncVehicleExpiryFields(db: DB, vehicleId: string): DB {
  const vehicle = db.vehicles.find((v) => v.id === vehicleId);
  if (!vehicle) return db;
  const motor = motorPaper(db, vehicleId);
  const puc = pucPaper(db, vehicleId);
  const insuranceExpiry = motor?.expiry ?? vehicle.insuranceExpiry;
  const pucExpiry = puc?.expiry ?? vehicle.pucExpiry;
  if (insuranceExpiry === vehicle.insuranceExpiry && pucExpiry === vehicle.pucExpiry) return db;
  return {
    ...db,
    vehicles: db.vehicles.map((v) =>
      v.id === vehicleId ? { ...v, insuranceExpiry, pucExpiry } : v,
    ),
  };
}

export function vehicleDocTileTitle(tile: VehicleDocTileId): string {
  switch (tile) {
    case "vdoc-motor":
      return "Motor policy";
    case "vdoc-pa":
      return "Personal accident";
    case "vdoc-puc":
      return "PUC";
    default: {
      const never: never = tile;
      return never;
    }
  }
}

export function vehicleDocTileLines(db: DB, vehicleId: string, tile: VehicleDocTileId, today = todayISO()): string[] {
  const paper = paperForVehicleDocTile(db, vehicleId, tile);
  if (!paper) return ["Not on file"];
  const lines = [paper.title];
  if (tile === "vdoc-motor") {
    const badges = motorPolicyBadges(paper);
    if (badges.length) lines.push(badges.join(" · "));
  }
  if (paper.expiry) {
    const d = daysBetween(today, paper.expiry);
    lines.push(d < 0 ? `Expired ${paper.expiry}` : d === 0 ? "Expires today" : `${d} days left`);
  } else if (paper.number) {
    lines.push(paper.number);
  }
  return lines;
}

export function paperExpiryDays(paper: Paper, today = todayISO()): number | null {
  if (!paper.expiry) return null;
  return daysBetween(today, paper.expiry);
}

/** Drop legacy RSA-only board tiles from saved home order. */
export function stripLegacyDocTiles(ids: string[]): string[] {
  return ids.filter((id) => id !== "vdoc-rsa" && id !== "fueltank");
}
