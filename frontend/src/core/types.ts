/**
 * Nucleus shared data model.
 * Every record is an "entity" of a known kind; cross-module relationships live in `links`.
 */
export type EntityKind = "vehicle" | "fuel" | "service" | "txn" | "subscription" | "trip" | "appliance" | "note" | "media" | "paper";

export type PackItem = { id: string; name: string; category: string; done: boolean };
export type ItineraryItem = { id: string; date: string; time: string; title: string; place?: string; note?: string; stop?: "fuel" | "snack" };
export type TripDoc = { id: string; name: string; have: boolean; expiry?: string };
export type Place = { name: string; lat: number; lon: number; country?: string; countryCode?: string; elevation?: number };
export type TripMode = "personal" | "public";
export type TransitKind = "metro" | "train" | "cab" | "bus";
export type Trip = {
  id: string;
  name: string;
  destination: string;
  place?: Place;
  start: string;
  end: string;
  travellers: number;
  budget: number;
  packing: PackItem[];
  itinerary: ItineraryItem[];
  docs: TripDoc[];
  createdAt: string;
  /** Weather was saved on this phone before leaving. */
  weatherSaved?: boolean;
  mode?: TripMode;
  transit?: TransitKind;
};
export type MaintPlan = { id: string; name: string; everyMonths: number; lastDone: string; cost?: number };
export type Appliance = {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  serial?: string;
  room: string;
  purchaseDate?: string;
  price?: number;
  warrantyUntil?: string;
  plans: MaintPlan[];
  createdAt: string;
};
export type NetLogEntry = { id: string; at: string; service: string; query: string; ok: boolean };
export type ChecklistItem = { id: string; text: string; done: boolean };
export type MediaKind = "movie" | "series" | "book" | "game" | "other";
export type MediaStatus = "backlog" | "active" | "done" | "dropped";
export type MediaItem = { id: string; kind: MediaKind; title: string; status: MediaStatus; progress: number; rating: number; review?: string; tags: string[]; cover?: string; createdAt: string; updatedAt: string };
export type UtilityKind = "electricity" | "water" | "lpg" | "internet";
export type UtilityBill = { id: string; kind: UtilityKind; date: string; amount: number; reading?: number; note?: string; photo?: string };
export type Person = { id: string; name: string; note?: string };
export type PaperKind = "licence" | "registration" | "insurance" | "passport" | "fastag" | "warranty" | "other";
export type Paper = { id: string; kind: PaperKind; title: string; number?: string; expiry?: string; note?: string; photo?: string; personId?: string; vehicleId?: string; createdAt: string };
export type WearPart = { id: string; vehicleId: string; kind: "tyre" | "battery" | "chain" | "brake" | "other"; name: string; installedOn?: string; odometer?: number; everyKm?: number; note?: string };
export type HomeSpec = { id: string; label: string; value: string; room?: string; applianceId?: string };
export type Chore = { id: string; name: string; everyDays: number; lastDone: string; room?: string; assignee?: string };
export type Note = { id: string; title: string; body: string; checklist: ChecklistItem[]; pinned?: boolean; createdAt: string; updatedAt: string };
export type Ref = { kind: EntityKind; id: string };

export type FuelType = "petrol" | "diesel" | "cng" | "electric" | "hybrid" | "other";
export type HybridFrom = "petrol" | "diesel";
export type VehicleBody = "scooter" | "sport" | "naked" | "cruiser" | "adventure" | "hatchback" | "sedan" | "suv" | "pickup" | "van" | "other";

export type Vehicle = {
  id: string;
  name: string;
  type: "car" | "bike" | "other";
  make?: string;
  model?: string;
  plate?: string;
  fuelType: FuelType;
  /** Set when fuelType is hybrid: petrol-electric or diesel-electric. */
  hybridFrom?: HybridFrom;
  /** Side view. When omitted, the name and model pick one. */
  body?: VehicleBody;
  initialOdometer: number;
  serviceIntervalKm: number;
  insuranceExpiry?: string; // YYYY-MM-DD
  pucExpiry?: string;
  createdAt: string;
};

