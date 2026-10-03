import type { AdhdKind, AdhdSettings, AdhdTask, DB, HeadsUpState, HomePresetId } from "./types";
import { uid } from "./format";
import { repeatingBills } from "./moneyDesk";

export type PresetItem = { id: string; size: "large" | "small" };
export type HomeRow = { items: PresetItem[] };

export type AdhdStep = {
  id: string;
  kind: AdhdKind;
  recordId: string;
  field: string;
  seed: string;
  draft: string;
  line: string;
  route: string;
};

export type AdhdClock = {
  spentMs: number;
  lastMs: number;
  bufferMs: number;
  countsDown: false;
  remainingMs: null;
  deadline: null;
  label: string;
};

export type AdhdDay = {
  label: "break" | "finished";
  missed: false;
  delta: 0;
  quota: null;
  tone: "plain";
  marks: string[];
};

export const ADHD_VOICE = false;
export const ADHD_BUFFER_MS = 5 * 60 * 1000;

const MONEY: PresetItem[] = [
  { id: "balance", size: "large" },
  { id: "spending", size: "small" },
  { id: "charts", size: "small" },
  { id: "receipts", size: "small" },
  { id: "bills", size: "small" },
  { id: "budget", size: "small" },
  { id: "subscriptions", size: "small" },
  { id: "funds", size: "small" },
  { id: "debts", size: "small" },
  { id: "categories", size: "small" },
  { id: "networth", size: "small" },
];

const TRAVEL: PresetItem[] = [
  { id: "route", size: "large" },
  { id: "mileage", size: "small" },
  { id: "fuel", size: "small" },
  { id: "papers", size: "small" },
  { id: "vehicle", size: "small" },
  { id: "service", size: "small" },
  { id: "range", size: "small" },
  { id: "stops", size: "small" },
  { id: "weather", size: "small" },
  { id: "packing", size: "small" },
];

const HOME: PresetItem[] = [
  { id: "maintenance", size: "large" },
  { id: "chores", size: "small" },
  { id: "appliances", size: "small" },
  { id: "notes", size: "small" },
  { id: "cycle", size: "small" },
  { id: "warranties", size: "small" },
  { id: "utilities", size: "small" },
];

const DESK: PresetItem[] = [
  { id: "kanban", size: "large" },
  { id: "wiki", size: "small" },
  { id: "notes", size: "small" },
  { id: "media", size: "small" },
  { id: "rules", size: "small" },
  { id: "attention", size: "small" },
];

const WORKSHOP: PresetItem[] = [
  { id: "tools", size: "large" },
  { id: "builder", size: "small" },
  { id: "dev", size: "small" },
  { id: "lab", size: "small" },
  { id: "net", size: "small" },
  { id: "history", size: "small" },
];

export const PRESET_CHOICES: { id: HomePresetId; name: string; icon: string }[] = [
  { id: "custom", name: "Custom", icon: "view-dashboard-outline" },
  { id: "money", name: "Money", icon: "wallet-outline" },
  { id: "travel", name: "Travel", icon: "car-side" },
  { id: "home", name: "Home", icon: "home-outline" },
  { id: "desk", name: "Desk", icon: "book-open-variant" },
  { id: "workshop", name: "Workshop", icon: "hammer-wrench" },
  { id: "adhd", name: "ADHD mode", icon: "circle-outline" },
];

const PRESET_IDS: HomePresetId[] = ["custom", "money", "travel", "home", "desk", "workshop", "adhd"];

export function parseHomePreset(raw: unknown): HomePresetId {
  return PRESET_IDS.includes(raw as HomePresetId) ? (raw as HomePresetId) : "custom";
}

export function emptyAdhd(): AdhdSettings {
  return {
    tasks: [],
    finished: [],
    reminder: { line: "" },
    motionOn: false,
    buddyOn: false,
    kindMs: { money: 0, trip: 0, log: 0 },
  };
}

