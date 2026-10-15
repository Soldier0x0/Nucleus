import type { DB, HeadsUpState, HomePresetId, ModuleId, TileId, TripMode } from "./types";
import { billBoardItems } from "./bills";
import { documentBoardItems } from "./documents";
import { vehicleDocBoardItems } from "./vehicleDocs";
import { isPersonalTrip } from "./transit";
import { uid } from "./format";
import { repeatingBills } from "./moneyDesk";

export type PresetItem = { id: string; size: "large" | "small" };
export type HomeRow = { items: PresetItem[] };

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

const VEHICLE: PresetItem[] = [
  { id: "vehicle", size: "large" },
  { id: "mileage", size: "small" },
  { id: "fuel", size: "small" },
  { id: "servleft", size: "small" },
  { id: "costkm", size: "small" },
  { id: "service", size: "small" },
  { id: "range", size: "small" },
];

const TRAVEL: PresetItem[] = [
  { id: "route", size: "large" },
  { id: "transitmetro", size: "small" },
  { id: "transittrain", size: "small" },
  { id: "transitcab", size: "small" },
  { id: "transitbus", size: "small" },
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
  { id: "warranties", size: "small" },
  { id: "utilities", size: "small" },
];

const HEALTH: PresetItem[] = [
  { id: "cycle", size: "large" },
  { id: "water", size: "small" },
  { id: "cyclestash", size: "small" },
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
  { id: "vehicle", name: "Vehicle", icon: "motorbike" },
  { id: "travel", name: "Travel", icon: "train-car" },
  { id: "home", name: "Home", icon: "home-outline" },
  { id: "health", name: "Health", icon: "cup-water" },
  { id: "documents", name: "Documents", icon: "file-document-outline" },
  { id: "bills", name: "Bills", icon: "calendar-clock" },
  { id: "desk", name: "Desk", icon: "book-open-variant" },
  { id: "workshop", name: "Workshop", icon: "hammer-wrench" },
];

const PRESET_IDS: HomePresetId[] = ["custom", "money", "vehicle", "travel", "home", "health", "documents", "bills", "desk", "workshop"];

/** Install-over: bike/fuel-only Travel users land on Vehicle; public trips stay on Travel. */
export function migrateHomePresetOnLoad(raw: unknown, preset: HomePresetId): HomePresetId {
  if (preset !== "travel") return preset;
  const bag = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const trips = Array.isArray(bag.trips) ? bag.trips : [];
  const hasPublic = trips.some((trip) => trip && typeof trip === "object" && !isPersonalTrip(trip as { mode?: TripMode }));
  const fuel = Array.isArray(bag.fuel) ? bag.fuel : [];
  const vehicles = Array.isArray(bag.vehicles) ? bag.vehicles : [];
  if ((fuel.length > 0 || vehicles.length > 0) && !hasPublic) return "vehicle";
  return "travel";
}

export function parseHomePreset(raw: unknown): HomePresetId {
  return PRESET_IDS.includes(raw as HomePresetId) ? (raw as HomePresetId) : "custom";
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
    case "vehicle":
      return VEHICLE;
    case "travel":
      return TRAVEL;
    case "home":
      return HOME;
    case "health":
      return HEALTH;
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
    case "transitmetro":
    case "transittrain":
    case "transitcab":
    case "transitbus":
      return db.txns.some((row) => row.type === "expense" && row.category === "Travel");
    case "costkm":
    case "fueltank":
    case "servleft":
    case "mileage":
    case "range":
      return mileageKnown(db) || db.fuel.length > 0 || db.vehicles.length > 0;
    case "fuel":
      return db.fuel.length > 0;
    case "water":
      return db.water.times.length > 0;
    case "cyclestash":
      return db.cycle.stash.some((row) => row.count !== null && row.count > 0);
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
  weather: "home",
  transitmetro: "travel",
  transittrain: "travel",
  transitcab: "travel",
  transitbus: "travel",
  costkm: "vehicles",
  fueltank: "vehicles",
  servleft: "vehicles",
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
  cycle: "health",
  water: "health",
  cyclestash: "health",
  "vdoc-motor": "vehicles",
  "vdoc-pa": "vehicles",
  "vdoc-puc": "vehicles",
  "vdoc-rsa": "vehicles",
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
    if (item.id === "cycle" || item.id === "cyclestash") {
      const cycleOn = db.settings.modules.find((row) => row.id === "cycle")?.enabled !== false;
      if (!cycleOn) return false;
    }
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
    case "vehicle": {
      const docs = vehicleDocBoardItems(db);
      items = [...presetItems(preset), ...docs, { id: "papers", size: "small" }];
      items = items.filter((item) => item.id !== "fueltank" && item.id !== "vdoc-rsa");
      break;
    }
    case "money":
    case "travel":
    case "home":
    case "health":
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
    case "transitmetro":
      return "Metro";
    case "transittrain":
      return "Train";
    case "transitcab":
      return "Cab";
    case "transitbus":
      return "Bus";
    case "costkm":
      return "Cost / km";
    case "fueltank":
      return "Fuel vs tank";
    case "servleft":
      return "Service left";
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
    case "water":
      return "Water";
    case "cyclestash":
      return "Stash";
    case "vdoc-motor":
      return "Motor policy";
    case "vdoc-pa":
      return "Personal accident";
    case "vdoc-puc":
      return "PUC";
    case "vdoc-rsa":
      return "Roadside";
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

export const BOARD_CIRCLE: HomePresetId[] = ["custom", "money", "vehicle", "travel", "home", "health", "documents", "bills", "desk", "workshop"];

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
    case "vehicle":
    case "travel":
    case "home":
    case "health":
    case "documents":
    case "bills":
    case "desk":
    case "workshop":
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
    case "vehicle":
    case "travel":
    case "home":
    case "health":
    case "documents":
    case "bills":
      return false;
    case "custom":
    case "desk":
    case "workshop":
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

export function moduleAlerts<T>(_db: DB, items: T[]): T[] {
  return items;
}

export function dismissQuiet(db: DB, key: string): DB {
  return { ...db, attention: { ...db.attention, [key]: { status: "dismissed" } } };
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
