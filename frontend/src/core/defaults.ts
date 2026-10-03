import type { DB, Settings, Txn } from "./types";
import { emptyCycle, normalizeCycle } from "./cycle";
import { cleanCallName } from "./greeting";
import { parseLauncher } from "./launcher";
import { parseLook } from "./looks";

export const DB_KEY = "nucleus.db.v1";
export const LEGACY_DB_KEY = "tessera.db.v1";

export const defaultSettings: Settings = {
  onboarded: false,
  currency: "INR",
  distanceUnit: "km",
  volumeUnit: "L",
  tempUnit: "C",
  timeFormat: "12h",
  theme: "midnight",
  look: "current",
  dualTone: false,
  online: false,
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
};

export const EXPENSE_CATEGORIES = ["Food", "Groceries", "Fuel", "Vehicle", "Transport", "Bills", "Electricity", "Rent", "Shopping", "Health", "Entertainment", "Subscriptions", "Travel", "Loan EMI", "Other"];
export const INCOME_CATEGORIES = ["Salary", "Freelance", "Interest", "Refund", "Gift", "Other"];

export function emptyDB(): DB {
  return {
    version: 1,
    settings: { ...defaultSettings, launcher: { ...defaultSettings.launcher }, modules: defaultSettings.modules.map((m) => ({ ...m })), tiles: defaultSettings.tiles.map((t) => ({ ...t })) },
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
  s.dualTone = raw?.settings?.dualTone === true;
  s.emergency = { ...base.settings.emergency, ...(raw?.settings?.emergency ?? {}) };
  const callName = typeof raw?.settings?.givenName === "string" ? cleanCallName(raw.settings.givenName) : "";
  if (callName) s.givenName = callName;
  else delete s.givenName;
  s.nameAsked = raw?.settings?.nameAsked === true;
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
  };
}

function normalizeTxn(raw: Txn): Txn {
  const item = typeof raw?.item === "string" ? raw.item.replace(/\s+/g, " ").trim().slice(0, 40) : "";
  const next = { ...raw };
  if (item) next.item = item;
  else delete next.item;
  return next;
}
