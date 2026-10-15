import type { Budget, DB, FuelEntry, FuelFillKind, HomePresetId, OdometerLog, PairedDevice, ServiceEntry, Settings, Trip, Txn, Vehicle, VehicleJourney } from "./types";
import { isChannel } from "./merchantTable";
import { isTransitKind, tripKindOf } from "./transit";
import { emptyCycle, normalizeCycle } from "./cycle";
import { emptyWater, normalizeWater } from "./water";
import { normalizeReminders } from "./reminders";
import { normalizeMedicines } from "./medicines";
import { cleanCallName } from "./greeting";
import { parseLauncher } from "./launcher";
import { parseLook } from "./looks";
import { parseLayout } from "./layouts";
import { parseTileOrder } from "./homeOrder";
import { emptyHeadsUp, migrateHomePresetOnLoad, parseHeadsUp, parseHomePreset, parsePresetLast, parseTileSizes } from "./presets";
import { normalizePaper } from "./paperNormalize";
import { isContentRoute, normalizeReopenHours, REOPEN_DEFAULT_HOURS } from "./reopen";
import { uid } from "./format";

export const DB_KEY = "nucleus.db.v1";
export const LEGACY_DB_KEY = "tessera.db.v1";

export const defaultSettings: Settings = {
  onboarded: false,
  currency: "INR",
  distanceUnit: "km",
  volumeUnit: "L",
  tempUnit: "C",
  timeFormat: "12h",
  theme: "paper",
  look: "cards",
  layout: "bento",
  appearanceChosen: true,
  dualTone: false,
  online: false,
  locationAsked: false,
  locationGranted: false,
  accent: "ochre",
  density: "comfortable",
  privacyMode: false,
  lockEnabled: false,
  unlockMethod: "pin",
  biometricEnabled: false,
  lockTimeoutSec: 30,
  moduleLocks: [],
  clipboardAutoClear: true,
  blockScreenshots: true,
  autoLinkExpenses: true,
  modules: [
    { id: "vehicles", enabled: true, hidden: false },
    { id: "money", enabled: true, hidden: false },
    { id: "travel", enabled: false, hidden: true },
    { id: "home", enabled: true, hidden: false },
    { id: "tools", enabled: true, hidden: false },
    { id: "notes", enabled: true, hidden: false },
    { id: "rules", enabled: true, hidden: false },
    { id: "dev", enabled: false, hidden: false },
    { id: "builder", enabled: true, hidden: false },
    { id: "media", enabled: false, hidden: false },
    { id: "lab", enabled: false, hidden: false },
    { id: "papers", enabled: true, hidden: false },
    { id: "kanban", enabled: true, hidden: false },
    { id: "wiki", enabled: true, hidden: false },
    { id: "net", enabled: false, hidden: false },
    { id: "cycle", enabled: true, hidden: false },
    { id: "health", enabled: true, hidden: false },
  ],
  tiles: [
    { id: "attention", enabled: true },
    { id: "weather", enabled: true },
    { id: "trip", enabled: true },
    { id: "budget", enabled: true },
    { id: "vehicle", enabled: true },
    { id: "home", enabled: true },
    { id: "subscriptions", enabled: true },
    { id: "notes", enabled: true },
    { id: "tools", enabled: true },
  ],
  tileSizes: {},
  tileOrder: {},
  boards: [],
  remindersEnabled: false,
  highContrast: false,
  largeTouch: false,
  reducedMotion: false,
  quietHours: { enabled: true, from: 22, to: 7 },
  emergency: { bloodGroup: "", contactName: "", contactPhone: "", note: "", showOnLock: false },
  shortcuts: [],
  nameAsked: false,
  launcher: { family: "paper", variant: "paper" },
  cloud: { provider: "off", askedSinceUnlock: false },
  smsInbox: false,
  bankTextsAsked: false,
  bankTextsOff: false,
  postNotificationsWarned: false,
  lockAlerts: false,
  moneyNames: [],
  smsMemory: [],
  ownAccounts: [],
  merchantOverrides: [],
  travelFolded: true,
  installId: "",
  pairedDevices: [],
  readOnly: false,
  reopenHours: REOPEN_DEFAULT_HOURS,
  lastRoute: null,
  lastRouteAt: null,
  homePreset: "custom",
  presetLast: {},
  headsUp: emptyHeadsUp(),
  sampleIds: [],
};

