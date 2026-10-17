/**
 * Fuel station finder (plan §10). Data comes from OpenStreetMap over the same
 * optional Online rails as the weather — only the rounded city coords leave
 * the device, results live in the encrypted net cache so the list keeps
 * working offline. Company-owned pumps (`amenity=fuel`, `brand:wikidata` —
 * not exposed by OSM) are called by the person, and their favorites are
 * records in `db.stations`.
 */
import type { Station } from "./types";

const R = 6371;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const to = (x: number) => (x * Math.PI) / 180;
  const dLat = to(lat2 - lat1);
  const dLon = to(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(to(lat1)) * Math.cos(to(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** The query leaves the device with 2 decimal places — roughly a city block, like the weather. */
export const aroundQuery = (lat: number, lon: number) => {
  const a = Math.round(lat * 100) / 100;
  const b = Math.round(lon * 100) / 100;
  return {
    query: `${a},${b}`,
    bql: `[out:json][timeout:25];node(around:1200,${a},${b})[amenity=fuel];out center 60;`,
  };
};

export function parseStations(data: any, lat: number, lon: number): Station[] {
  const rows: any[] = Array.isArray(data?.elements) ? data.elements : [];
  const stations: Station[] = [];
  for (const row of rows) {
    if (row?.type !== "node") continue;
    const tags = row.tags ?? {};
    const id = `osm-${row.id}`;
    const name = typeof tags.name === "string" ? tags.name.slice(0, 80) : "";
    const brand = typeof tags.brand === "string" ? tags.brand.slice(0, 40) : undefined;
    if (!name && !brand) continue;
    const sLat = typeof row.lat === "number" ? row.lat : undefined;
    const sLon = typeof row.lon === "number" ? row.lon : undefined;
    if (!Number.isFinite(sLat) || !Number.isFinite(sLon)) continue;
    stations.push({ id, name: name || `${brand} fuel`, brand, lat: sLat, lon: sLon, meters: haversineKm(lat, lon, sLat, sLon) } as Station & { meters: number });
  }
  return stations as Station[];
}

/** The person's tags ride first, then the map, nearest of the nearest. */
export function combineStations(saved: Station[], fetched: Station[], home: { lat: number; lon: number }): Station[] {
  const merged = new Map<string, Station>();
  for (const row of fetched) merged.set(row.id, row);
  for (const row of saved) merged.set(row.id, { ...(merged.get(row.id) ?? row), favorite: row.favorite, coco: row.coco, name: row.name });
  const all = [...merged.values()];
  return all
    .map((row) => ({ row, distance: haversineKm(home.lat, home.lon, row.lat, row.lon) }))
    .sort((a, b) => {
      const ra = a.row.favorite ? -1 : a.row.coco ? 0 : 1;
      const rb = b.row.favorite ? -1 : b.row.coco ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return a.distance - b.distance;
    })
    .map(({ row, distance }) => ({ ...row, distance } as Station & { distance: number }));
}

/** Google Maps route preview to the pin — two taps, no search, no getting in. */
export function mapsRouteLink(station: { lat: number; lon: number }): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lon}&travelmode=driving`;
}

export function stationLabel(station: Station): string {
  return station.coco ? `${station.name} (COCO)` : station.favorite ? `★ ${station.name}` : station.name;
}
