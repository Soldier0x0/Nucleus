import { useEffect, useMemo, useState } from "react";
import { useStore } from "../store";
import type { Place, Station } from "@core/types";
import { uid } from "@core/format";
import { isTauri } from "../platform/env";
import { localPrefs } from "../platform/storage";
import { distanceKm, mapsLink, mergeStations, nominatimRequest, overpassRequest, parseNominatim, parseOverpass, type PumpDraft } from "../platform/stations";

type Cached = { city: string; place: Pick<Place, "name" | "lat" | "lon">; drafts: PumpDraft[]; at: string };

const CACHE_KEY = "stationFinderCache";

/** Overpass search around the home city; favorites first; Google Maps hand-off (v0.15). */
export function StationFinder() {
  const { db, update, setSettings } = useStore();
  const [city, setCity] = useState(db.settings.homeCity?.name ?? "");
  const [place, setPlace] = useState<Pick<Place, "name" | "lat" | "lon"> | null>(db.settings.homeCity ?? null);
  const [drafts, setDrafts] = useState<PumpDraft[]>([]);
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const cached: Cached | null = (() => {
      try {
        return JSON.parse(localPrefs.get(CACHE_KEY) ?? "null") as Cached | null;
      } catch {
        return null;
      }
    })();
    if (cached?.place && Array.isArray(cached.drafts)) {
      setPlace(cached.place);
      setDrafts(cached.drafts);
      if (!city) setCity(cached.city ?? "");
      setMessage(`Cached search from ${new Date(cached.at).toLocaleString()}. Search again for fresh pumps.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saved = useMemo(() => db.stations, [db.stations]);
  const home = place;
  const rows = useMemo<(Station & { dist?: number })[]>(() => (home ? mergeStations(home, saved, drafts) : saved), [home, saved, drafts]);

  const geocode = async (): Promise<Pick<Place, "name" | "lat" | "lon">> => {
    const res = await fetch(nominatimRequest(city));
    const parsed = parseNominatim(await res.text());
    if (!parsed) throw new Error(`Could not find "${city}".`);
    return parsed;
  };

  const search = async () => {
    if (status === "busy") return;
    if (!city.trim()) {
      setStatus("error");
      setMessage("Type a city first.");
      return;
    }
    setStatus("busy");
    setMessage("");
    try {
      const found = place && place.name && place.name.toLowerCase() === city.trim().toLowerCase() ? place : await geocode();
      const { url, body } = overpassRequest(found);
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `data=${encodeURIComponent(body)}` });
      if (!res.ok) throw new Error(`The pump index is not answering (${res.status}). Try again later.`);
      const next = parseOverpass(await res.text());
      setPlace(found);
      setDrafts(next);
      setStatus("idle");
      setMessage(next.length ? `${next.length} pumps near ${found.name}.` : "No pumps found this close to that place.");
      const cache: Cached = { city: city.trim(), place: found, drafts: next.slice(0, 40), at: new Date().toISOString() };
      localPrefs.set(CACHE_KEY, JSON.stringify(cache));
      if (db.settings.homeCity?.name !== found.name) {
        setSettings({ ...db.settings, homeCity: { name: found.name, lat: found.lat, lon: found.lon } });
      }
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "The search failed.");
    }
  };

  const saveStation = (f: Station & { dist?: number }) => {
    if (saved.some((s) => s.id === f.id || (s.name === f.name && s.brand === f.brand))) return;
    update((d) => ({ ...d, stations: [...d.stations, { id: f.id || `local-${uid()}`, name: f.name, brand: f.brand, lat: f.lat, lon: f.lon }] }));
  };

  const toggleFavorite = (s: Station & { dist?: number }) =>
    update((d) => ({ ...d, stations: d.stations.map((x) => (x.id === s.id ? { ...x, favorite: !x.favorite } : x)) }));

  const removeStation = (id: string) => update((d) => ({ ...d, stations: d.stations.filter((x) => x.id !== id) }));

  const openMaps = async (s: { lat: number; lon: number }) => {
    const link = home
      ? mapsLink(home, s)
      : `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lon}`;
    if (isTauri()) {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(link);
    } else {
      window.open(link, "_blank", "noopener");
    }
  };

  return (
    <section className="card" data-testid="station-finder">
      <div className="row spread" style={{ marginBottom: 8 }}>
        <h2 className="rail-label">Fuel stations{place ? ` · ${place.name}` : ""}</h2>
        <span className="chip">{saved.length} saved</span>
      </div>
      <div className="row" style={{ marginBottom: 8 }}>
        <input
          className="grow"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void search()}
          placeholder="City to search around"
          style={{ maxWidth: 260 }}
          data-testid="station-city"
        />
        <button className="small-btn" onClick={() => void search()} disabled={status === "busy"} data-testid="station-search">
          {status === "busy" ? "Searching…" : "Find pumps"}
        </button>
      </div>
      {message ? <p className={status === "error" ? "error small muted" : "muted small"}>{message}</p> : null}
      {rows.length === 0 && status !== "busy" ? (
        <p className="muted small">Saved pumps move to the top of the fuel-log station list. Search here to pull the OSM index around your city.</p>
      ) : null}
      <div>
        {rows.map((s) => (
          <div className="sta-row" key={s.id || `${s.name}@${s.lat},${s.lon}`}>
            <button
              className="link"
              title="Toggle favorite"
              onClick={() => (saved.some((x) => x.id === s.id) ? toggleFavorite(s) : saveStation(s))}
              style={{ fontSize: 16 }}
            >
              {saved.find((x) => x.id === s.id)?.favorite ? "★" : saved.some((x) => x.id === s.id) ? "☆" : "+"}
            </button>
            <div className="grow">
              <div className="t">{s.name}</div>
              <div className="m">{[s.brand, s.dist !== undefined ? `${s.dist} km` : ""].filter(Boolean).join(" · ")}</div>
            </div>
            {saved.some((x) => x.id === s.id && !saved.find((x) => x.id === s.id)?.favorite) ? (
              <button className="link danger" title="Remove from saved" onClick={() => removeStation(s.id)}>✕</button>
            ) : null}
            <button className="small-btn" onClick={() => void openMaps(s)}>Maps</button>
          </div>
        ))}
      </div>
    </section>
  );
}