export function emptyHeadsUp(): HeadsUpState {
  return { dismissed: [], answers: [] };
}

function cleanLine(line: string): string {
  return line.replace(/\s+/g, " ").trim().slice(0, 80);
}

export function firstWord(text: string): string {
  const word = text.trim().split(/\s+/)[0] ?? "";
  return word.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
}

export function presetItems(preset: HomePresetId): PresetItem[] {
  switch (preset) {
    case "custom":
      return [];
    case "money":
      return MONEY;
    case "travel":
      return TRAVEL;
    case "home":
      return HOME;
    case "desk":
      return DESK;
    case "workshop":
      return WORKSHOP;
    case "adhd":
      return [{ id: "next", size: "large" }];
    default: {
      const never: never = preset;
      return never;
    }
  }
}

export function rowsFor(items: PresetItem[]): HomeRow[] {
  const rows: HomeRow[] = [];
  let pending: PresetItem | null = null;
  for (const item of items) {
    if (item.size === "large") {
      if (pending) {
        rows.push({ items: [pending] });
        pending = null;
      }
      rows.push({ items: [item] });
      continue;
    }
    if (pending) {
      rows.push({ items: [pending, item] });
      pending = null;
    } else pending = item;
  }
  if (pending) rows.push({ items: [pending] });
  return rows;
}

export function columnsFor(preset: HomePresetId, count: number): number {
  if (preset === "adhd" || count < 2) return 1;
  return 2;
}

function fillsFor(db: DB, vehicleId: string) {
  return db.fuel.filter((row) => row.vehicleId === vehicleId).sort((a, b) => a.odometer - b.odometer);
}

function mileageKnown(db: DB): boolean {
  return db.vehicles.some((vehicle) => fillsFor(db, vehicle.id).length >= 2);
}

export function presetItemHasData(db: DB, id: string): boolean {
  switch (id) {
    case "balance":
    case "charts":
      return db.txns.length > 0;
    case "spending":
      return db.txns.some((row) => row.type === "expense" && !row.transfer);
    case "receipts":
      return db.txns.some((row) => !!row.photo);
    case "bills":
      return repeatingBills(db.txns).length > 0;
    case "budget":
      return db.budget.monthly > 0 || Object.keys(db.budget.categories).length > 0;
    case "subscriptions":
      return db.subscriptions.length > 0;
    case "funds":
      return db.funds.length > 0;
    case "debts":
      return db.debts.length > 0;
    case "categories":
      return db.settings.moneyNames.length > 0 || db.txns.length > 0;
    case "networth":
      return db.netWorth.length > 0;
    case "route":
      return db.trips.length > 0;
    case "mileage":
    case "range":
      return mileageKnown(db);
    case "fuel":
      return db.fuel.length > 0;
    case "papers":
      return db.papers.length > 0;
    case "vehicle":
      return db.vehicles.length > 0;
    case "service":
      return db.services.length > 0;
    case "stops":
      return db.trips.some((trip) => trip.itinerary.some((stop) => stop.stop === "fuel" || stop.stop === "snack"));
    case "weather":
      return db.trips.some((trip) => !!trip.place || trip.weatherSaved === true);
    case "packing":
      return db.trips.some((trip) => trip.packing.length > 0);
    case "maintenance":
      return db.appliances.some((appliance) => appliance.plans.length > 0);
    case "chores":
      return db.chores.length > 0;
    case "appliances":
      return db.appliances.length > 0;
    case "notes":
      return db.notes.length > 0;
    case "cycle":
      return db.cycle.days.length > 0;
    case "warranties":
      return db.appliances.some((appliance) => !!appliance.warrantyUntil) || db.papers.some((paper) => paper.kind === "warranty");
    case "utilities":
      return db.utilities.length > 0;
    case "kanban":
      return db.kanban.length > 0;
    case "wiki":
      return db.wiki.length > 0;
    case "media":
      return db.media.length > 0;
    case "rules":
      return db.rules.length > 0;
    case "attention":
      return Object.keys(db.attention).length > 0;
    case "tools":
    case "history":
      return db.toolHistory.length > 0;
    case "builder":
      return db.customTools.length > 0;
    case "dev":
      return false;
    case "lab":
      return false;
    case "net":
      return db.netlog.length > 0;
    case "next":
      return db.settings.adhd.tasks.some((task) => !task.parked);
    default:
      return false;
  }
}