export const EXPENSE_CATEGORIES = ["Food", "Groceries", "Fuel", "Vehicle", "Bills", "Electricity", "Rent", "Shopping", "Health", "Entertainment", "Subscriptions", "Travel", "Loan EMI", "Other"];
export const INCOME_CATEGORIES = ["Salary", "Freelance", "Interest", "Refund", "Gift", "Other"];

export function emptyDB(): DB {
  return {
    version: 1,
    settings: {
    ...defaultSettings,
    launcher: { ...defaultSettings.launcher },
    cloud: { ...defaultSettings.cloud },
    moneyNames: [...defaultSettings.moneyNames],
    smsMemory: [...defaultSettings.smsMemory],
    ownAccounts: [...defaultSettings.ownAccounts],
    merchantOverrides: [...defaultSettings.merchantOverrides],
    pairedDevices: [...defaultSettings.pairedDevices],
      presetLast: {},
    headsUp: emptyHeadsUp(),
    sampleIds: [],
    modules: defaultSettings.modules.map((m) => ({ ...m })),
    tiles: defaultSettings.tiles.map((t) => ({ ...t })),
    tileSizes: { ...defaultSettings.tileSizes },
    tileOrder: { ...defaultSettings.tileOrder },
  },
    vehicles: [],
    fuel: [],
    odometerLogs: [],
    vehicleJourneys: [],
    services: [],
    txns: [],
    subscriptions: [],
    links: [],
    trips: [],
    appliances: [],
    utilities: [],
    chores: [],
    notes: [],
    rules: [],
    ruleFires: {},
    customTools: [],
    media: [],
    funds: [],
    debts: [],
    netWorth: [],
    people: [],
    papers: [],
    parts: [],
    specs: [],
    kanban: [],
    wiki: [],
    templates: [],
    netlog: [],
    budget: { monthly: 0, categories: {} },
    attention: {},
    toolHistory: [],
    recents: {},
    cycle: emptyCycle(),
    water: emptyWater(),
    reminders: [],
    medicines: [],
    tombstones: [],
  };
}