export type FuelEntry = {
  id: string;
  vehicleId: string;
  date: string;
  odometer: number;
  litres: number;
  price: number;
  total: number;
  note?: string;
};

export type ServiceKind = "general" | "oil" | "tyre" | "battery" | "brakes" | "repair" | "other";

export type ServiceEntry = {
  id: string;
  vehicleId: string;
  date: string;
  odometer: number;
  kind: ServiceKind;
  cost: number;
  details: Record<string, string>;
  note?: string;
};

export type Txn = {
  id: string;
  type: "expense" | "income";
  amount: number;
  category: string;
  date: string;
  note?: string;
  /** Word-list group inside the category, such as Carrot under Groceries. */
  item?: string;
  photo?: string;
  origAmount?: number;
  origCurrency?: string;
  /** Cash you entered yourself. It counts as spending. */
  cash?: boolean;
  /** A move between your own accounts. It is not spending. */
  transfer?: boolean;
  /** A balance line from a bank text, used as a point on the balance chart. */
  balance?: number;
};

export type Subscription = {
  id: string;
  name: string;
  amount: number;
  cycle: "weekly" | "monthly" | "quarterly" | "yearly";
  nextRenewal: string;
  category: string;
  active: boolean;
};

export type Link = { id: string; from: Ref; to: Ref; rel: string; createdAt: string };

export type Budget = { monthly: number; categories: Record<string, number> };

export type AttentionMark = { status: "done" | "dismissed" | "snoozed"; until?: string };

export type ModuleId = "vehicles" | "money" | "travel" | "home" | "tools" | "rules" | "notes" | "dev" | "builder" | "media" | "lab" | "papers" | "kanban" | "wiki" | "net" | "cycle";
export type ModuleState = { id: ModuleId; enabled: boolean; hidden: boolean };
export type TileId = "attention" | "weather" | "trip" | "budget" | "vehicle" | "home" | "subscriptions" | "tools" | "notes";
export type Board = { id: string; name: string; icon: string; tiles: TileId[] };
export type HomePresetId = "custom" | "money" | "travel" | "home" | "desk" | "workshop" | "adhd";
export type AdhdKind = "money" | "trip" | "log";
export type AdhdTask = {
  id: string;
  line: string;
  started: boolean;
  parked: boolean;
  kind: AdhdKind;
  recordId: string;
  field: string;
  seed: string;
  draft: string;
  timerStartedAt: number;
};
export type AdhdSettings = {
  tasks: AdhdTask[];
  /** Finished tasks only. One plain line each. */
  finished: { line: string }[];
  reminder: { line: string; snoozedUntil?: string };
  motionOn: boolean;
  /** Off until the user turns it on. */
  buddyOn: boolean;
  kindMs: Record<AdhdKind, number>;
};
export type HeadsUpChoice = "Yes" | "No";
export type HeadsUpState = { dismissed: string[]; answers: { id: string; choice: HeadsUpChoice }[] };
export type ThemeKey = "system" | "midnight" | "amoled" | "graphite" | "dune" | "paper";
/** A visual look. Color sets stay on `theme`. Current matches the original app. */
export type LookId = "current" | "soft" | "tight" | "plain" | "cards" | "ink" | "signal" | "poster";
/** Sits on a look. Stack is the current rows. Glass frosts cards. Bento uses a few big tiles. */
export type LayoutId = "stack" | "glass" | "bento";
export type CloudProvider = "off" | "drive" | "onedrive";
export type CloudSync = { provider: CloudProvider; lastSyncAt?: string; askedSinceUnlock: boolean; unlockedAt?: string };
export type SmsMemoryRow = { key: string; choice: "category" | "transfer" | "ignore"; category?: string };
export type IconFamily = "paper" | "metal" | "glass" | "tiles";
export type IconVariant = "paper" | "midnight" | "dune" | "amoled";
/** `match` follows the app theme. The other values are a fixed picture. */
export type LauncherChoice = { family: IconFamily; variant: IconVariant | "match" };

