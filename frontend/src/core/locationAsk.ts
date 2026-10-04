import type { Place } from "./types";

export type LocationPhase = "ask" | "read" | "stop";

export function locationPhase(input: { asked: boolean; granted: boolean; read: boolean }): LocationPhase {
  if (input.read) return "stop";
  if (!input.asked) return "ask";
  if (input.granted) return "read";
  return "stop";
}

export const CAN_TOGGLE_SYSTEM_LOCATION = false;

export function placeFromFix(fix: { lat: number; lon: number }, name: string): Place {
  return { name: name || "This phone", lat: fix.lat, lon: fix.lon };
}