/** Forward-compatible merge: older/partial snapshots get any missing fields from defaults. */
export function normalizeDB(raw: any): DB {
  const base = emptyDB();
  const s = { ...base.settings, ...(raw?.settings ?? {}) };
  // v1 (Nucleus) theme values -> Nucleus themes
  if ((s.theme as string) === "light") s.theme = "paper";
  if ((s.theme as string) === "dark") s.theme = "midnight";
  s.look = parseLook(raw?.settings?.look);
  s.layout = parseLayout(raw?.settings?.layout);
  if (raw?.settings?.appearanceChosen === true) {
    s.appearanceChosen = true;
  } else {
    if (!raw?.settings?.theme || s.theme === "midnight") s.theme = "paper";
    if (!raw?.settings?.look || raw.settings.look === "current") s.look = "cards";
    if (!raw?.settings?.layout || raw.settings.layout === "stack") s.layout = "bento";
    s.appearanceChosen = true;
  }
  s.dualTone = raw?.settings?.dualTone === true;
  s.cloud = parseCloud(raw?.settings?.cloud);
  s.smsInbox = raw?.settings?.smsInbox === true;
  s.bankTextsAsked = raw?.settings?.bankTextsAsked === true;
  s.bankTextsOff = raw?.settings?.bankTextsOff === true;
  s.postNotificationsWarned = raw?.settings?.postNotificationsWarned === true;
  s.lockAlerts = raw?.settings?.lockAlerts === true;
  s.readOnly = raw?.settings?.readOnly === true;
  s.reopenHours = normalizeReopenHours(raw?.settings?.reopenHours);
  const savedRoute = raw?.settings?.lastRoute;
  s.lastRoute = typeof savedRoute === "string" && isContentRoute(savedRoute) ? savedRoute.slice(0, 120) : null;
  const savedRouteAt = raw?.settings?.lastRouteAt;
  s.lastRouteAt = typeof savedRouteAt === "string" && !Number.isNaN(Date.parse(savedRouteAt)) ? savedRouteAt.slice(0, 40) : null;
  const shell = raw?.settings?.nativeModuleShell;
  if (shell === false) s.nativeModuleShell = false;
  else delete s.nativeModuleShell;
  s.installId = typeof raw?.settings?.installId === "string" && raw.settings.installId.trim() ? String(raw.settings.installId).slice(0, 40) : uid();
  s.homePreset = migrateHomePresetOnLoad(raw, parseHomePreset(raw?.settings?.homePreset));
  // v0.9.8: ADHD mode removed. An "adhd" home preset parses to custom; its saved data is dropped.
  delete (s as { adhd?: unknown }).adhd;
  s.presetLast = parsePresetLast(raw?.settings?.presetLast);
  s.headsUp = parseHeadsUp(raw?.settings?.headsUp);
  s.sampleIds = Array.isArray(raw?.settings?.sampleIds) ? raw.settings.sampleIds.filter((id: unknown) => typeof id === "string").map((id: string) => id.slice(0, 40)).slice(0, 800) : [];
  const priorBudget = raw?.settings?.sampleBudget;
  if (priorBudget && typeof priorBudget.monthly === "number" && priorBudget.categories && typeof priorBudget.categories === "object") {
    const categories: Record<string, number> = {};
    for (const [key, value] of Object.entries(priorBudget.categories)) {
      if (typeof value === "number") {
        const name = foldedCategory(key);
        categories[name.slice(0, 40)] = (categories[name.slice(0, 40)] ?? 0) + value;
      }
    }
    s.sampleBudget = { monthly: priorBudget.monthly, categories };
  }
  s.moneyNames = Array.isArray(raw?.settings?.moneyNames) ? raw.settings.moneyNames.filter((name: unknown) => typeof name === "string").map((name: string) => name.slice(0, 40)) : [];
  s.smsMemory = parseSmsMemory(raw?.settings?.smsMemory);
  s.ownAccounts = Array.isArray(raw?.settings?.ownAccounts) ? raw.settings.ownAccounts.filter((name: unknown) => typeof name === "string").map((name: string) => name.slice(0, 12)) : [];
  s.merchantOverrides = Array.isArray(raw?.settings?.merchantOverrides)
    ? raw.settings.merchantOverrides
        .filter((row: any) => row && typeof row.key === "string" && isChannel(row.channel))
        .slice(-80)
        .map((row: any) => ({ key: String(row.key).slice(0, 40), channel: row.channel }))
    : [];
  s.pairedDevices = parsePairedDevices(raw?.settings?.pairedDevices);
  s.emergency = { ...base.settings.emergency, ...(raw?.settings?.emergency ?? {}) };
  const callName = typeof raw?.settings?.givenName === "string" ? cleanCallName(raw.settings.givenName) : "";
  if (callName) s.givenName = callName;
  else delete s.givenName;
  s.nameAsked = raw?.settings?.nameAsked === true;
  s.locationAsked = raw?.settings?.locationAsked === true;
  s.locationGranted = raw?.settings?.locationGranted === true;
  const fix = raw?.settings?.locationRead;
  if (fix && typeof fix.lat === "number" && typeof fix.lon === "number") s.locationRead = { lat: fix.lat, lon: fix.lon };
  else delete s.locationRead;
  s.launcher = parseLauncher(raw?.settings?.launcher);
  s.shortcuts = Array.isArray(raw?.settings?.shortcuts)
    ? raw.settings.shortcuts
        .filter((x: any) => x && typeof x.id === "string" && typeof x.label === "string" && typeof x.url === "string" && x.url.startsWith("nucleus://open?"))
        .slice(0, 4)
        .map((x: any) => ({ id: String(x.id).slice(0, 40), label: String(x.label).slice(0, 24), url: String(x.url).slice(0, 180) }))
    : [];
  const knownMods = base.settings.modules.map((m) => m.id);
  s.modules = [
    ...(raw?.settings?.modules ?? []).filter((m: any) => knownMods.includes(m.id)),
    ...base.settings.modules.filter((m) => !(raw?.settings?.modules ?? []).some((x: any) => x.id === m.id)),
  ];
  // v0.9.8: Travel folded into Money. An old file without the marker hides the module once;
  // turning it back on later writes the marker, so the choice sticks.
  const rawSettings = raw?.settings;
  const markerPresent = !!rawSettings && typeof rawSettings === "object" && "travelFolded" in rawSettings;
  s.travelFolded = true;
  if (!markerPresent) s.modules = s.modules.map((m: any) => (m.id === "travel" ? { ...m, enabled: false, hidden: true } : m));
  const knownTiles = base.settings.tiles.map((t) => t.id);
  s.tiles = [
    ...(raw?.settings?.tiles ?? []).filter((t: any) => knownTiles.includes(t.id)),
    ...base.settings.tiles.filter((t) => !(raw?.settings?.tiles ?? []).some((x: any) => x.id === t.id)),
  ];
  s.tileSizes = parseTileSizes(raw?.settings?.tileSizes);
  s.tileOrder = parseTileOrder(raw?.settings?.tileOrder);
  return {
    ...base,
    ...raw,
    version: 1,
    settings: s,
    budget: migrateBudget(raw?.budget),
    utilities: Array.isArray(raw?.utilities) ? raw.utilities : [],
    chores: Array.isArray(raw?.chores) ? raw.chores : [],
    media: Array.isArray(raw?.media) ? raw.media : [],
    people: Array.isArray(raw?.people) ? raw.people : [],
    papers: Array.isArray(raw?.papers) ? raw.papers.map(normalizePaper) : [],
    fuel: Array.isArray(raw?.fuel) ? raw.fuel.map(normalizeFuel) : [],
    odometerLogs: Array.isArray(raw?.odometerLogs) ? raw.odometerLogs.map(normalizeOdometerLog) : [],
    vehicleJourneys: Array.isArray(raw?.vehicleJourneys) ? raw.vehicleJourneys.map(normalizeVehicleJourney) : [],
    vehicles: Array.isArray(raw?.vehicles) ? raw.vehicles.map(normalizeVehicle) : [],
    services: Array.isArray(raw?.services) ? raw.services.map(normalizeService) : [],
    trips: Array.isArray(raw?.trips) ? raw.trips.map(normalizeTrip) : [],
    parts: Array.isArray(raw?.parts) ? raw.parts : [],
    specs: Array.isArray(raw?.specs) ? raw.specs : [],
    kanban: Array.isArray(raw?.kanban) ? raw.kanban : [],
    wiki: Array.isArray(raw?.wiki) ? raw.wiki : [],
    templates: Array.isArray(raw?.templates) ? raw.templates : [],
    txns: Array.isArray(raw?.txns) ? raw.txns.map(normalizeTxn) : [],
    cycle: normalizeCycle(raw?.cycle),
    water: normalizeWater(raw?.water),
    reminders: normalizeReminders(raw?.reminders),
    medicines: normalizeMedicines(raw?.medicines),
    tombstones: Array.isArray(raw?.tombstones) ? raw.tombstones.filter((t: any) => t && typeof t.id === "string" && typeof t.kind === "string" && typeof t.deletedAt === "string") : [],
  };
}

