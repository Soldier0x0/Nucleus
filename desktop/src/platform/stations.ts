/**
 * Fuel-station lookup on desktop (v0.15). The phone tags favorite pumps;
 * the desktop can search OSM Overpass around the home city, keep the
 * favorites in db.stations, cache the last search locally and hand a
 * Google Maps link to the opener plugin. Only the pure pieces live here;
 * network calls stay in the component.
 */
import type { Place, Station } from "@core/types";

export type PumpDraft = { osmId: string; name: string; brand?: string; lat: number; lon: number };

const QUERY_HEAD = "[out:json][timeout:25];node[\"amenity\"=\"fuel\"]";

export function aroundRadiusMeters(): number {
  return 30000;
}

/** The Overpass request: POST body for url, query as the body. */
export function overpassRequest(place: Pick<Place, "lat" | "lon">): { url: string; body: string } {
  return {
    url: "https://overpass-api.de/api/interpreter",
    body: `${QUERY_HEAD}(around:${aroundRadiusMeters()},${place.lat.toFixed(5)},${place.lon.toFixed(5)});out body ${RESULT_CAP};`,
  };
}

export const RESULT_CAP = 40;

/** Nominatim geocode for the city box. Best effort; failures fall back to a typed place. */
export function nominatimRequest(city: string): string {
  return `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(city.trim())}`;
}

export function parseNominatim(text: string): Pick<Place, "lat" | "lon" | "name"> | null {
  let rows: Record<string, unknown>[];
  try {
    rows = JSON.parse(text) as Record<string, unknown>[];
  } catch {
    return null;
  }
  const row = rows[0];
  const lat = row && Number(row.lat);
  const lon = row && Number(row.lon);
  const name = row && typeof row.display_name === "string" ? row.display_name.split(",")[0] : "";
  if (!row || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon, name };
}

export function parseOverpass(text: string): PumpDraft[] {
  let data: { elements?: { type?: string; id?: number; lat?: number; lon?: number; tags?: Record<string, string> }[] };
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  const out: PumpDraft[] = [];
  for (const el of data.elements ?? []) {
    if (el.type !== "node" || typeof el.lat !== "number" || typeof el.lon !== "number") continue;
    const tags = el.tags ?? {};
    const name = (tags.name ?? "").trim();
    const brand = (tags.brand ?? "").trim() || undefined;
    out.push({ osmId: String(el.id ?? ""), name, brand, lat: el.lat, lon: el.lon });
  }
  return out;
}

/** Great-circle distance in kilometres (handy for sorting "nearest" first). */
export function distanceKm(a: Pick<Place, "lat" | "lon">, b: Pick<Place, "lat" | "lon">): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}

export function mapsLink(from: Pick<Place, "lat" | "lon">, station: Pick<Place, "lat" | "lon">): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lon}&destination=${station.lat},${station.lon}`;
}

export function toStation(d: PumpDraft): Station {
  return { id: `osm-${d.osmId}`, name: d.name || d.brand || "Fuel station", brand: d.brand, lat: d.lat, lon: d.lon };
}

/** Favorites first, then nearest; OSM drafts never duplicate an already-saved station. */
export function mergeStations(home: Pick<Place, "lat" | "lon">, saved: Station[], drafts: PumpDraft[]): (Station & { dist?: number })[] {
  const known = new Set(saved.map((s) => `${s.name}|${s.brand ?? ""}`).map((k) => k.toLowerCase()));
  const fresh = drafts
    .map(toStation)
    .filter((s) => !known.has(`${s.name}|${s.brand ?? ""}`.toLowerCase()))
    .map((s) => ({ ...s, dist: distanceKm(home, s) }));
  return [
    ...saved.filter((s) => s.favorite).map((s) => ({ ...s, dist: distanceKm(home, s) })),
    ...fresh,
    ...saved.filter((s) => !s.favorite).map((s) => ({ ...s, dist: distanceKm(home, s) })),
  ];
}
