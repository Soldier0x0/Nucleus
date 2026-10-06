import type { AdhdKind, AdhdSettings, AdhdTask, DB, HeadsUpState, HomePresetId, ModuleId, TileId } from "./types";
import { billBoardItems } from "./bills";
import { documentBoardItems } from "./documents";
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
  { id: "weather", size: "large" },
  { id: "packing", size: "small" },
  { id: "heading", size: "small" },
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
  { id: "attention", size: "large" },
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
  { id: "documents", name: "Documents", icon: "file-document-outline" },
  { id: "bills", name: "Bills", icon: "calendar-clock" },
  { id: "desk", name: "Desk", icon: "book-open-variant" },
  { id: "workshop", name: "Workshop", icon: "hammer-wrench" },
  { id: "adhd", name: "ADHD mode", icon: "circle-outline" },
];

const PRESET_IDS: HomePresetId[] = ["custom", "money", "travel", "home", "documents", "bills", "desk", "workshop", "adhd"];

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
    case "documents":
      return [
        { id: "docgaps", size: "small" },
        { id: "docids", size: "small" },
        { id: "docinsurance", size: "small" },
        { id: "doctrips", size: "small" },
        { id: "docfiles", size: "small" },
      ];
    case "bills":
      return [
        { id: "billdue", size: "small" },
        { id: "rent", size: "small" },
        { id: "emi", size: "small" },
        { id: "subs", size: "small" },
        { id: "billpaid", size: "small" },
      ];
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
  void preset;
  void count;
  return 2;
}