/** v0.9.8: one Travel category. Transport lines and budget limits move over, added up. */
function foldedCategory(name: string): string {
  return name === "Transport" ? "Travel" : name;
}

function migrateBudget(raw: any): Budget {
  const base: Budget = { monthly: 0, categories: {} };
  if (!raw || typeof raw !== "object") return base;
  const categories: Record<string, number> = {};
  const src = raw.categories && typeof raw.categories === "object" ? raw.categories : {};
  for (const [key, value] of Object.entries(src)) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const name = foldedCategory(key);
    categories[name.slice(0, 40)] = (categories[name.slice(0, 40)] ?? 0) + value;
  }
  return {
    monthly: typeof raw.monthly === "number" && Number.isFinite(raw.monthly) ? raw.monthly : base.monthly,
    categories,
  };
}

function parseCloud(raw: any): Settings["cloud"] {
  const provider = raw?.provider === "drive" || raw?.provider === "onedrive" ? raw.provider : "off";
  const cloud: Settings["cloud"] = { provider, askedSinceUnlock: raw?.askedSinceUnlock === true };
  if (typeof raw?.lastSyncAt === "string") cloud.lastSyncAt = raw.lastSyncAt;
  if (typeof raw?.unlockedAt === "string") cloud.unlockedAt = raw.unlockedAt;
  return cloud;
}