export function visiblePresetItems(db: DB, preset: HomePresetId): PresetItem[] {
  return presetItems(preset).filter((item) => presetItemHasData(db, item.id));
}

export function homeBlocks(preset: HomePresetId, db: DB): { id: string }[] {
  if (preset === "adhd") {
    const next = db.settings.adhd.tasks.find((task) => !task.parked);
    return next ? [{ id: next.id }] : [];
  }
  if (preset === "custom") return [];
  return visiblePresetItems(db, preset).map((item) => ({ id: item.id }));
}

export function applyPreset(db: DB, preset: HomePresetId): DB {
  if (db.settings.homePreset === preset) return db;
  return { ...db, settings: { ...db.settings, homePreset: preset } };
}

export function rememberPreset(db: DB, preset: HomePresetId, thing: string): DB {
  const id = thing.trim().slice(0, 80);
  if (!id) return db;
  return { ...db, settings: { ...db.settings, presetLast: { ...db.settings.presetLast, [preset]: id } } };
}

export function lastPresetThing(db: DB, preset: HomePresetId): string {
  return db.settings.presetLast[preset] ?? "";
}

export function presetThingLabel(db: DB, id: string): string {
  if (!id) return "";
  const txn = db.txns.find((row) => row.id === id);
  if (txn) return txn.note || txn.item || txn.category;
  const trip = db.trips.find((row) => row.id === id);
  if (trip) return trip.name;
  const note = db.notes.find((row) => row.id === id);
  if (note) return note.title || "Note";
  const vehicle = db.vehicles.find((row) => row.id === id);
  if (vehicle) return vehicle.name;
  return "";
}

export function tileHasData(db: DB, id: string): boolean {
  switch (id) {
    case "attention":
      return Object.keys(db.attention).length > 0;
    case "weather":
      return !!db.settings.homeCity;
    case "trip":
      return db.trips.length > 0;
    case "budget":
      return presetItemHasData(db, "spending") || presetItemHasData(db, "budget");
    case "vehicle":
      return db.vehicles.length > 0;
    case "home":
      return db.appliances.length > 0 || db.chores.length > 0;
    case "subscriptions":
      return db.subscriptions.length > 0;
    case "notes":
      return db.notes.length > 0;
    case "tools":
      return db.toolHistory.length > 0;
    default:
      return false;
  }
}

export function swipeScreens(preset: HomePresetId): HomePresetId[] {
  if (preset === "money" || preset === "travel") return ["money", "travel"];
  return [preset];
}

const LARGE_TILES = new Set(["attention", "trip", "budget", "vehicle"]);

export function customItems(ids: string[]): PresetItem[] {
  return ids.map((id) => ({ id, size: LARGE_TILES.has(id) ? "large" : "small" }));
}

function withAdhd(db: DB, adhd: AdhdSettings): DB {
  return { ...db, settings: { ...db.settings, adhd } };
}

export function startAdhdTask(db: DB, line: string): DB {
  const clean = cleanLine(line);
  if (!clean) return db;
  const task: AdhdTask = {
    id: uid(),
    line: clean,
    started: true,
    parked: false,
    kind: "log",
    recordId: "",
    field: "",
    seed: "",
    draft: "",
    timerStartedAt: Date.now(),
  };
  const tasks = [...db.settings.adhd.tasks, task];
  const reminderLine = tasks.find((row) => !row.parked)?.line ?? clean;
  return withAdhd(db, { ...db.settings.adhd, tasks, reminder: { ...db.settings.adhd.reminder, line: reminderLine } });
}

