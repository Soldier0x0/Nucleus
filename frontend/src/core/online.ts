/**
 * Optional Online layer. OFF by default. When off, `onlineFetch` refuses to make any request.
 * Only the query itself leaves the device (currency code, city name / coords) — never records.
 * Every request is written to the network log; results are cached for offline use.
 */
import { Platform } from "react-native";
import { loadSecureDoc, saveSecureDoc } from "./crypto";
import type { DB, NetLogEntry, Place } from "./types";
import { uid } from "./format";

const CACHE_KEY = "nucleus.netcache.v1";
type Cache = Record<string, { at: string; data: any }>;
let mem: Cache | null = null;

async function cache(): Promise<Cache> {
  if (!mem) mem = (await loadSecureDoc<Cache>(CACHE_KEY)) ?? {};
  return mem!;
}

export async function cached<T = any>(key: string): Promise<{ at: string; data: T } | null> {
  return (await cache())[key] ?? null;
}

export type Logger = (e: NetLogEntry) => void;

/** HTTPS GET with log + cache. Falls back to cache on failure. Returns null when Online is off and nothing cached. */
export async function onlineFetch<T = any>(online: boolean, log: Logger, service: string, query: string, url: string, maxAgeMin = 60): Promise<{ data: T; at: string; stale: boolean } | null> {
  const key = `${service}:${query}`;
  const c = await cache();
  const hit = c[key];
  if (hit && Date.now() - new Date(hit.at).getTime() < maxAgeMin * 60000) return { data: hit.data, at: hit.at, stale: false };
  if (!online) return hit ? { data: hit.data, at: hit.at, stale: true } : null;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(String(r.status));
    const data = await r.json();
    c[key] = { at: new Date().toISOString(), data };
    saveSecureDoc(CACHE_KEY, c);
    log({ id: uid(), at: new Date().toISOString(), service, query, ok: true });
    return { data, at: c[key].at, stale: false };
  } catch {
    log({ id: uid(), at: new Date().toISOString(), service, query, ok: false });
    return hit ? { data: hit.data, at: hit.at, stale: true } : null;
  }
}

export const appendLog = (db: DB, e: NetLogEntry): DB => ({ ...db, netlog: [e, ...db.netlog].slice(0, 300) });

// ---------- services (free, no key) ----------
export async function geocode(online: boolean, log: Logger, name: string): Promise<Place[]> {
  const r = await onlineFetch<any>(online, log, "Open-Meteo geocoding", name.toLowerCase(), `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=en&format=json`, 60 * 24 * 30);
  return (r?.data?.results ?? []).map((p: any) => ({ name: [p.name, p.admin1, p.country].filter(Boolean).join(", "), lat: p.latitude, lon: p.longitude, country: p.country, countryCode: p.country_code, elevation: typeof p.elevation === "number" ? p.elevation : undefined }));
}

const round = (x: number) => Math.round(x * 100) / 100; // about 1 km

export type Weather = {
  current: { temp: number; feels?: number; code: number; wind: number };
  daily: { date: string; max: number; min: number; code: number }[];
  sunrise?: string;
  sunset?: string;
  aqi?: number;
};

export async function weather(online: boolean, log: Logger, p: Place) {
  const lat = round(p.lat), lon = round(p.lon);
  const elev = typeof p.elevation === "number" ? `&elevation=${Math.round(p.elevation)}` : "";
  const r = await onlineFetch<any>(online, log, "Open-Meteo weather", `${lat},${lon}`, `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}${elev}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset&timezone=auto&forecast_days=7&temperature_unit=celsius&wind_speed_unit=kmh&cell_selection=land`, 30);
  if (!r) return null;
  const aq = await onlineFetch<any>(online, log, "Open-Meteo air quality", `${lat},${lon}`, `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`, 120);
  const d = r.data;
  const w: Weather = {
    current: { temp: d.current?.temperature_2m, feels: d.current?.apparent_temperature, code: d.current?.weather_code, wind: d.current?.wind_speed_10m },
    daily: (d.daily?.time ?? []).map((t: string, i: number) => ({ date: t, max: d.daily.temperature_2m_max[i], min: d.daily.temperature_2m_min[i], code: d.daily.weather_code[i] })),
    sunrise: d.daily?.sunrise?.[0]?.slice(11, 16),
    sunset: d.daily?.sunset?.[0]?.slice(11, 16),
    aqi: aq?.data?.current?.us_aqi,
  };
  return { w, at: r.at, stale: r.stale };
}

export async function rates(online: boolean, log: Logger, base: string): Promise<{ rates: Record<string, number>; at: string; stale: boolean } | null> {
  const r = await onlineFetch<any>(online, log, "Frankfurter rates", base, `https://api.frankfurter.dev/v1/latest?base=${base}`, 360);
  return r ? { rates: { ...r.data.rates, [base]: 1 }, at: r.at, stale: r.stale } : null;
}

export async function holidays(online: boolean, log: Logger, year: number, cc: string): Promise<{ date: string; name: string }[]> {
  const r = await onlineFetch<any>(online, log, "Nager.Date holidays", `${year}/${cc}`, `https://date.nager.at/api/v3/PublicHolidays/${year}/${cc.toUpperCase()}`, 60 * 24 * 7);
  return (r?.data ?? []).map((h: any) => ({ date: h.date, name: h.localName || h.name }));
}

export async function countryFacts(online: boolean, log: Logger, cc: string) {
  // REST Countries blocks browser CORS; it works in the installed app.
  if (Platform.OS === "web") return null;
  const r = await onlineFetch<any>(online, log, "REST Countries", cc, `https://restcountries.com/v3.1/alpha/${cc}?fields=currencies,timezones,car,capital,languages`, 60 * 24 * 30);
  const d = Array.isArray(r?.data) ? r?.data[0] : r?.data;
  if (!d) return null;
  return { currency: Object.keys(d.currencies ?? {})[0], timezone: d.timezones?.[0], driving: d.car?.side, capital: d.capital?.[0], languages: Object.values(d.languages ?? {}).slice(0, 2).join(", ") };
}

const WMO: Record<number, [string, string]> = {
  0: ["Clear", "weather-sunny"], 1: ["Mostly clear", "weather-partly-cloudy"], 2: ["Partly cloudy", "weather-partly-cloudy"], 3: ["Overcast", "weather-cloudy"],
  45: ["Fog", "weather-fog"], 48: ["Fog", "weather-fog"], 51: ["Drizzle", "weather-rainy"], 53: ["Drizzle", "weather-rainy"], 55: ["Drizzle", "weather-rainy"],
  61: ["Rain", "weather-pouring"], 63: ["Rain", "weather-pouring"], 65: ["Heavy rain", "weather-pouring"], 71: ["Snow", "weather-snowy"], 73: ["Snow", "weather-snowy"], 75: ["Snow", "weather-snowy-heavy"],
  80: ["Showers", "weather-rainy"], 81: ["Showers", "weather-rainy"], 82: ["Storm showers", "weather-pouring"], 95: ["Thunderstorm", "weather-lightning"], 96: ["Thunderstorm", "weather-lightning-rainy"], 99: ["Thunderstorm", "weather-lightning-rainy"],
};
export const wmo = (c: number) => WMO[c] ?? ["—", "weather-cloudy"];