const KEY_B64 = /^[A-Za-z0-9+/]{43}=$/;

/** Paired desktops keep only rows that still carry a usable X25519 public key. */
function parsePairedDevices(raw: unknown): PairedDevice[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((dev: any) => dev && typeof dev.id === "string" && dev.id.trim() && typeof dev.name === "string" && typeof dev.key === "string" && KEY_B64.test(dev.key))
    .slice(0, 16)
    .map((dev: any) => ({
      id: String(dev.id).trim().slice(0, 40),
      name: dev.name.trim().slice(0, 40) || "Device",
      key: dev.key,
      lastSyncAt: typeof dev.lastSyncAt === "string" ? dev.lastSyncAt.slice(0, 40) : "",
    }));
}

function parseSmsMemory(raw: unknown): Settings["smsMemory"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row) => row && typeof row.key === "string" && (row.choice === "category" || row.choice === "transfer" || row.choice === "ignore"))
    .slice(0, 80)
    .map((row) => ({
      key: String(row.key).slice(0, 40),
      choice: row.choice as Settings["smsMemory"][number]["choice"],
      category: typeof row.category === "string" ? row.category.slice(0, 40) : undefined,
    }));
}

function normalizeFillKind(raw: unknown): FuelFillKind {
  return raw === "partial" ? "partial" : "full";
}

function normalizeFuel(raw: FuelEntry): FuelEntry {
  const next = { ...raw, fillKind: normalizeFillKind(raw.fillKind) };
  if (typeof raw.loggedAt === "string" && raw.loggedAt.trim()) next.loggedAt = raw.loggedAt.trim().slice(0, 40);
  else delete next.loggedAt;
  return next;
}

function normalizeVehicle(raw: Vehicle): Vehicle {
  const next = { ...raw };
  if (typeof raw.cover === "string" && raw.cover.trim()) next.cover = raw.cover;
  else delete next.cover;
  if (typeof raw.tankLitres === "number" && Number.isFinite(raw.tankLitres) && raw.tankLitres > 0) next.tankLitres = raw.tankLitres;
  else delete next.tankLitres;
  const checklist = Array.isArray(raw.rideChecklist)
    ? raw.rideChecklist.filter((text: unknown) => typeof text === "string" && text.trim()).map((text: string) => text.trim().slice(0, 60)).slice(0, 30)
    : [];
  if (checklist.length) next.rideChecklist = checklist;
  else delete next.rideChecklist;
  return next;
}

