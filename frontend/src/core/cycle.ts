/**
 * Private cycle calendar. Logged days are plain records.
 * The guess below can be replaced later without rewriting those days.
 */
import type { CycleBleeding, CycleDay, CycleFlow, CycleProduct, CycleState, CycleSymptom } from "./types";
import { addDays, daysBetween, fmtDate, parseISO } from "./format";

export const BUDDY_EMOJIS = ["🥭", "🌙", "⭐", "🐻", "🐱", "🌸", "🍋", "🫐", "🐢", "🌻", "🫧", "🍵"] as const;

export const SYMPTOMS: { id: CycleSymptom; label: string }[] = [
  { id: "cramps", label: "Cramps" },
  { id: "low-energy", label: "Low energy" },
  { id: "headache", label: "Headache" },
  { id: "bloating", label: "Bloating" },
  { id: "backache", label: "Backache" },
  { id: "tender", label: "Tender" },
];

export const PRODUCTS: { id: CycleProduct; label: string }[] = [
  { id: "pad", label: "Pads" },
  { id: "tampon", label: "Tampons" },
  { id: "cup", label: "Cups" },
];

export const PHASES: { id: "menstrual" | "follicular" | "ovulation" | "luteal"; title: string; line: string }[] = [
  { id: "menstrual", title: "Bleeding", line: "Some people notice cramps, tiredness, or a heavier flow in the first days of bleeding." },
  { id: "follicular", title: "After bleeding", line: "Some people notice energy picking up after bleeding eases." },
  { id: "ovulation", title: "Middle", line: "Some people notice a change around the middle of a cycle." },
  { id: "luteal", title: "Before the next", line: "Some people notice bloating, tenderness, or lower energy in the days before a period." },
];

export const DOCTOR_NOTE = "Severe pain is a reason to talk to a doctor. This does not suggest a treatment.";

export const HYGIENE_NOTES = [
  "Buy a sealed pack and check the date on it.",
  "Fragrance-free is easier on skin for some people.",
  "Do not flush pads, tampons, or wipes.",
  "Wash your hands before and after changing.",
];

export const ABSORBENCY_NOTE = "You logged a heavier flow. Higher absorbency, or emptying a cup sooner, is a choice you can make. Nothing is changed for you.";

const SAME_PERIOD_DAYS = 10;
const LONG_GAP_DAYS = 90;
const OWN_CYCLE_MIN = 2;
const PLACEHOLDER_LENGTH = 28;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function emptyCycle(): CycleState {
  return {
    days: [],
    buddyName: "",
    buddyEmoji: "",
    periodNudge: false,
    changeNudge: false,
    changeKind: "pad",
    changeHours: 6,
    paused: false,
    stash: [
      { kind: "pad", count: null, lowAt: 2 },
      { kind: "tampon", count: null, lowAt: 2 },
      { kind: "cup", count: null, lowAt: 1 },
    ],
  };
}

export function cleanBuddyName(raw: string): string {
  return raw
    .replace(/[\u0000-\u001F]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24);
}

/** Pad and tampon stay in the 4–8 hour range. A tampon never goes past 8. A cup can run to 12. */
export function clampChangeHours(kind: CycleProduct, hours: number): number {
  const rounded = Math.round(hours);
  if (kind === "cup") return Math.min(12, Math.max(4, rounded));
  return Math.min(8, Math.max(4, rounded));
}

export function timerCopy(kind: CycleProduct): string {
  switch (kind) {
    case "pad":
      return "A pad is often changed about every 4–8 hours.";
    case "tampon":
      return "A tampon should not stay in past 8 hours. About 4–8 hours is the usual range.";
    case "cup":
      return "Rinse a cup on your schedule, often up to 12 hours. Boil it between cycles.";
    default: {
      const unknown: never = kind;
      return unknown;
    }
  }
}

export function productLabel(kind: CycleProduct): string {
  switch (kind) {
    case "pad":
      return "Pads";
    case "tampon":
      return "Tampons";
    case "cup":
      return "Cups";
    default: {
      const unknown: never = kind;
      return unknown;
    }
  }
}

export function lowStashLine(kind: CycleProduct): string {
  switch (kind) {
    case "pad":
      return "Pads are low.";
    case "tampon":
      return "Tampons are low.";
    case "cup":
      return "Cups are low.";
    default: {
      const unknown: never = kind;
      return unknown;
    }
  }
}

