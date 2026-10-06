/**
 * Fixed-time water reminders. Nothing is counted.
 */
import type { WaterState, WaterTime } from "./types";

export function emptyWater(): WaterState {
  return { times: [] };
}

function clock(hour: number, minute: number): { hour: number; minute: number } {
  return {
    hour: Math.min(23, Math.max(0, Math.round(hour))),
    minute: Math.min(59, Math.max(0, Math.round(minute))),
  };
}

export function normalizeWater(raw: unknown): WaterState {
  const src = raw && typeof raw === "object" ? (raw as { times?: unknown }).times : undefined;
  if (!Array.isArray(src)) return emptyWater();
  const times: WaterTime[] = [];
  for (const item of src) {
    if (!item || typeof item !== "object") continue;
    const row = item as { id?: unknown; hour?: unknown; minute?: unknown };
    if (typeof row.hour !== "number" || typeof row.minute !== "number") continue;
    const at = clock(row.hour, row.minute);
    if (times.some((time) => time.hour === at.hour && time.minute === at.minute)) continue;
    const id = typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 40) : `water-${at.hour}-${at.minute}`;
    times.push({ id, hour: at.hour, minute: at.minute });
    if (times.length >= 8) break;
  }
  return { times };
}

export function addWaterTime(state: WaterState, hour: number, minute: number, id?: string): WaterState {
  const at = clock(hour, minute);
  if (state.times.some((time) => time.hour === at.hour && time.minute === at.minute)) return state;
  const next: WaterTime = { id: id ?? `water-${at.hour}-${at.minute}`, hour: at.hour, minute: at.minute };
  return { times: [...state.times, next].slice(0, 8) };
}

export function removeWaterTime(state: WaterState, id: string): WaterState {
  return { times: state.times.filter((time) => time.id !== id) };
}

/** If the chosen clock time sits inside quiet hours, the reminder moves to the end of that quiet block. */
export function shiftWaterClock(hour: number, minute: number, quiet: { enabled: boolean; from: number; to: number }): { hour: number; minute: number } {
  const at = clock(hour, minute);
  if (!quiet.enabled) return at;
  const inQuiet = quiet.from > quiet.to ? at.hour >= quiet.from || at.hour < quiet.to : at.hour >= quiet.from && at.hour < quiet.to;
  if (!inQuiet) return at;
  return { hour: Math.min(23, Math.max(0, quiet.to)), minute: 0 };
}

export function waterNoticeCopy(hide: boolean): { title: string; body: string } {
  if (hide) return { title: "Reminder", body: "" };
  return { title: "Water", body: "A sip, at a time you set." };
}

export function formatWaterTime(hour: number, minute: number, format: "12h" | "24h"): string {
  const at = clock(hour, minute);
  if (format === "24h") return `${String(at.hour).padStart(2, "0")}:${String(at.minute).padStart(2, "0")}`;
  const suffix = at.hour >= 12 ? "PM" : "AM";
  const hour12 = at.hour % 12 || 12;
  return `${hour12}:${String(at.minute).padStart(2, "0")} ${suffix}`;
}
