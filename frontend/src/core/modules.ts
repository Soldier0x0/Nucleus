/**
 * Module registry. Each module is a manifest: what it stores, what it emits/consumes,
 * which Today tiles it provides and what capabilities it needs. The core reads manifests;
 * modules never import each other.
 */
export type ModuleManifest = {
  id: string;
  name: string;
  icon: string;
  route?: string;
  description: string;
  entities: string[];
  emits: string[];
  consumes: string[];
  capabilities: string[];
  status: "available" | "planned";
  phase?: number;
};

export const MODULES: ModuleManifest[] = [
  {
    id: "vehicles",
    name: "Vehicles",
    icon: "car-side",
    route: "/vehicles",
    description: "Fuel, mileage, service intervals, insurance and PUC.",
    entities: ["vehicle", "fuel", "service"],
    emits: ["fuel.added", "service.added", "insurance.expiring", "service.due"],
    consumes: [],
    capabilities: ["storage.local", "attention.publish"],
    status: "available",
  },
  {
    id: "money",
    name: "Money",
    icon: "wallet-outline",
    route: "/money",
    description: "Expenses, budgets, subscriptions and spending patterns.",
    entities: ["txn", "subscription", "budget"],
    emits: ["expense.created", "budget.threshold", "subscription.renewing"],
    consumes: ["fuel.added", "service.added", "tool.emi.result"],
    capabilities: ["storage.local", "storage.sensitive", "attention.publish"],
    status: "available",
  },
  {
    id: "tools",
    name: "Quick Tools",
    icon: "calculator-variant-outline",
    route: "/tools",
    description: "Units, percentage & GST, bill split, dates and EMI.",
    entities: ["tool.history"],
    emits: ["tool.emi.result"],
    consumes: [],
    capabilities: ["clipboard.write"],
    status: "available",
  },
  { id: "travel", name: "Travel", icon: "bag-suitcase-outline", route: "/travel", description: "Trips, packing templates, itinerary, documents, trip expenses.", entities: ["trip"], emits: ["trip.starting"], consumes: [], capabilities: ["storage.local", "attention.publish", "network.optional"], status: "available" },
  { id: "home", name: "Home", icon: "home-outline", route: "/home", description: "Appliances, warranties and maintenance plans.", entities: ["appliance"], emits: ["warranty.expiring", "maintenance.due"], consumes: [], capabilities: ["storage.local", "attention.publish"], status: "available" },
  { id: "notes", name: "Notes & Lists", icon: "note-text-outline", route: "/notes", description: "Notes and checklists you can attach to any record.", entities: ["note"], emits: [], consumes: [], capabilities: ["storage.local"], status: "available" },
  { id: "rules", name: "Rules", icon: "source-branch", route: "/rules", description: "Visual When / Then automations with local reminders.", entities: [], emits: [], consumes: ["renewal", "expiry", "trip.start", "maintenance.due", "budget.threshold"], capabilities: ["notifications.local", "attention.publish"], status: "available" },
  { id: "dev", name: "Dev Tools", icon: "code-braces", route: "/dev", description: "JSON, Base64, URL, JWT, hashes, timestamps, regex, diff, colour.", entities: [], emits: [], consumes: [], capabilities: ["clipboard.write"], status: "available" },
  { id: "builder", name: "Tool Builder", icon: "puzzle-outline", route: "/builder", description: "Make your own calculators from inputs and a formula.", entities: ["tool.custom"], emits: [], consumes: [], capabilities: ["storage.local"], status: "available" },
  { id: "lab", name: "Phone Lab", icon: "chip", route: "/lab", description: "Sensors, battery, display and touch tests — live only while open.", entities: [], emits: [], consumes: [], capabilities: ["sensors.read"], status: "available" },
  { id: "media", name: "Media shelf", icon: "filmstrip-box-multiple", route: "/media", description: "Movies, series, books and games — progress, ratings and reviews.", entities: ["media"], emits: [], consumes: [], capabilities: ["storage.local"], status: "available" },
];

export const moduleById = (id: string) => MODULES.find((m) => m.id === id)!;

export const TILE_META: Record<string, { name: string; module?: string; icon: string }> = {
  attention: { name: "Attention summary", icon: "bell-outline" },
  weather: { name: "Weather (Online)", icon: "weather-partly-cloudy" },
  trip: { name: "Next trip", module: "travel", icon: "bag-suitcase-outline" },
  home: { name: "Home maintenance", module: "home", icon: "home-outline" },
  budget: { name: "Budget ring", module: "money", icon: "chart-donut" },
  vehicle: { name: "Vehicle gauge", module: "vehicles", icon: "speedometer" },
  subscriptions: { name: "Next renewals", module: "money", icon: "autorenew" },
  notes: { name: "Pinned notes", module: "notes", icon: "note-text-outline" },
  tools: { name: "Quick tools", module: "tools", icon: "calculator-variant-outline" },
};