export function normalizeCycle(raw: unknown): CycleState {
  const base = emptyCycle();
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const days: CycleDay[] = [];
  const seen = new Set<string>();
  const list = Array.isArray(src.days) ? src.days : [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const date = typeof row.date === "string" ? row.date : "";
    if (!DATE.test(date) || seen.has(date)) continue;
    const bleeding = row.bleeding === "flow" || row.bleeding === "spotting" ? row.bleeding : undefined;
    const symptom = SYMPTOMS.some((s) => s.id === row.symptom) ? (row.symptom as CycleSymptom) : undefined;
    if (!bleeding && !symptom) continue;
    seen.add(date);
    const day: CycleDay = {
      id: typeof row.id === "string" && row.id.trim() ? row.id.trim().slice(0, 40) : `day-${date}`,
      date,
    };
    if (bleeding) day.bleeding = bleeding;
    if (bleeding === "flow" && row.ended === true) day.ended = true;
    if (bleeding === "flow" && (row.flow === "light" || row.flow === "medium" || row.flow === "heavy")) day.flow = row.flow;
    if (symptom) day.symptom = symptom;
    days.push(day);
  }
  days.sort((a, b) => a.date.localeCompare(b.date));

  const changeKind: CycleProduct = src.changeKind === "tampon" || src.changeKind === "cup" ? src.changeKind : "pad";
  const stash = base.stash.map((item) => {
    const found = Array.isArray(src.stash)
      ? src.stash.find((entry) => entry && typeof entry === "object" && (entry as { kind?: string }).kind === item.kind)
      : undefined;
    if (!found || typeof found !== "object") return item;
    const row = found as { count?: unknown; lowAt?: unknown };
    const count = typeof row.count === "number" && Number.isFinite(row.count) ? Math.max(0, Math.min(999, Math.round(row.count))) : null;
    const lowAt = typeof row.lowAt === "number" && Number.isFinite(row.lowAt) ? Math.max(0, Math.min(99, Math.round(row.lowAt))) : item.lowAt;
    return { kind: item.kind, count, lowAt };
  });
  const emoji = typeof src.buddyEmoji === "string" && (BUDDY_EMOJIS as readonly string[]).includes(src.buddyEmoji) ? src.buddyEmoji : "";
  const changeEndsAt = typeof src.changeEndsAt === "string" && !Number.isNaN(Date.parse(src.changeEndsAt)) ? src.changeEndsAt : undefined;
  const packedFor = typeof src.packedFor === "string" && DATE.test(src.packedFor) ? src.packedFor : undefined;
  const absorbencySeenFor = typeof src.absorbencySeenFor === "string" && DATE.test(src.absorbencySeenFor) ? src.absorbencySeenFor : undefined;

  return {
    days,
    buddyName: cleanBuddyName(typeof src.buddyName === "string" ? src.buddyName : ""),
    buddyEmoji: emoji,
    periodNudge: src.periodNudge === true,
    changeNudge: src.changeNudge === true,
    changeKind,
    changeHours: clampChangeHours(changeKind, typeof src.changeHours === "number" ? src.changeHours : 6),
    ...(changeEndsAt ? { changeEndsAt } : {}),
    paused: src.paused === true,
    ...(packedFor ? { packedFor } : {}),
    ...(absorbencySeenFor ? { absorbencySeenFor } : {}),
    stash,
  };
}

function writeDay(days: CycleDay[], date: string, build: (prev: CycleDay | undefined) => CycleDay | null): CycleDay[] {
  const prev = days.find((d) => d.date === date);
  const next = build(prev);
  const rest = days.filter((d) => d.date !== date);
  if (!next) return rest.sort((a, b) => a.date.localeCompare(b.date));
  return [...rest, next].sort((a, b) => a.date.localeCompare(b.date));
}

function carry(prev: CycleDay | undefined, date: string): CycleDay {
  return { id: prev?.id ?? `day-${date}`, date };
}

/** One tap: bleeding started today. Does not fill any other day. */
export function markStart(days: CycleDay[], date: string): CycleDay[] {
  return writeDay(days, date, (prev) => {
    const day = carry(prev, date);
    day.bleeding = "flow";
    if (prev?.flow) day.flow = prev.flow;
    if (prev?.symptom) day.symptom = prev.symptom;
    return day;
  });
}

