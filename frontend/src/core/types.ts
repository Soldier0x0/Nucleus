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
export type TransitKind = "metro" | "train" | "cab" | "bus" | "flight";
export type TripKind = "journey" | "transit";
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
  weatherReminded?: boolean;
  mode?: TripMode;
  transit?: TransitKind;
  /** Journey cards carry a checklist, plan and expenses. Daily public travel stays a Money category only. */
  kind?: TripKind;
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
export type MotorCover = "comprehensive" | "third-party";
export type PaperKind = "licence" | "registration" | "insurance" | "passport" | "fastag" | "warranty" | "puc" | "personal_accident" | "other";
/** One vault, many sections: the same paper can sit under more than one tag. */
export type PaperTag = "Vehicle" | "Health" | "Money" | "Home" | "Travel" | "Other";
export type Paper = {
  id: string;
  /** Kept for the motor XOR, PUC and PA helpers. Sections come from tags. */
  kind: PaperKind;
  /** Sections this paper shows in. Absent on old records; derived from kind on load. */
  tags?: PaperTag[];
  title: string;
  number?: string;
  expiry?: string;
  note?: string;
  /** Legacy image attachment (data URI). */
  photo?: string;
  /** Local file URI or data URI for an image or PDF. */
  file?: string;
  mime?: string;
  /** Motor policy only: comprehensive XOR third-party. */
  motorCover?: MotorCover;
  /** Roadside assistance on the motor policy. */
  rsaAddOn?: boolean;
  /** Zero depreciation add-on on the motor policy. */
  zeroDepAddOn?: boolean;
  insurer?: string;
  personId?: string;
  vehicleId?: string;
  createdAt: string;
};
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
  tankLitres?: number;
  /** Usable tank learned from level-chip fills. Beats machine tankLitres when known. */
  usableTank?: number;
  /** Gallery cover image (data URI or local file). */
  cover?: string;
  insuranceExpiry?: string; // YYYY-MM-DD
  pucExpiry?: string;
  /** Coolant only shows for liquid-cooled engines. Default: car liquid, others air. */
  cooling?: "air" | "liquid";
  /** Used for month-based service due dates when a part was never serviced. */
  purchaseDate?: string;
  /** Per-part service intervals. Missing means defaults by type (serviceCatalog.ts). */
  parts?: import("./serviceCatalog").PartSetting[];
  /** Saved ride-checklist template. Missing means defaults by type (rideChecklists.ts). */
  rideChecklist?: string[];
  createdAt: string;
};

/** A fuel station the person tagged or picked. Fetched OSM ones live in the net cache; only these stay in the records. */
export type Station = {
  id: string;
  name: string;
  brand?: string;
  lat: number;
  lon: number;
  /** Company-owned pump marked by the person; OSM does not expose this. */
  coco?: boolean;
  favorite?: boolean;
};

export type FuelFillKind = "full" | "empty" | "partial";
/** Where the tank sat before a partial fill (Reserve coin etc.). Teaches the usable tank size. */
export type FuelLevel = "reserve" | "quarter" | "half" | "three-quarter";

export type FuelEntry = {
  id: string;
  vehicleId: string;
  date: string;
  /** When the fill was logged (ISO). Date-only rows omit this. */
  loggedAt?: string;
  /** To-brim, burned-to-empty, or a top-up. Older rows default to full in normalize. */
  fillKind?: FuelFillKind;
  /** Level chip for partial fills, where the tank sat before the pump ran. */
  levelChip?: FuelLevel;
  odometer: number;
  /** True until a typed reading replaces the estimate. */
  odometerEstimated?: boolean;
  station?: string;
  litres: number;
  price: number;
  total: number;
  photo?: string;
  note?: string;
};

export type OdometerLog = {
  id: string;
  vehicleId: string;
  /** Local calendar day, "YYYY-MM-DD" (a datetime also parses: consumers slice the first 10 chars). */
  at: string;
  odometer: number;
  note?: string;
};

export type VehicleJourney = {
  id: string;
  vehicleId: string;
  startAt: string;
  endAt?: string;
  startOdometer: number;
  endOdometer?: number;
  note?: string;
  /** Copy-on-use tick-off for this ride. Never shares items with the vehicle template. */
  checklist?: ChecklistItem[];
};

export type ServiceKind = "general" | "oil" | "tyre" | "battery" | "brakes" | "repair" | "other";