/**
 * A trip is a journey card unless it is clearly daily public travel: a same-day
 * metro/train/cab/bus/flight. An explicit kind (the "Journey" tap) is kept as saved.
 */
function normalizeTrip(raw: Trip): Trip {
  const next = { ...raw };
  next.start = typeof raw.start === "string" ? raw.start.slice(0, 10) : "";
  next.end = typeof raw.end === "string" ? raw.end.slice(0, 10) : next.start;
  if (raw.mode === "public" || raw.mode === "personal") next.mode = raw.mode;
  else delete next.mode;
  if (isTransitKind(raw.transit)) next.transit = raw.transit;
  else delete next.transit;
  next.kind = tripKindOf({ kind: raw.kind === "journey" || raw.kind === "transit" ? raw.kind : undefined, mode: next.mode, transit: next.transit, start: next.start, end: next.end });
  return next;
}

function normalizeOdometerLog(raw: OdometerLog): OdometerLog {
  return {
    id: String(raw.id).slice(0, 40),
    vehicleId: String(raw.vehicleId).slice(0, 40),
    at: String(raw.at).slice(0, 40),
    odometer: Math.round(raw.odometer),
    note: typeof raw.note === "string" && raw.note.trim() ? raw.note.trim().slice(0, 200) : undefined,
  };
}

function normalizeVehicleJourney(raw: VehicleJourney): VehicleJourney {
  const next: VehicleJourney = {
    id: String(raw.id).slice(0, 40),
    vehicleId: String(raw.vehicleId).slice(0, 40),
    startAt: String(raw.startAt).slice(0, 40),
    startOdometer: Math.round(raw.startOdometer),
  };
  if (typeof raw.endAt === "string" && raw.endAt.trim()) next.endAt = raw.endAt.trim().slice(0, 40);
  if (typeof raw.endOdometer === "number" && Number.isFinite(raw.endOdometer)) next.endOdometer = Math.round(raw.endOdometer);
  if (typeof raw.note === "string" && raw.note.trim()) next.note = raw.note.trim().slice(0, 200);
  const checklist = Array.isArray(raw.checklist)
    ? raw.checklist
        .filter((item: any) => item && typeof item.text === "string" && item.text.trim())
        .map((item: any) => ({ id: typeof item.id === "string" && item.id.trim() ? item.id.slice(0, 40) : uid(), text: String(item.text).trim().slice(0, 60), done: item.done === true }))
        .slice(0, 30)
    : [];
  if (checklist.length) next.checklist = checklist;
  else delete next.checklist;
  return next;
}

function normalizeService(raw: ServiceEntry): ServiceEntry {
  const next = { ...raw };
  if (typeof raw.billFile === "string" && raw.billFile.trim()) next.billFile = raw.billFile;
  else delete next.billFile;
  if (typeof raw.billMime === "string" && raw.billMime.trim()) next.billMime = raw.billMime.trim().slice(0, 80);
  else delete next.billMime;
  return next;
}

function normalizeTxn(raw: Txn): Txn {
  const item = typeof raw?.item === "string" ? raw.item.replace(/\s+/g, " ").trim().slice(0, 40) : "";
  const next = { ...raw };
  if (next.category === "Transport") next.category = "Travel";
  if (item) next.item = item;
  else delete next.item;
  if (isChannel(raw?.channel)) next.channel = raw.channel;
  else delete next.channel;
  if (raw?.cash === true) next.cash = true;
  else delete next.cash;
  if (raw?.transfer === true) next.transfer = true;
  else delete next.transfer;
  if (typeof raw?.balance === "number" && Number.isFinite(raw.balance)) next.balance = raw.balance;
  else delete next.balance;
  if (typeof raw?.tripId === "string" && raw.tripId.trim()) next.tripId = raw.tripId.trim().slice(0, 40);
  else delete next.tripId;
  return next;
}
