/**
 * Nucleus shared data model.
 * Every record is an "entity" of a known kind; cross-module relationships live in `links`.
 */
export type EntityKind = "vehicle" | "fuel" | "service" | "txn" | "subscription" | "trip" | "appliance";

export type PackItem = { id: string; name: string; category: string; done: boolean };
export type ItineraryItem = { id: string; date: string; time: string; title: string; place?: string; note?: string };
export type TripDoc = { id: string; name: string; have: boolean; expiry?: string };
export type Place = { name: string; lat: number; lon: number; country?: string; countryCode?: string };
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
export type Ref = { kind: EntityKind; id: string };

export type Vehicle = {
  id: string;
  name: string;
  type: "car" | "bike" | "other";
  make?: string;
  model?: string;
  plate?: string;
  fuelType: "petrol" | "diesel" | "cng" | "electric" | "other";
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
  origAmount?: number;
  origCurrency?: string;
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

export type ModuleId = "vehicles" | "money" | "travel" | "home" | "tools";
export type ModuleState = { id: ModuleId; enabled: boolean; hidden: boolean };
export type TileId = "attention" | "weather" | "trip" | "budget" | "vehicle" | "home" | "subscriptions" | "tools";
export type ThemeKey = "system" | "midnight" | "amoled" | "graphite" | "dune" | "paper";

export type Settings = {
  onboarded: boolean;
  currency: string;
  distanceUnit: "km" | "mi";
  volumeUnit: "L" | "gal";
  tempUnit: "C" | "F";
  timeFormat: "12h" | "24h";
  theme: ThemeKey;
  online: boolean;
  homeCity?: Place;
  accent: string;
  density: "comfortable" | "dense";
  privacyMode: boolean;
  lockEnabled: boolean;
  biometricEnabled: boolean;
  lockTimeoutSec: number;
  blockScreenshots: boolean;
  autoLinkExpenses: boolean;
  defaultVehicleId?: string;
  modules: ModuleState[];
  tiles: { id: TileId; enabled: boolean }[];
};

export type ToolHistoryItem = { id: string; tool: string; label: string; value: string; at: string };

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
  netlog: NetLogEntry[];
  budget: Budget;
  attention: Record<string, AttentionMark>;
  toolHistory: ToolHistoryItem[];
  recents: Record<string, string>;
};