/** One tap: bleeding ended today, when a period is already open. Does not backfill the days between. */
export function markEnd(days: CycleDay[], date: string): CycleDay[] {
  const anchor = periodStarts(days).at(-1);
  if (!anchor) return days;
  const gap = daysBetween(anchor, date);
  if (gap < 0 || gap >= SAME_PERIOD_DAYS) return days;
  return writeDay(days, date, (prev) => {
    const day = carry(prev, date);
    day.bleeding = "flow";
    day.ended = true;
    if (prev?.flow) day.flow = prev.flow;
    if (prev?.symptom) day.symptom = prev.symptom;
    return day;
  });
}

export function clearDay(days: CycleDay[], date: string): CycleDay[] {
  return days.filter((d) => d.date !== date);
}

export function setBleeding(days: CycleDay[], date: string, bleeding: CycleBleeding | "none"): CycleDay[] {
  if (bleeding === "none") {
    return writeDay(days, date, (prev) => {
      if (!prev?.symptom) return null;
      return { id: prev.id, date, symptom: prev.symptom };
    });
  }
  return writeDay(days, date, (prev) => {
    const day = carry(prev, date);
    day.bleeding = bleeding;
    if (bleeding === "flow") {
      if (prev?.ended) day.ended = true;
      if (prev?.flow) day.flow = prev.flow;
    }
    if (prev?.symptom) day.symptom = prev.symptom;
    return day;
  });
}

export function setFlowLevel(days: CycleDay[], date: string, flow: CycleFlow | null): CycleDay[] {
  const prev = days.find((d) => d.date === date);
  if (!prev || prev.bleeding !== "flow") return days;
  return writeDay(days, date, () => {
    const day = carry(prev, date);
    day.bleeding = "flow";
    if (prev.ended) day.ended = true;
    if (flow) day.flow = flow;
    if (prev.symptom) day.symptom = prev.symptom;
    return day;
  });
}

export function setSymptom(days: CycleDay[], date: string, symptom: CycleSymptom | null): CycleDay[] {
  return writeDay(days, date, (prev) => {
    const day = carry(prev, date);
    if (prev?.bleeding) day.bleeding = prev.bleeding;
    if (prev?.bleeding === "flow" && prev.ended) day.ended = true;
    if (prev?.bleeding === "flow" && prev.flow) day.flow = prev.flow;
    if (symptom) day.symptom = symptom;
    if (!day.bleeding && !day.symptom) return null;
    return day;
  });
}

/** Flow days only. A new period starts when the previous flow day is at least 10 days earlier. Spotting never starts one. */
export function periodStarts(days: CycleDay[]): string[] {
  const flow = days.filter((d) => d.bleeding === "flow").map((d) => d.date).sort();
  const starts: string[] = [];
  let prev: string | null = null;
  for (const date of flow) {
    if (prev === null || daysBetween(prev, date) >= SAME_PERIOD_DAYS) starts.push(date);
    prev = date;
  }
  return starts;
}

/** Gaps between period starts. A gap longer than 90 days is left out so one long break does not move the middle. */
export function cycleLengths(days: CycleDay[]): number[] {
  const starts = periodStarts(days);
  const lengths: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const gap = daysBetween(starts[i - 1], starts[i]);
    if (gap > LONG_GAP_DAYS) continue;
    lengths.push(gap);
  }
  return lengths;
}