export function rowFlex(row: HomeRow): { id: string; span: 1 | 2 }[] {
  if (row.items.length === 1 && row.items[0].size === "large") return [{ id: row.items[0].id, span: 2 }];
  return row.items.map((item) => ({ id: item.id, span: 1 }));
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

const DECOY_HIDDEN_TILES = new Set([
  "cycle",
  "balance",
  "spending",
  "charts",
  "receipts",
  "bills",
  "budget",
  "subscriptions",
  "funds",
  "debts",
  "categories",
  "networth",
  "billdue",
  "rent",
  "emi",
  "subs",
  "billpaid",
]);

const ITEM_MODULE: Record<string, ModuleId> = {
  balance: "money",
  spending: "money",
  charts: "money",
  receipts: "money",
  bills: "money",
  budget: "money",
  subscriptions: "money",
  funds: "money",
  debts: "money",
  categories: "money",
  networth: "money",
  route: "travel",
  packing: "travel",
  heading: "travel",
  stops: "travel",
  weather: "travel",
  mileage: "vehicles",
  fuel: "vehicles",
  vehicle: "vehicles",
  service: "vehicles",
  range: "vehicles",
  papers: "papers",
  docgaps: "papers",
  docids: "papers",
  docinsurance: "papers",
  doctrips: "papers",
  docfiles: "papers",
  billdue: "money",
  rent: "money",
  emi: "money",
  subs: "money",
  billpaid: "money",
  maintenance: "home",
  chores: "home",
  appliances: "home",
  utilities: "home",
  warranties: "home",
  cycle: "cycle",
  notes: "notes",
  kanban: "kanban",
  wiki: "wiki",
  media: "media",
  rules: "rules",
  tools: "tools",
  history: "tools",
  builder: "builder",
  dev: "dev",
  lab: "lab",
  net: "net",
  trip: "travel",
  home: "home",
};

export function tileModule(id: string): ModuleId | null {
  return ITEM_MODULE[id] ?? null;
}

export function withModulesOn(db: DB, items: PresetItem[]): PresetItem[] {
  return items.filter((item) => {
    const moduleId = tileModule(item.id);
    if (!moduleId) return true;
    return db.settings.modules.find((row) => row.id === moduleId)?.enabled !== false;
  });
}

/** Saved order wins. Tiles that are not in that list stay at the end. */
export function applyTileOrder(items: PresetItem[], order: string[] | undefined): PresetItem[] {
  if (!order?.length) return items;
  const byId = new Map(items.map((item) => [item.id, item]));
  const next: PresetItem[] = [];
  for (const id of order) {
    const item = byId.get(id);
    if (!item) continue;
    next.push(item);
    byId.delete(id);
  }
  for (const item of byId.values()) next.push(item);
  return next;
}

/** Every built-in board lists its own tiles. Empty records stay on the board as placeholders. */
export function visiblePresetItems(db: DB, preset: HomePresetId): PresetItem[] {
  let items: PresetItem[];
  switch (preset) {
    case "custom": {
      const board = db.settings.boards.find((row) => row.id === db.settings.activeBoardId);
      const ids = board ? board.tiles : db.settings.tiles.filter((tile) => tile.enabled).map((tile) => tile.id);
      items = customItems(ids);
      break;
    }
    case "desk":
    case "workshop":
      items = applyTileOrder(presetItems(preset), db.settings.tileOrder?.[preset]);
      break;
    case "documents":
      items = documentBoardItems(db);
      break;
    case "bills":
      items = billBoardItems(db);
      break;
    case "money":
    case "travel":
    case "home":
    case "adhd":
      items = presetItems(preset);
      break;
    default: {
      const never: never = preset;
      return never;
    }
  }
  return withModulesOn(db, items);
}

/** The tiles painted for one preset tap. Money does not include Travel, and Travel does not include Money. */
export function homePresetTiles(db: DB, preset: HomePresetId, session: "real" | "decoy"): PresetItem[] {
  return presetBoard(db, preset, session);
}

export function presetTileTitle(id: string): string {
  switch (id) {
    case "balance":
      return "Balance";
    case "spending":
      return "Spending";
    case "charts":
      return "Charts";
    case "receipts":
      return "Receipts";
    case "bills":
      return "Bills";
    case "budget":
      return "Budget";
    case "subscriptions":
      return "Subscriptions";
    case "funds":
      return "Funds";
    case "debts":
      return "Debts";
    case "categories":
      return "Categories";
    case "networth":
      return "Net worth";
    case "route":
      return "Route";
    case "mileage":
      return "Mileage";
    case "fuel":
      return "Fuel";
    case "papers":
      return "Papers";
    case "docgaps":
      return "Missing";
    case "docids":
      return "IDs";
    case "docinsurance":
      return "Insurance";
    case "doctrips":
      return "Trip docs";
    case "docfiles":
      return "Papers";
    case "billdue":
      return "Due";
    case "rent":
      return "Rent";
    case "emi":
      return "EMI";
    case "subs":
      return "Subscriptions";
    case "billpaid":
      return "Paid";
    case "vehicle":
      return "Vehicle";
    case "service":
      return "Service";
    case "range":
      return "Range";
    case "stops":
      return "Stops";
    case "weather":
      return "Weather";
    case "packing":
      return "Packing";
    case "heading":
      return "Heading";
    case "maintenance":
      return "Maintenance";
    case "chores":
      return "Chores";
    case "appliances":
      return "Appliances";
    case "notes":
      return "Notes";
    case "cycle":
      return "Cycle";
    case "warranties":
      return "Warranties";
    case "utilities":
      return "Utilities";
    case "kanban":
      return "Kanban";
    case "wiki":
      return "Wiki";
    case "media":
      return "Media";
    case "rules":
      return "Rules";
    case "attention":
      return "Attention";
    case "trip":
      return "Trip";
    case "home":
      return "Home";
    case "tools":
      return "Tools";
    case "history":
      return "History";
    case "builder":
      return "Builder";
    case "dev":
      return "Dev";
    case "lab":
      return "Lab";
    case "net":
      return "Network";
    case "next":
      return "Next";
    default:
      return id;
  }
}

/** The decoy keeps the same boards, without cycle or money tiles. */
export function presetBoard(db: DB, preset: HomePresetId, session: "real" | "decoy"): PresetItem[] {
  const items = visiblePresetItems(db, preset);
  switch (session) {
    case "real":
      return items;
    case "decoy":
      return items.filter((item) => !DECOY_HIDDEN_TILES.has(item.id));
    default: {
      const never: never = session;
      return never;
    }
  }
}

export function tilePlaceholder(id: string): { title: string; line: string; route: string } {
  const tile = id as TileId;
  switch (tile) {
    case "attention":
      return { title: "Attention", line: "Nothing open", route: "/(tabs)/attention" };
    case "weather":
      return { title: "Weather", line: "Home city", route: "/(tabs)/settings" };
    case "trip":
      return { title: "Trip", line: "No trip yet", route: "/travel" };
    case "budget":
      return { title: "Money", line: "This month", route: "/money" };
    case "vehicle":
      return { title: "Vehicle", line: "No vehicle yet", route: "/vehicles" };
    case "home":
      return { title: "Home", line: "Maintenance", route: "/home" };
    case "subscriptions":
      return { title: "Subscriptions", line: "None yet", route: "/money?tab=subscriptions" };
    case "notes":
      return { title: "Notes", line: "Nothing pinned", route: "/notes" };
    case "tools":
      return { title: "Tools", line: "Units, GST, split", route: "/tools" };
    default: {
      const unknown: never = tile;
      void unknown;
      return { title: id, line: "Open", route: "/" };
    }
  }
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

export const BOARD_CIRCLE: HomePresetId[] = ["custom", "money", "travel", "home", "documents", "bills", "desk", "workshop", "adhd"];

/** A board with no tiles left after disabled modules are hidden. Custom stays if nothing else is open. */
export function openBoards(db: DB): HomePresetId[] {
  const open = BOARD_CIRCLE.filter((id) => visiblePresetItems(db, id).length > 0);
  return open.length > 0 ? open : ["custom"];
}

/** A long single word, or a long title, takes the full row so it is not split mid-word. */
export function labelNeedsFullRow(title: string): boolean {
  const trimmed = title.trim();
  if (trimmed.length >= 16) return true;
  return trimmed.split(/\s+/).some((word) => word.length >= 8);
}

export function widenLongLabels(items: PresetItem[], title: (id: string) => string): PresetItem[] {
  return items.map((item) => (labelNeedsFullRow(title(item.id)) ? { ...item, size: "large" as const } : item));
}

export function swipeScreens(preset: HomePresetId): HomePresetId[] {
  switch (preset) {
    case "custom":
    case "money":
    case "travel":
    case "home":
    case "documents":
    case "bills":
    case "desk":
    case "workshop":
    case "adhd":
      return BOARD_CIRCLE;
    default: {
      const never: never = preset;
      return never;
    }
  }
}

export function swipeStartIndex(preset: HomePresetId): number {
  const index = swipeScreens(preset).indexOf(preset);
  return index < 0 ? 0 : index;
}

export function swipeWrap(index: number, count: number): number {
  if (count <= 0) return 0;
  return ((index % count) + count) % count;
}

export function swipePages(preset: HomePresetId): HomePresetId[] {
  const circle = swipeScreens(preset);
  const first = circle[0];
  if (!first) return circle;
  return [...circle, first];
}

/** Money, Travel, and Home are fixed boards. The dashed customize box stays on the boards the user arranges. */
export function showsCustomizeHome(preset: HomePresetId): boolean {
  switch (preset) {
    case "money":
    case "travel":
    case "home":
    case "documents":
    case "bills":
      return false;
    case "custom":
    case "desk":
    case "workshop":
    case "adhd":
      return true;
    default: {
      const never: never = preset;
      return never;
    }
  }
}

const LARGE_TILES = new Set(["attention", "weather", "trip", "budget", "vehicle"]);

/** The size a tile uses before a long press. Notes and tools stay short. */
export function defaultTileSize(id: string): "large" | "small" {
  return LARGE_TILES.has(id) ? "large" : "small";
}

export function parseTileSizes(raw: unknown): Record<string, "large" | "small"> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, "large" | "small"> = {};
  for (const [key, value] of Object.entries(raw)) {
    if ((value === "large" || value === "small") && /^[a-z0-9-]{1,40}$/.test(key)) out[key] = value;
  }
  return out;
}

/** A saved long-press wins. Everything else keeps the size the board already chose. */
export function withTileSizes(db: DB, items: PresetItem[]): PresetItem[] {
  const saved = db.settings.tileSizes ?? {};
  return items.map((item) => {
    const chosen = saved[item.id];
    if (chosen === "large" || chosen === "small") return { ...item, size: chosen };
    return item;
  });
}

/** Saves one tile as small or wide. Order on the board stays as it was. */
export function resizeHomeTile(db: DB, id: string, size: "large" | "small"): DB {
  switch (size) {
    case "large":
    case "small":
      break;
    default: {
      const unreachable: never = size;
      return unreachable;
    }
  }
  if (!/^[a-z0-9-]{1,40}$/.test(id)) return db;
  if (db.settings.tileSizes?.[id] === size) return db;
  return { ...db, settings: { ...db.settings, tileSizes: { ...(db.settings.tileSizes ?? {}), [id]: size } } };
}

/** Flips one tile. A second argument is the size on screen when nothing is saved yet. */
export function toggleTileSize(db: DB, id: string, shown?: "large" | "small"): DB {
  const saved = db.settings.tileSizes?.[id];
  const current = saved === "large" || saved === "small" ? saved : shown === "large" || shown === "small" ? shown : defaultTileSize(id);
  const next = current === "large" ? "small" : "large";
  return { ...db, settings: { ...db.settings, tileSizes: { ...(db.settings.tileSizes ?? {}), [id]: next } } };
}

const TIMELINE_FILTERS = ["all", "money", "vehicles", "travel", "home", "notes"] as const;

/** Timeline chips in a circle. The last filter wraps to the first. */
export function nextTimelineFilter(id: string, dir: "next" | "prev"): string {
  const index = TIMELINE_FILTERS.indexOf(id as (typeof TIMELINE_FILTERS)[number]);
  const at = index < 0 ? 0 : index;
  switch (dir) {
    case "next":
      return TIMELINE_FILTERS[(at + 1) % TIMELINE_FILTERS.length];
    case "prev":
      return TIMELINE_FILTERS[(at - 1 + TIMELINE_FILTERS.length) % TIMELINE_FILTERS.length];
    default: {
      const unreachable: never = dir;
      return unreachable;
    }
  }
}

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