/** Visual automation: "when <trigger> then <actions>". Evaluated locally, never in the cloud. */
export type RuleTriggerKind = "renewal" | "expiry" | "tripStart" | "maintenance" | "serviceKm" | "budgetPct" | "bigExpense";
export type RuleAction = "attention" | "notify";
export type Rule = {
  id: string;
  name: string;
  trigger: { kind: RuleTriggerKind; value: number };
  actions: RuleAction[];
  enabled: boolean;
  createdAt: string;
};

export type Settings = {
  onboarded: boolean;
  currency: string;
  distanceUnit: "km" | "mi";
  volumeUnit: "L" | "gal";
  tempUnit: "C" | "F";
  timeFormat: "12h" | "24h";
  theme: ThemeKey;
  /** Shape, space, type, cards, and pop. Independent of the color set. */
  look: LookId;
  /** Glass or Bento on top of the look. Stack keeps the current rows. */
  layout: LayoutId;
  /** Background keeps the color set. Type, buttons, and marks use a second color. */
  dualTone: boolean;
  online: boolean;
  homeCity?: Place;
  locationAsked: boolean;
  locationGranted: boolean;
  locationRead?: { lat: number; lon: number };
  accent: string;
  density: "comfortable" | "dense";
  privacyMode: boolean;
  lockEnabled: boolean;
  unlockMethod: "pin" | "biometric" | "both";
  biometricEnabled: boolean;
  lockTimeoutSec: number;
  moduleLocks: ModuleId[];
  clipboardAutoClear: boolean;
  blockScreenshots: boolean;
  autoLinkExpenses: boolean;
  defaultVehicleId?: string;
  modules: ModuleState[];
  tiles: { id: TileId; enabled: boolean }[];
  boards: Board[];
  activeBoardId?: string;
  remindersEnabled: boolean;
  highContrast: boolean;
  largeTouch: boolean;
  reducedMotion: boolean;
  quietHours: { enabled: boolean; from: number; to: number };
  /** ISO time of the last backup file this device wrote. */
  lastBackupAt?: string;
  /** The one-time backup reminder has been dismissed or satisfied. */
  backupNudged?: boolean;
  /** Lock-screen card. Empty fields stay hidden. The plate comes from the default vehicle. */
  emergency: { bloodGroup: string; contactName: string; contactPhone: string; note: string; showOnLock: boolean };
  /** Long-press shortcuts on the Android icon. At most four. */
  shortcuts: HomeShortcut[];
  /** What the greeting calls you. Lives in this document, never in the profile index. */
  givenName?: string;
  /** The one-time "what should I call you?" prompt has already been shown. */
  nameAsked: boolean;
  /** Home-screen picture. Paper press on the paper ground is the default. */
  launcher: LauncherChoice;
  /** Locked-file copy to Drive or OneDrive. Off until chosen. */
  cloud: CloudSync;
  /** Bank texts may be read on this phone. Off until chosen. */
  smsInbox: boolean;
  /** Reminders and the emergency card may show on the lock screen. */
  lockAlerts: boolean;
  /** Categories you named. Unused ones can be removed. */
  moneyNames: string[];
  /** One answer for an unknown sender, a category, or an own-account transfer. */
  smsMemory: SmsMemoryRow[];
  /** Endings of your own accounts, so a transfer is not treated as spending. */
  ownAccounts: string[];
  /** This phone's id. A file from another phone opens read-only. */
  installId: string;
  /** A file from another phone. Looking is allowed. Editing is not. */
  readOnly: boolean;
  /** Which home arrangement is on screen. Records stay where they are. */
  homePreset: HomePresetId;
  /** One next action, typed text, and finished lines. No scores. */
  adhd: AdhdSettings;
  /** Last thing opened in each preset. */
  presetLast: Partial<Record<HomePresetId, string>>;
  /** Heads-ups already dismissed or answered. Dismissal is not a miss. */
  headsUp: HeadsUpState;
  /** Rows added by sample data. Removal uses this list and leaves everything else. */
  sampleIds: string[];
  /** Budget from before sample data replaced it. */
  sampleBudget?: Budget;
};