export function typicalCompare(days: CycleDay[], today: string): { typical: number; thisOne: number; line: string } | null {
  const lengths = cycleLengths(days);
  if (lengths.length < 2) return null;
  const typical = median(lengths);
  const start = periodStarts(days).at(-1);
  if (!start) return null;
  const thisOne = Math.max(0, daysBetween(start, today));
  return { typical, thisOne, line: `Your typical length is ${typical} days. This one is ${thisOne} days so far.` };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function windowHalf(own: boolean, lengths: number[]): number {
  if (!own) return 2;
  const recent = lengths.slice(-6);
  const spread = Math.max(...recent) - Math.min(...recent);
  return Math.min(7, Math.max(1, Math.round(spread / 2)));
}

export function formatWindow(from: string, to: string): string {
  const a = parseISO(from);
  const b = parseISO(to);
  const left = `${a.getDate()} ${MONTHS[a.getMonth()]}`;
  const right = `${b.getDate()} ${MONTHS[b.getMonth()]}`;
  if (a.getFullYear() !== b.getFullYear()) return `Guess · ${left} ${a.getFullYear()} – ${right} ${b.getFullYear()}`;
  return `Guess · ${left} – ${right}`;
}

export type CycleForecast = {
  from: string;
  to: string;
  center: string;
  length: number;
  ovulation: string;
  source: "placeholder" | "own";
  paused: boolean;
  longGap: boolean;
  wide: boolean;
  line: string;
};

export function forecast(cycle: CycleState, today: string): CycleForecast | null {
  const anchor = periodStarts(cycle.days).at(-1);
  if (!anchor) return null;
  const lengths = cycleLengths(cycle.days);
  const own = lengths.length >= OWN_CYCLE_MIN;
  const length = own ? median(lengths) : PLACEHOLDER_LENGTH;
  const half = windowHalf(own, lengths);
  const center = addDays(anchor, length);
  const from = addDays(center, -half);
  const to = addDays(center, half);
  const longGap = daysBetween(anchor, today) > LONG_GAP_DAYS;
  const paused = cycle.paused || longGap;
  const wide = own && half > 1;
  return {
    from,
    to,
    center,
    length,
    ovulation: addDays(center, -14),
    source: own ? "own" : "placeholder",
    paused,
    longGap,
    wide,
    line: paused ? "Paused" : formatWindow(from, to),
  };
}

export function forecastDetail(next: CycleForecast): string {
  if (next.longGap) return "A gap longer than 90 days is left out of the guess.";
  if (next.paused) return "Guesses are paused. Logged days stay as they are.";
  if (next.source === "placeholder") return "A 28-day placeholder until two of your own cycles are logged. Still a guess.";
  if (next.wide) return "Recent cycles differ, so this window is wider. Still a guess.";
  return "From the middle of your own cycle lengths. Still a guess.";
}

export function ovulationLine(next: CycleForecast): string {
  return `Ovulation guess · ${fmtDate(next.ovulation)}. About 14 days before the period guess.`;
}

export function guessPhase(cycle: CycleState, today: string): (typeof PHASES)[number]["id"] | null {
  const next = forecast(cycle, today);
  if (!next || next.paused) return null;
  const anchor = periodStarts(cycle.days).at(-1);
  if (!anchor) return null;
  const inPeriod = cycle.days.filter((d) => d.bleeding === "flow" && d.date >= anchor && daysBetween(anchor, d.date) < SAME_PERIOD_DAYS).map((d) => d.date);
  const end = inPeriod.sort().at(-1) ?? anchor;
  if (today >= anchor && today <= end) return "menstrual";
  if (Math.abs(daysBetween(today, next.ovulation)) <= 1) return "ovulation";
  if (today < next.ovulation) return "follicular";
  return "luteal";
}

export function loggedHeavyFlow(days: CycleDay[]): boolean {
  const anchor = periodStarts(days).at(-1);
  if (!anchor) return false;
  return days.some((d) => d.bleeding === "flow" && d.flow === "heavy" && d.date >= anchor && daysBetween(anchor, d.date) < SAME_PERIOD_DAYS);
}

export function showAbsorbency(cycle: CycleState): boolean {
  if (!loggedHeavyFlow(cycle.days)) return false;
  const anchor = periodStarts(cycle.days).at(-1);
  return !!anchor && cycle.absorbencySeenFor !== anchor;
}

export function dismissAbsorbency(cycle: CycleState): CycleState {
  const anchor = periodStarts(cycle.days).at(-1);
  if (!anchor) return cycle;
  return { ...cycle, absorbencySeenFor: anchor };
}

/** The day before the guess window, and only that day. */
export function packingTarget(cycle: CycleState, today: string): string | null {
  const next = forecast(cycle, today);
  if (!next || next.paused) return null;
  const day = addDays(next.from, -1);
  return day === today ? next.from : null;
}

export function togglePacked(cycle: CycleState, windowFrom: string): CycleState {
  if (cycle.packedFor === windowFrom) {
    const next = { ...cycle };
    delete next.packedFor;
    return next;
  }
  return { ...cycle, packedFor: windowFrom };
}

export function setBuddy(cycle: CycleState, name: string, emoji: string): CycleState {
  const buddyEmoji = emoji === "" || (BUDDY_EMOJIS as readonly string[]).includes(emoji) ? emoji : cycle.buddyEmoji;
  return { ...cycle, buddyName: cleanBuddyName(name), buddyEmoji };
}

export function setChangeKind(cycle: CycleState, kind: CycleProduct): CycleState {
  return { ...cycle, changeKind: kind, changeHours: clampChangeHours(kind, cycle.changeHours) };
}

export function setChangeHours(cycle: CycleState, hours: number): CycleState {
  return { ...cycle, changeHours: clampChangeHours(cycle.changeKind, hours) };
}

export function startChangeTimer(cycle: CycleState, now: Date): CycleState {
  const changeHours = clampChangeHours(cycle.changeKind, cycle.changeHours);
  return { ...cycle, changeHours, changeEndsAt: new Date(now.getTime() + changeHours * 60 * 60 * 1000).toISOString() };
}

export function stopChangeTimer(cycle: CycleState): CycleState {
  const next = { ...cycle };
  delete next.changeEndsAt;
  return next;
}

export function setStashCount(cycle: CycleState, kind: CycleProduct, count: number): CycleState {
  const next = Math.max(0, Math.min(999, Math.round(count)));
  return { ...cycle, stash: cycle.stash.map((item) => (item.kind === kind ? { ...item, count: next } : item)) };
}

export function setStashLow(cycle: CycleState, kind: CycleProduct, lowAt: number): CycleState {
  const next = Math.max(0, Math.min(99, Math.round(lowAt)));
  return { ...cycle, stash: cycle.stash.map((item) => (item.kind === kind ? { ...item, lowAt: next } : item)) };
}

export function lowStash(cycle: CycleState): CycleStashKind[] {
  return cycle.stash.flatMap((item) => (item.count !== null && item.count <= item.lowAt ? [{ kind: item.kind, count: item.count }] : []));
}

type CycleStashKind = { kind: CycleProduct; count: number };

export function buddyTitle(name: string): string {
  const clean = cleanBuddyName(name);
  if (!clean) return "";
  return `${clean} needs attention`;
}

/** The only text a share is allowed to send. */
export function buddyShareLine(name: string): string {
  return buddyTitle(name);
}

export type CycleNotice = { id: "cycle:period" | "cycle:change"; title: string; body: ""; at: string };

function atMorning(iso: string, quiet: { enabled: boolean; from: number; to: number }): Date {
  const [year, month, day] = iso.split("-").map(Number);
  const at = new Date(year, (month || 1) - 1, day || 1, 9, 0, 0, 0);
  if (!quiet.enabled) return at;
  const hour = at.getHours();
  const inQuiet = quiet.from > quiet.to ? hour >= quiet.from || hour < quiet.to : hour >= quiet.from && hour < quiet.to;
  if (!inQuiet) return at;
  const out = new Date(at);
  if (quiet.from > quiet.to && hour >= quiet.from) out.setDate(out.getDate() + 1);
  out.setHours(quiet.to, 0, 0, 0);
  return out;
}

/** Lock-screen text is the buddy line only. The clock time is for the scheduler, not the wording. */
export function cycleNotices(cycle: CycleState, quiet: { enabled: boolean; from: number; to: number }, today: string, now = new Date()): CycleNotice[] {
  const title = buddyTitle(cycle.buddyName);
  if (!title) return [];
  const notices: CycleNotice[] = [];
  const next = forecast(cycle, today);
  if (cycle.periodNudge && next && !next.paused) {
    const at = atMorning(next.from, quiet);
    if (at.getTime() > now.getTime()) notices.push({ id: "cycle:period", title, body: "", at: at.toISOString() });
  }
  if (cycle.changeNudge && cycle.changeEndsAt) {
    const at = new Date(cycle.changeEndsAt);
    if (!Number.isNaN(at.getTime()) && at.getTime() > now.getTime()) notices.push({ id: "cycle:change", title, body: "", at: at.toISOString() });
  }
  return notices;
}

export function searchCycleDays(days: CycleDay[], query: string): CycleDay[] {
  const q = query.trim().toLowerCase();
  const sorted = [...days].sort((a, b) => b.date.localeCompare(a.date));
  if (!q) return sorted;
  return sorted.filter((day) => {
    const symptom = SYMPTOMS.find((s) => s.id === day.symptom)?.label ?? "";
    return [day.date, day.bleeding ?? "", day.flow ?? "", symptom].some((bit) => bit.toLowerCase().includes(q));
  });
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function cycleCsv(days: CycleDay[]): string {
  const rows = [
    ["Date", "Bleeding", "Flow", "Symptom"],
    ...[...days]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((day) => [day.date, day.bleeding ?? "", day.flow ?? "", SYMPTOMS.find((s) => s.id === day.symptom)?.label ?? ""]),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

export function dayInWindow(date: string, next: CycleForecast | null): boolean {
  if (!next || next.paused) return false;
  return date >= next.from && date <= next.to;
}