export type ServiceEntry = {
  id: string;
  vehicleId: string;
  date: string;
  odometer: number;
  kind: ServiceKind;
  /** Parts done in this visit. Older logs map from `kind`. */
  parts?: import("./serviceCatalog").PartId[];
  cost: number;
  details: Record<string, string>;
  note?: string;
  billFile?: string;
  billMime?: string;
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
  /** How the money moved, for the online-vs-in-person chart. A suggestion or a hand-picked tag. */
  channel?: TxnChannel;
  /** The journey card this expense belongs to. In addition to the "trip expense" link. */
  tripId?: string;
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

/** A deleted row, kept so a merge or sync does not bring it back. `kind` is the DB list it lived in. */
export type Tombstone = { kind: string; id: string; deletedAt: string };

/** A row as it was kept in the journal (before an edit, or before it was deleted). */
export type JournalRow = { id: string; [key: string]: unknown };

/** One change in this phone's own record of what happened: added, edited or deleted, with the rows. */
export type JournalEntry = { id: string; at: string; act: "add" | "edit" | "delete"; kind: string; recordId: string; before?: JournalRow; after?: JournalRow };

export type AttentionMark = { status: "done" | "dismissed" | "snoozed"; until?: string };

export type ModuleId = "vehicles" | "money" | "travel" | "home" | "tools" | "rules" | "notes" | "dev" | "builder" | "media" | "lab" | "papers" | "kanban" | "net" | "cycle" | "health";
export type ModuleState = { id: ModuleId; enabled: boolean; hidden: boolean };
export type TileId = "attention" | "weather" | "trip" | "budget" | "vehicle" | "home" | "subscriptions" | "tools" | "notes";
export type Board = { id: string; name: string; icon: string; tiles: TileId[] };
export type HomePresetId = "custom" | "money" | "vehicle" | "travel" | "home" | "health" | "documents" | "bills" | "desk" | "workshop";
export type HeadsUpChoice = "Yes" | "No";
export type HeadsUpState = { dismissed: string[]; answers: { id: string; choice: HeadsUpChoice }[] };
export type ThemeKey = "system" | "midnight" | "amoled" | "graphite" | "dune" | "paper" | "blush";
/** A visual look. Color sets stay on `theme`. Current matches the original app. */
export type LookId = "current" | "soft" | "tight" | "plain" | "cards" | "ink" | "signal" | "poster" | "blush";
  /** Sits on a look. Stack is the current rows. Glass frosts cards. Bento pairs short cards. */
export type LayoutId = "stack" | "glass" | "bento";
export type CloudProvider = "off" | "drive" | "onedrive";
export type CloudSync = { provider: CloudProvider; lastSyncAt?: string; askedSinceUnlock: boolean; unlockedAt?: string };
/** A desktop paired over the LAN. `key` is the peer's X25519 public key (base64). */
export type PairedDevice = { id: string; name: string; key: string; lastSyncAt: string; pubKey?: string };
export type SmsMemoryRow = { key: string; choice: "category" | "transfer" | "ignore"; category?: string };

/** Where a spend happened. Online-food and online-grocery are apps; everything else is in person. */
export type TxnChannel = "online_food" | "online_grocery" | "in_person";
/** A correction the person made for one merchant. It beats the built-in table. */
export type TxnChannelOverride = { key: string; channel: TxnChannel };
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
  /** True after this phone picked a color, look, or layout, or after the v0.7.1 default was applied. */
  appearanceChosen: boolean;
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
  /** Long-press size for one tile. An unset tile keeps the size its board already uses. */
  tileSizes: Record<string, "large" | "small">;
  /** Order saved by holding a tile on Desk or Workshop. */
  tileOrder: Partial<Record<HomePresetId, string[]>>;
  boards: Board[];
  activeBoardId?: string;
  remindersEnabled: boolean;
  highContrast: boolean;
  largeTouch: boolean;
  reducedMotion: boolean;
  quietHours: { enabled: boolean; from: number; to: number };
  /** ISO time of the last backup file this device wrote. */
  lastBackupAt?: string;
  /** Last completed sync with a paired desktop. Set by the sync flow (desktop plan D2). */
  lastSyncAt?: string;
  /** The one-time backup reminder has been dismissed or satisfied. */
  backupNudged?: boolean;
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
  /** The person asked for bank texts. Access is checked again when they come back. */
  bankTextsAsked: boolean;
  /** The person turned bank texts off. Root auto-on then leaves the switch alone. */
  bankTextsOff: boolean;
  /** POST_NOTIFICATIONS denied warning already shown once. */
  postNotificationsWarned: boolean;
  /** Reminders may show on the lock screen. */
  lockAlerts: boolean;
  /** Categories you named. Unused ones can be removed. */
  moneyNames: string[];
  /** One answer for an unknown sender, a category, or an own-account transfer. */
  smsMemory: SmsMemoryRow[];
  /** Endings of your own accounts, so a transfer is not treated as spending. */
  ownAccounts: string[];
  /** v0.9.8: merchant-to-channel answers the person picked. They win over the built-in table. */
  merchantOverrides: TxnChannelOverride[];
  /** v0.9.8: the travel module was folded into Money once at load. The person may turn it back on. */
  travelFolded: boolean;
  /** v0.12: the drawer regrouped once into nine sections; later reorders stick. */
  menuRegrouped: boolean;
  /** This phone's id. A file from another phone opens read-only. */
  installId: string;
  /** Desktops paired to this device. Device-only: never merged during sync. */
  pairedDevices: PairedDevice[];
  /** A file from another phone. Looking is allowed. Editing is not. */
  readOnly: boolean;
  /** v0.9.8: single-module shell. Unset keeps it on; false turns it off. */
  nativeModuleShell?: boolean;
  /** Which home arrangement is on screen. Records stay where they are. */
  homePreset: HomePresetId;
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

export type PackingTemplate = { id: string; name: string; groups: { category: string; items: string[] }[] };

export type ToolHistoryItem = { id: string; tool: string; label: string; value: string; at: string };

/** One logged day. Prediction math may change later; these fields are the record. */
export type CycleBleeding = "flow" | "spotting";
export type CycleFlow = "light" | "medium" | "heavy";
export type CycleSymptom = "cramps" | "low-energy" | "headache" | "bloating" | "backache" | "tender";
export type CycleProduct = "pad" | "liner" | "tampon" | "cup" | "disc" | "underwear";
export type CycleDay = {
  id: string;
  date: string;
  bleeding?: CycleBleeding;
  /** Ended was tapped on this day. Spotting never carries this. */
  ended?: boolean;
  flow?: CycleFlow;
  symptom?: CycleSymptom;
  /** Extra chips, including a name the person added. The first known chip can also sit on `symptom`. */
  symptoms?: string[];
};
export type CycleReportName = "private" | "normal";
export type CycleStash = { kind: CycleProduct; count: number | null; carry: number | null; lowAt: number; pack: number };
export type CycleState = {
  days: CycleDay[];
  buddyName: string;
  buddyEmoji: string;
  /** First-open buddy card has been saved or skipped. */
  buddyIntroSeen?: boolean;
  /** A short note she can edit. Cycle still runs with this empty. */
  buddyNote?: string;
  periodNudge: boolean;
  changeNudge: boolean;
  changeKind: CycleProduct;
  changeHours: number;
  changeEndsAt?: string;
  /** One reminder an hour under the safe maximum, when the timer is set that long. */
  changeRematchAt?: string;
  paused: boolean;
  packedFor?: string;
  absorbencySeenFor?: string;
  stash: CycleStash[];
  customSymptoms: string[];
  /** Private initials unless the person chooses the full name. */
  reportName: CycleReportName;
  /** Soft pink on the cycle calendar and on cycle reminders only. */
  pinkCalendar: boolean;
};
/** v0.9.8: a reminder you set yourself, optionally attached to a record. */
export type ReminderAttachKind = "plain" | "paper" | "subscription" | "medicine" | "vehicle";
export type PlainReminder = {
  id: string;
  title: string;
  note?: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, 24-hour */
  time: string;
  /** ISO datetime. While set and in the future, the reminder fires then instead. */
  snoozeUntil?: string;
  done?: boolean;
  attach: { kind: ReminderAttachKind; id?: string };
  createdAt: string;
  updatedAt?: string;
};
export type MedicineLog = { at: string; time: string; status: "taken" | "skipped" };
export type Medicine = {
  id: string;
  name: string;
  /** Daily times. At least one. */
  times: { hour: number; minute: number }[];
  dose?: string;
  notes?: string;
  active: boolean;
  log: MedicineLog[];
  createdAt: string;
  updatedAt?: string;
};
export type WaterTime = { id: string; hour: number; minute: number };
export type WaterState = { times: WaterTime[] };

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
  odometerLogs: OdometerLog[];
  vehicleJourneys: VehicleJourney[];
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
  stations: Station[];
  parts: WearPart[];
  specs: HomeSpec[];
  kanban: KanbanBoard[];
  templates: PackingTemplate[];
  netlog: NetLogEntry[];
  budget: Budget;
  attention: Record<string, AttentionMark>;
  toolHistory: ToolHistoryItem[];
  recents: Record<string, string>;
  cycle: CycleState;
  water: WaterState;
  reminders: PlainReminder[];
  medicines: Medicine[];
  tombstones: Tombstone[];
  journal: JournalEntry[];
};