function knownShop(db: DB): string {
  const withItem = [...db.txns].reverse().find((row) => row.item);
  if (withItem?.item) return firstWord(withItem.item);
  const withNote = [...db.txns].reverse().find((row) => row.note);
  return withNote?.note ? firstWord(withNote.note) : "";
}

function discover(db: DB): Pick<AdhdTask, "line" | "kind" | "recordId" | "field" | "seed"> | null {
  const gap = db.txns.find((row) => !row.note && !row.transfer);
  if (gap) {
    return { line: gap.item || gap.category || "Money", kind: "money", recordId: gap.id, field: "note", seed: knownShop(db) };
  }
  const trip = db.trips.find((row) => !row.place);
  if (trip) {
    return { line: trip.name || "Trip", kind: "trip", recordId: trip.id, field: "place", seed: firstWord(trip.destination) };
  }
  const note = db.notes.find((row) => !row.body.trim());
  if (note) {
    return { line: note.title || "Note", kind: "log", recordId: note.id, field: "body", seed: firstWord(note.title) };
  }
  return null;
}

function routeFor(task: Pick<AdhdTask, "kind" | "recordId" | "field" | "seed">): string {
  const seed = encodeURIComponent(task.seed);
  switch (task.kind) {
    case "money":
      return `/money?focus=${encodeURIComponent(task.recordId)}&field=${task.field}&seed=${seed}`;
    case "trip":
      return `/travel/${encodeURIComponent(task.recordId)}?field=${task.field}&seed=${seed}`;
    case "log":
      return `/notes?id=${encodeURIComponent(task.recordId)}&field=${task.field}&seed=${seed}`;
    default: {
      const never: never = task.kind;
      return never;
    }
  }
}

export function ensureAdhdStep(db: DB): DB {
  if (db.settings.adhd.tasks.some((task) => !task.parked && task.recordId)) return db;
  const found = discover(db);
  if (!found) return db;
  const task: AdhdTask = { ...found, id: uid(), started: true, parked: false, draft: "", timerStartedAt: Date.now() };
  return withAdhd(db, { ...db.settings.adhd, tasks: [...db.settings.adhd.tasks, task] });
}

export function adhdOpen(db: DB): AdhdStep | null {
  const task = db.settings.adhd.tasks.find((row) => !row.parked && row.recordId);
  if (!task) return null;
  return {
    id: task.id,
    kind: task.kind,
    recordId: task.recordId,
    field: task.field,
    seed: task.seed,
    draft: task.draft,
    line: task.line,
    route: routeFor(task),
  };
}

export function typeAdhdDraft(db: DB, draft: string): DB {
  const base = ensureAdhdStep(db);
  const step = adhdOpen(base);
  if (!step) return base;
  const text = draft.replace(/\s+/g, " ").trim().slice(0, 200);
  const tasks = base.settings.adhd.tasks.map((task) => (task.id === step.id ? { ...task, draft: text } : task));
  return withAdhd(base, { ...base.settings.adhd, tasks });
}

export function resumeLines(db: DB, _awayMs: number): string[] {
  const draft = adhdOpen(db)?.draft ?? "";
  return draft ? [draft] : [];
}

export function parkAdhdTask(db: DB, id: string): DB {
  const tasks = db.settings.adhd.tasks.map((task) => (task.id === id ? { ...task, parked: true } : task));
  return withAdhd(db, { ...db.settings.adhd, tasks });
}

export function recallAdhdTask(db: DB, id: string): DB {
  const hit = db.settings.adhd.tasks.find((task) => task.id === id);
  if (!hit) return db;
  const rest = db.settings.adhd.tasks.filter((task) => task.id !== id);
  return withAdhd(db, { ...db.settings.adhd, tasks: [{ ...hit, parked: false }, ...rest] });
}