export type HomeShortcut = { id: string; label: string; url: string };

export type KanbanColumn = { id: string; name: string; order: number };
export type KanbanCard = { id: string; columnId: string; title: string; note?: string; order: number };
export type KanbanBoard = { id: string; name: string; columns: KanbanColumn[]; cards: KanbanCard[]; createdAt: string };

export type WikiPage = { id: string; title: string; body: string; createdAt: string; updatedAt: string };

export type PackingTemplate = { id: string; name: string; groups: { category: string; items: string[] }[] };

export type ToolHistoryItem = { id: string; tool: string; label: string; value: string; at: string };

/** One logged day. Prediction math may change later; these fields are the record. */
export type CycleBleeding = "flow" | "spotting";
export type CycleFlow = "light" | "medium" | "heavy";
export type CycleSymptom = "cramps" | "low-energy" | "headache" | "bloating" | "backache" | "tender";
export type CycleProduct = "pad" | "tampon" | "cup";
export type CycleDay = {
  id: string;
  date: string;
  bleeding?: CycleBleeding;
  /** Ended was tapped on this day. Spotting never carries this. */
  ended?: boolean;
  flow?: CycleFlow;
  symptom?: CycleSymptom;
};
export type CycleStash = { kind: CycleProduct; count: number | null; lowAt: number };
export type CycleState = {
  days: CycleDay[];
  buddyName: string;
  buddyEmoji: string;
  periodNudge: boolean;
  changeNudge: boolean;
  changeKind: CycleProduct;
  changeHours: number;
  changeEndsAt?: string;
  paused: boolean;
  packedFor?: string;
  absorbencySeenFor?: string;
  stash: CycleStash[];
};

/** Custom tool builder: a few inputs, one safe formula, one result. */
export type CustomToolInput = { id: string; label: string; key: string; unit?: string; value: string };
export type CustomTool = { id: string; name: string; icon: string; inputs: CustomToolInput[]; formula: string; outputLabel: string; unit?: string; decimals: number; sendToMoney: boolean; createdAt: string };

/** Money planning entities. */
export type Fund = { id: string; name: string; target: number; targetDate?: string; contributions: { id: string; amount: number; date: string }[]; createdAt: string };
export type Debt = { id: string; name: string; principal: number; balance: number; ratePct: number; emi?: number; createdAt: string };
export type NetWorthSnapshot = { id: string; date: string; assets: number; liabilities: number; note?: string };

export type DB = {
  version: 1;
  settings: Settings;
  vehicles: Vehicle[];
  fuel: FuelEntry[];
  services: ServiceEntry[];
  txns: Txn[];
  subscriptions: Subscription[];
  links: Link[];
  trips: Trip[];
  appliances: Appliance[];
  utilities: UtilityBill[];
  chores: Chore[];
  notes: Note[];
  rules: Rule[];
  ruleFires: Record<string, string>;
  customTools: CustomTool[];
  media: MediaItem[];
  funds: Fund[];
  debts: Debt[];
  netWorth: NetWorthSnapshot[];
  people: Person[];
  papers: Paper[];
  parts: WearPart[];
  specs: HomeSpec[];
  kanban: KanbanBoard[];
  wiki: WikiPage[];
  templates: PackingTemplate[];
  netlog: NetLogEntry[];
  budget: Budget;
  attention: Record<string, AttentionMark>;
  toolHistory: ToolHistoryItem[];
  recents: Record<string, string>;
  cycle: CycleState;
};
