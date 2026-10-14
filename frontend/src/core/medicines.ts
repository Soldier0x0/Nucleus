import type { DB, Medicine, MedicineLog } from "./types";
import type { Reminder } from "./rules";
import { addDays, toISODate, uid } from "./format";

const pad = (n: number) => String(n).padStart(2, "0");
export const medTime = (t: { hour: number; minute: number }) => `${pad(t.hour)}:${pad(t.minute)}`;

export function parseTimes(text: string): { hour: number; minute: number }[] | null {
  const parts = text.split(/[\s,]+/).filter(Boolean);
  const out: { hour: number; minute: number }[] = [];
  for (const p of parts) {
    const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(p);
    if (!m) return null;
    const t = { hour: Number(m[1]), minute: Number(m[2]) };
    if (!out.some((x) => x.hour === t.hour && x.minute === t.minute)) out.push(t);
  }
  return out.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
}

/** Why a medicine cannot be saved, or null. Name and at least one time are required. */
export function medicineProblem(name: string, timesText: string): string | null {
  if (!name.trim()) return "Add the medicine name";
  const times = parseTimes(timesText);
  if (!times) return "Enter times as HH:MM, for example 08:00, 21:00";
  if (!times.length) return "Add at least one time";
  return null;
}

export function newMedicine(name: string, times: { hour: number; minute: number }[], dose?: string, notes?: string): Medicine {
  const now = new Date().toISOString();
  return { id: uid(), name: name.trim().slice(0, 60), times, dose: dose?.trim() || undefined, notes: notes?.trim() || undefined, active: true, log: [], createdAt: now, updatedAt: now };
}

export function upsertMedicine(db: DB, med: Medicine): DB {
  const exists = db.medicines.some((m) => m.id === med.id);
  const next = { ...med, updatedAt: new Date().toISOString() };
  return { ...db, medicines: exists ? db.medicines.map((m) => (m.id === med.id ? next : m)) : [next, ...db.medicines] };
}

export function removeMedicine(db: DB, id: string): DB {
  return { ...db, medicines: db.medicines.filter((m) => m.id !== id), reminders: db.reminders.filter((r) => !(r.attach.kind === "medicine" && r.attach.id === id)) };
}

/** Taken or skipped for one dose. Logging never deletes the series. One mark per dose per day. */
export function logDose(db: DB, id: string, date: string, time: string, status: MedicineLog["status"]): DB {
  return {
    ...db,
    medicines: db.medicines.map((m) => {
      if (m.id !== id) return m;
      const log = m.log.filter((l) => !(l.at === date && l.time === time));
      return { ...m, log: [...log, { at: date, time, status }].slice(-400), updatedAt: new Date().toISOString() };
    }),
  };
}

export function doseStatus(m: Medicine, date: string, time: string): MedicineLog["status"] | undefined {
  return m.log.find((l) => l.at === date && l.time === time)?.status;
}

/** Next 7 days of doses for the OS. Key: `med:<id>:<date>:<HHMM>`. */
export function medicineNotices(db: DB, now = new Date(), days = 7): Reminder[] {
  const out: Reminder[] = [];
  const today = toISODate(now);
  for (const m of db.medicines) {
    if (!m.active) continue;
    for (let i = 0; i < days; i++) {
      const date = addDays(today, i);
      const [y, mo, d] = date.split("-").map(Number);
      for (const t of m.times) {
        const at = new Date(y, mo - 1, d, t.hour, t.minute, 0, 0);
        if (at.getTime() <= now.getTime()) continue;
        if (doseStatus(m, date, medTime(t))) continue;
        out.push({ key: `med:${m.id}:${date}:${pad(t.hour)}${pad(t.minute)}`, title: m.name, body: m.dose ? `Take ${m.dose}` : "Time for your medicine", at, once: false });
      }
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 60);
}

export function normalizeMedicines(raw: unknown): Medicine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && typeof m === "object" && typeof m.id === "string" && typeof m.name === "string" && Array.isArray(m.times))
    .map((m) => ({
      ...m,
      times: m.times.filter((t: any) => t && Number.isInteger(t.hour) && Number.isInteger(t.minute) && t.hour >= 0 && t.hour < 24 && t.minute >= 0 && t.minute < 60),
      active: m.active !== false,
      log: Array.isArray(m.log) ? m.log.filter((l: any) => l && typeof l.at === "string" && typeof l.time === "string" && (l.status === "taken" || l.status === "skipped")) : [],
      createdAt: typeof m.createdAt === "string" ? m.createdAt : new Date().toISOString(),
    }))
    .slice(0, 100);
}
