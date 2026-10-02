/**
 * Tessera shared data model.
 * Every record is an "entity" of a known kind; cross-module relationships live in `links`.
 */
export type EntityKind = "vehicle" | "fuel" | "service" | "txn" | "subscription";
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

export type ModuleId = "vehicles" | "money" | "tools";
export type ModuleState = { id: ModuleId; enabled: boolean; hidden: boolean };
export type TileId = "attention" | "budget" | "vehicle" | "subscriptions" | "tools";

export type Settings = {
  onboarded: boolean;
  currency: string;
  distanceUnit: "km" | "mi";
  volumeUnit: "L" | "gal";
  tempUnit: "C" | "F";
  timeFormat: "12h" | "24h";
  theme: "system" | "light" | "dark";
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
  budget: Budget;
  attention: Record<string, AttentionMark>;
  toolHistory: ToolHistoryItem[];
  recents: Record<string, string>;
};
