import type { DB, PlainReminder, ReminderAttachKind } from "./types";
import type { Reminder } from "./rules";
import { uid } from "./format";

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KINDS: ReminderAttachKind[] = ["plain", "paper", "subscription", "medicine", "vehicle"];

/** Snooze choices: hours for a plain reminder, then the Attention day choices. */
export const REMINDER_SNOOZE: { label: string; ms: number }[] = [
  { label: "1 hour", ms: 3_600_000 },
  { label: "3 hours", ms: 3 * 3_600_000 },
  { label: "1 day", ms: 86_400_000 },
  { label: "3 days", ms: 3 * 86_400_000 },
  { label: "7 days", ms: 7 * 86_400_000 },
];

export function validTime(time: string): boolean {
  return TIME.test(time);
}

export function reminderAt(r: Pick<PlainReminder, "date" | "time" | "snoozeUntil">, now = Date.now()): Date {
  if (r.snoozeUntil) {
    const s = new Date(r.snoozeUntil);
    if (!Number.isNaN(s.getTime()) && s.getTime() > now) return s;
  }
  const [y, m, d] = r.date.split("-").map(Number);
  const [hh, mm] = r.time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

/** Why a reminder cannot be saved, or null when it can. */
export function reminderProblem(input: { title: string; date?: string; time: string }): string | null {
  if (!input.title.trim()) return "Add a title";
  if (!input.date || !DATE.test(input.date)) return "Pick a date";
  if (!validTime(input.time)) return "Enter the time as HH:MM";
  return null;
}

export function newReminder(input: { title: string; note?: string; date: string; time: string; attach?: PlainReminder["attach"] }): PlainReminder {
  const now = new Date().toISOString();
  return {
    id: uid(),
    title: input.title.trim().slice(0, 80),
    note: input.note?.trim() ? input.note.trim().slice(0, 400) : undefined,
    date: input.date,
    time: input.time,
    attach: input.attach ?? { kind: "plain" },
    createdAt: now,
    updatedAt: now,
  };
}

export function upsertReminder(db: DB, r: PlainReminder): DB {
  const exists = db.reminders.some((x) => x.id === r.id);
  const next = { ...r, updatedAt: new Date().toISOString() };
  return { ...db, reminders: exists ? db.reminders.map((x) => (x.id === r.id ? next : x)) : [next, ...db.reminders] };
}

export function removeReminder(db: DB, id: string): DB {
  return { ...db, reminders: db.reminders.filter((x) => x.id !== id) };
}

export function snoozeReminder(db: DB, id: string, ms: number, now = Date.now()): DB {
  const until = new Date(now + ms).toISOString();
  return { ...db, reminders: db.reminders.map((x) => (x.id === id ? { ...x, snoozeUntil: until, done: false, updatedAt: new Date(now).toISOString() } : x)) };
}

export function setReminderDone(db: DB, id: string, done: boolean): DB {
  return { ...db, reminders: db.reminders.map((x) => (x.id === id ? { ...x, done, snoozeUntil: undefined, updatedAt: new Date().toISOString() } : x)) };
}

export function remindersFor(db: DB, kind: ReminderAttachKind, id: string): PlainReminder[] {
  return db.reminders.filter((r) => r.attach.kind === kind && r.attach.id === id);
}

/** Open reminders still in the future, for the OS. Key: `plain:<id>`. */
export function plainReminders(db: DB, now = Date.now()): Reminder[] {
  return db.reminders
    .filter((r) => !r.done)
    .map((r) => ({ r, at: reminderAt(r, now) }))
    .filter(({ at }) => at.getTime() > now)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, 40)
    .map(({ r, at }) => ({ key: `plain:${r.id}`, title: r.title, body: r.note ?? "Reminder", at, once: false }));
}

/** Open reminders whose time has passed: shown as overdue on the Reminders screen. */
export function overdueReminders(db: DB, now = Date.now()): PlainReminder[] {
  return db.reminders.filter((r) => !r.done && reminderAt(r, now).getTime() <= now);
}

export function normalizeReminders(raw: unknown): PlainReminder[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === "object" && typeof r.id === "string" && typeof r.title === "string" && DATE.test(r.date) && TIME.test(r.time))
    .map((r) => ({
      ...r,
      attach: r.attach && KINDS.includes(r.attach.kind) ? { kind: r.attach.kind, id: typeof r.attach.id === "string" ? r.attach.id : undefined } : { kind: "plain" as const },
      done: r.done === true,
      createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
    }))
    .slice(0, 500);
}