export function adhdView(db: DB) {
  const open = db.settings.adhd.tasks.filter((task) => !task.parked);
  const next = open[0] ? { id: open[0].id, line: open[0].line } : null;
  const lines = next ? ["Next", next.line] : ["Next"];
  return {
    next,
    rest: Math.max(0, open.length - 1),
    more: "tap" as const,
    type: "plain" as const,
    typeSize: "large" as const,
    motion: db.settings.adhd.motionOn === true,
    lines,
  };
}

export function adhdTimer(input: { startedAt: number; now: number; lastMs: number; bufferMs: number }): AdhdClock {
  const spentMs = Math.max(0, input.now - input.startedAt);
  const spentMin = Math.round(spentMs / 60000);
  const lastMin = Math.round(Math.max(0, input.lastMs) / 60000);
  const bufferMin = Math.round(Math.max(0, input.bufferMs) / 60000);
  return {
    spentMs,
    lastMs: input.lastMs,
    bufferMs: input.bufferMs,
    countsDown: false,
    remainingMs: null,
    deadline: null,
    label: `${spentMin} min · last ${lastMin} min · buffer ${bufferMin} min`,
  };
}

export function adhdReminder(line: string) {
  const clean = cleanLine(line);
  return { line: clean, body: clean, lines: 1 as const, actions: ["Snooze"] as ["Snooze"], sound: false as const };
}

export function snoozeAdhdReminder(db: DB, until: string): DB {
  return withAdhd(db, { ...db.settings.adhd, reminder: { ...db.settings.adhd.reminder, snoozedUntil: until } });
}

export function setAdhdMotion(db: DB, on: boolean): DB {
  return withAdhd(db, { ...db.settings.adhd, motionOn: on });
}

export function setAdhdBuddy(db: DB, on: boolean): DB {
  return withAdhd(db, { ...db.settings.adhd, buddyOn: on });
}

export function adhdBuddy(db: DB): { line: string; voice: false } {
  if (!db.settings.adhd.buddyOn) return { line: "", voice: false };
  if (!db.settings.adhd.tasks.some((task) => !task.parked)) return { line: "", voice: false };
  return { line: "Needs attention", voice: false };
}

export function reviewAdhdDay(_db: DB, finished: string[]): AdhdDay {
  const marks = finished.map((line) => cleanLine(line)).filter(Boolean);
  if (!marks.length) return { label: "break", missed: false, delta: 0, quota: null, tone: "plain", marks: [] };
  return { label: "finished", missed: false, delta: 0, quota: null, tone: "plain", marks };
}

export function noteAdhdDay(db: DB, finished: string[]): DB {
  const marks = finished.map((line) => cleanLine(line)).filter(Boolean);
  if (!marks.length) return db;
  return withAdhd(db, { ...db.settings.adhd, finished: [...db.settings.adhd.finished, ...marks.map((line) => ({ line }))] });
}

export function finishAdhdTask(db: DB, id: string): DB {
  const task = db.settings.adhd.tasks.find((row) => row.id === id);
  if (!task) return db;
  const tasks = db.settings.adhd.tasks.filter((row) => row.id !== id);
  const spent = task.timerStartedAt > 0 ? Math.max(0, Date.now() - task.timerStartedAt) : db.settings.adhd.kindMs[task.kind];
  const kindMs = { ...db.settings.adhd.kindMs, [task.kind]: spent };
  const next = noteAdhdDay(db, [task.line]);
  const reminderLine = tasks.find((row) => !row.parked)?.line ?? "";
  return withAdhd(next, { ...next.settings.adhd, tasks, kindMs, reminder: reminderLine ? { line: reminderLine } : { line: "" } });
}

export function moduleAlerts<T>(db: DB, items: T[]): T[] {
  if (db.settings.homePreset === "adhd") return [];
  return items;
}

export function dismissQuiet(db: DB, key: string): DB {
  return { ...db, attention: { ...db.attention, [key]: { status: "dismissed" } } };
}

