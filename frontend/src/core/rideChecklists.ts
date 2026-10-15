/**
 * Ride / trip checklist for a vehicle journey (plan 6.6).
 * The template lives on the vehicle; a journey gets a copy with fresh ids, so
 * ticking or editing a ride never touches the saved template.
 */
import type { ChecklistItem, Vehicle } from "./types";
import { uid } from "./format";

/** A sane starting list per vehicle type. The person can edit it on the vehicle. */
export const RIDE_CHECKLIST_DEFAULTS: Record<Vehicle["type"], string[]> = {
  bike: ["Helmet", "Licence and RC", "Insurance copy", "Tyres and pressure", "Lights and indicators", "Mirrors", "Brakes", "Chain lube", "Fuel"],
  car: ["Licence and RC", "Insurance copy", "Tyres and spare", "Lights and indicators", "Mirrors", "Brakes", "Fuel", "Seat belts", "First-aid kit"],
  other: ["Documents", "Tyres and pressure", "Lights and indicators", "Brakes", "Fuel"],
};

/** The saved template, else the default for this vehicle type. */
export function rideChecklistTemplate(vehicle: Pick<Vehicle, "type" | "rideChecklist">): string[] {
  const saved = (vehicle.rideChecklist ?? []).map((text) => text.trim()).filter(Boolean);
  return saved.length ? saved : [...RIDE_CHECKLIST_DEFAULTS[vehicle.type]];
}

/** Copy-on-use: a journey gets its own items with fresh ids. The template never changes. */
export function newRideChecklist(texts: string[]): ChecklistItem[] {
  return texts
    .map((text) => ({ id: uid(), text: String(text).trim().slice(0, 60), done: false }))
    .filter((item) => item.text.length > 0);
}

export function toggleRideChecklistItem(items: ChecklistItem[], id: string): ChecklistItem[] {
  return items.map((item) => (item.id === id ? { ...item, done: !item.done } : item));
}

export function rideChecklistProgress(items: ChecklistItem[]): { done: number; total: number } {
  return { done: items.filter((item) => item.done).length, total: items.length };
}
