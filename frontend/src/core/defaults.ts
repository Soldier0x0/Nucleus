import type { DB, Settings, Txn } from "./types";
import { emptyCycle, normalizeCycle } from "./cycle";
import { emptyWater, normalizeWater } from "./water";
import { cleanCallName } from "./greeting";
import { parseLauncher } from "./launcher";
import { parseLook } from "./looks";
import { parseLayout } from "./layouts";
import { parseTileOrder } from "./homeOrder";
import { emptyAdhd, emptyHeadsUp, parseAdhd, parseHeadsUp, parseHomePreset, parsePresetLast, parseTileSizes } from "./presets";
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
    { id: "travel", enabled: true, hidden: false },
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
  lockAlerts: false,
  moneyNames: [],
  smsMemory: [],
  ownAccounts: [],
  installId: "",
  readOnly: false,
  homePreset: "custom",
  adhd: emptyAdhd(),
  presetLast: {},
  headsUp: emptyHeadsUp(),
  sampleIds: [],
};

export const EXPENSE_CATEGORIES = ["Food", "Groceries", "Fuel", "Vehicle", "Transport", "Bills", "Electricity", "Rent", "Shopping", "Health", "Entertainment", "Subscriptions", "Travel", "Loan EMI", "Other"];
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
    adhd: emptyAdhd(),
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
  s.lockAlerts = raw?.settings?.lockAlerts === true;
  s.readOnly = raw?.settings?.readOnly === true;
  s.installId = typeof raw?.settings?.installId === "string" && raw.settings.installId.trim() ? String(raw.settings.installId).slice(0, 40) : uid();
  s.homePreset = parseHomePreset(raw?.settings?.homePreset);
  s.adhd = parseAdhd(raw?.settings?.adhd);
  s.presetLast = parsePresetLast(raw?.settings?.presetLast);
  s.headsUp = parseHeadsUp(raw?.settings?.headsUp);
  s.sampleIds = Array.isArray(raw?.settings?.sampleIds) ? raw.settings.sampleIds.filter((id: unknown) => typeof id === "string").map((id: string) => id.slice(0, 40)).slice(0, 800) : [];
  const priorBudget = raw?.settings?.sampleBudget;
  if (priorBudget && typeof priorBudget.monthly === "number" && priorBudget.categories && typeof priorBudget.categories === "object") {
    const categories: Record<string, number> = {};
    for (const [key, value] of Object.entries(priorBudget.categories)) {
      if (typeof value === "number") categories[key.slice(0, 40)] = value;
    }
    s.sampleBudget = { monthly: priorBudget.monthly, categories };
  }
  s.moneyNames = Array.isArray(raw?.settings?.moneyNames) ? raw.settings.moneyNames.filter((name: unknown) => typeof name === "string").map((name: string) => name.slice(0, 40)) : [];
  s.smsMemory = parseSmsMemory(raw?.settings?.smsMemory);
  s.ownAccounts = Array.isArray(raw?.settings?.ownAccounts) ? raw.settings.ownAccounts.filter((name: unknown) => typeof name === "string").map((name: string) => name.slice(0, 12)) : [];
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
    budget: { ...base.budget, ...(raw?.budget ?? {}) },
    utilities: Array.isArray(raw?.utilities) ? raw.utilities : [],
    chores: Array.isArray(raw?.chores) ? raw.chores : [],
    media: Array.isArray(raw?.media) ? raw.media : [],
    people: Array.isArray(raw?.people) ? raw.people : [],
    papers: Array.isArray(raw?.papers) ? raw.papers : [],
    parts: Array.isArray(raw?.parts) ? raw.parts : [],
    specs: Array.isArray(raw?.specs) ? raw.specs : [],
    kanban: Array.isArray(raw?.kanban) ? raw.kanban : [],
    wiki: Array.isArray(raw?.wiki) ? raw.wiki : [],
    templates: Array.isArray(raw?.templates) ? raw.templates : [],
    txns: Array.isArray(raw?.txns) ? raw.txns.map(normalizeTxn) : [],
    cycle: normalizeCycle(raw?.cycle),
    water: normalizeWater(raw?.water),
  };
}

function parseCloud(raw: any): Settings["cloud"] {
  const provider = raw?.provider === "drive" || raw?.provider === "onedrive" ? raw.provider : "off";
  const cloud: Settings["cloud"] = { provider, askedSinceUnlock: raw?.askedSinceUnlock === true };
  if (typeof raw?.lastSyncAt === "string") cloud.lastSyncAt = raw.lastSyncAt;
  if (typeof raw?.unlockedAt === "string") cloud.unlockedAt = raw.unlockedAt;
  return cloud;
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

function normalizeTxn(raw: Txn): Txn {
  const item = typeof raw?.item === "string" ? raw.item.replace(/\s+/g, " ").trim().slice(0, 40) : "";
  const next = { ...raw };
  if (item) next.item = item;
  else delete next.item;
  if (raw?.cash === true) next.cash = true;
  else delete next.cash;
  if (raw?.transfer === true) next.transfer = true;
  else delete next.transfer;
  if (typeof raw?.balance === "number" && Number.isFinite(raw.balance)) next.balance = raw.balance;
  else delete next.balance;
  return next;
}