function parseTask(raw: unknown): AdhdTask | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<AdhdTask>;
  const line = typeof row.line === "string" ? cleanLine(row.line) : "";
  if (!line || typeof row.id !== "string") return null;
  const kind: AdhdKind = row.kind === "money" || row.kind === "trip" || row.kind === "log" ? row.kind : "log";
  return {
    id: row.id.slice(0, 40),
    line,
    started: row.started === true,
    parked: row.parked === true,
    kind,
    recordId: typeof row.recordId === "string" ? row.recordId.slice(0, 40) : "",
    field: typeof row.field === "string" ? row.field.slice(0, 20) : "",
    seed: typeof row.seed === "string" ? cleanLine(row.seed) : "",
    draft: typeof row.draft === "string" ? row.draft.replace(/\s+/g, " ").trim().slice(0, 200) : "",
    timerStartedAt: typeof row.timerStartedAt === "number" && Number.isFinite(row.timerStartedAt) ? row.timerStartedAt : 0,
  };
}

export function parseAdhd(raw: unknown): AdhdSettings {
  const base = emptyAdhd();
  if (!raw || typeof raw !== "object") return base;
  const bag = raw as Record<string, unknown>;
  const tasks = Array.isArray(bag.tasks) ? bag.tasks.map(parseTask).filter((task): task is AdhdTask => !!task).slice(0, 40) : [];
  const finished = Array.isArray(bag.finished)
    ? bag.finished
        .map((row) => (row && typeof row === "object" && typeof (row as { line?: unknown }).line === "string" ? cleanLine((row as { line: string }).line) : ""))
        .filter(Boolean)
        .slice(0, 200)
        .map((line) => ({ line }))
    : [];
  const reminderBag = bag.reminder && typeof bag.reminder === "object" ? (bag.reminder as Record<string, unknown>) : {};
  const line = typeof reminderBag.line === "string" ? cleanLine(reminderBag.line) : "";
  const snoozedUntil = typeof reminderBag.snoozedUntil === "string" && /^\d{4}-\d{2}-\d{2}$/.test(reminderBag.snoozedUntil) ? reminderBag.snoozedUntil : undefined;
  const kindBag = bag.kindMs && typeof bag.kindMs === "object" ? (bag.kindMs as Record<string, unknown>) : {};
  const kindOf = (key: AdhdKind) => (typeof kindBag[key] === "number" && Number.isFinite(kindBag[key] as number) ? Math.max(0, kindBag[key] as number) : 0);
  return {
    tasks,
    finished,
    reminder: snoozedUntil ? { line, snoozedUntil } : { line },
    motionOn: bag.motionOn === true,
    buddyOn: bag.buddyOn === true,
    kindMs: { money: kindOf("money"), trip: kindOf("trip"), log: kindOf("log") },
  };
}

export function parseHeadsUp(raw: unknown): HeadsUpState {
  if (!raw || typeof raw !== "object") return emptyHeadsUp();
  const bag = raw as Record<string, unknown>;
  const dismissed = Array.isArray(bag.dismissed) ? bag.dismissed.filter((id) => typeof id === "string").map((id) => id.slice(0, 80)).slice(0, 80) : [];
  const answers = Array.isArray(bag.answers)
    ? bag.answers
        .filter((row) => row && typeof row === "object" && typeof (row as { id?: unknown }).id === "string" && ((row as { choice?: unknown }).choice === "Yes" || (row as { choice?: unknown }).choice === "No"))
        .slice(0, 80)
        .map((row) => ({ id: String((row as { id: string }).id).slice(0, 80), choice: (row as { choice: "Yes" | "No" }).choice }))
    : [];
  return { dismissed, answers };
}

export function parsePresetLast(raw: unknown): Partial<Record<HomePresetId, string>> {
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<Record<HomePresetId, string>> = {};
  for (const id of PRESET_IDS) {
    const value = (raw as Record<string, unknown>)[id];
    if (typeof value === "string" && value.trim()) out[id] = value.trim().slice(0, 80);
  }
  return out;
}
