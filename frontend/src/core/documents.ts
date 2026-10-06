import type { DB, Vehicle } from "./types";

export type BoardTile = { id: string; size: "large" | "small" };

const DOCUMENT_TILES = ["docgaps", "docids", "docinsurance", "doctrips", "docfiles"] as const;

function insuranceGap(db: DB, vehicle: Vehicle): string | null {
  if (vehicle.insuranceExpiry) return null;
  const name = vehicle.name.trim();
  if (!name) return null;
  const titled = `${name} insurance`;
  const covered = db.papers.some((paper) => paper.kind === "insurance" && (paper.vehicleId === vehicle.id || paper.title.trim() === titled));
  if (covered) return null;
  return titled;
}

/** Every open paper, by its own name. A blank name is not replaced with a count. */
export function missingDocumentNames(db: DB): string[] {
  const names: string[] = [];
  for (const trip of db.trips) {
    for (const doc of trip.docs) {
      if (doc.have) continue;
      const name = doc.name.trim();
      names.push(name || "Could not tell which document");
    }
  }
  for (const vehicle of db.vehicles) {
    const gap = insuranceGap(db, vehicle);
    if (gap) names.push(gap);
  }
  return names;
}

export function documentBoardItems(db: DB): BoardTile[] {
  const fuller = missingDocumentNames(db).length > 1;
  return DOCUMENT_TILES.map((id) => ({ id, size: id === "docgaps" && fuller ? "large" : "small" }));
}

export function documentCardCopy(db: DB, id: string): { title: string; lines: string[] } {
  const missing = missingDocumentNames(db);
  const papers = db.papers;
  switch (id) {
    case "docgaps":
      return { title: "Missing", lines: missing.length ? missing : ["Nothing missing"] };
    case "docids": {
      const rows = papers.filter((paper) => paper.kind === "licence" || paper.kind === "passport");
      return { title: "IDs", lines: rows.length ? rows.map((paper) => paper.title) : ["No ID yet"] };
    }
    case "docinsurance": {
      const rows = papers.filter((paper) => paper.kind === "insurance");
      return { title: "Insurance", lines: rows.length ? rows.map((paper) => paper.title) : ["No insurance page yet"] };
    }
    case "doctrips": {
      const rows = db.trips.flatMap((trip) => trip.docs.map((doc) => doc.name.trim()).filter(Boolean));
      return { title: "Trip docs", lines: rows.length ? rows : ["No trip docs yet"] };
    }
    case "docfiles": {
      const rows = papers.filter((paper) => paper.kind !== "licence" && paper.kind !== "passport" && paper.kind !== "insurance");
      return { title: "Papers", lines: rows.length ? rows.map((paper) => paper.title) : ["No other papers yet"] };
    }
    default:
      return { title: "Documents", lines: missing.length ? missing : ["Nothing missing"] };
  }
}
