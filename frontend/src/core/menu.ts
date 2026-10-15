import type { DB, ModuleId } from "./types";

/** One entry in the top-left menu. `module` gates it; entries without a module are always shown. */
export type MenuLink = { id: string; label: string; icon: string; route: string; module?: ModuleId };
export type MenuSection = { id: string; title: string; links: MenuLink[] };

/**
 * v0.9.8 menu sections (plan 9.2). Notes, Kanban and Wiki stay three lists, shown as three views
 * under one Notes section (Q4). DevLab groups the tinkering modules.
 */
export const MENU_SECTIONS: MenuSection[] = [
  { id: "vehicle", title: "Vehicle", links: [{ id: "vehicles", label: "Vehicles", icon: "car-side", route: "/vehicles", module: "vehicles" }] },
  {
    id: "money",
    title: "Money",
    links: [
      { id: "money", label: "Money", icon: "wallet-outline", route: "/money", module: "money" },
      { id: "journeys", label: "Journeys", icon: "bag-suitcase-outline", route: "/travel", module: "money" },
      { id: "plan", label: "Plan and jars", icon: "piggy-bank-outline", route: "/money/plan", module: "money" },
      { id: "bills", label: "Bills", icon: "calendar-clock", route: "/bills", module: "money" },
    ],
  },
  {
    id: "health",
    title: "Health",
    links: [
      { id: "water", label: "Water", icon: "cup-water", route: "/health", module: "health" },
      { id: "medicines", label: "Medicines", icon: "pill", route: "/health/medicines", module: "health" },
      { id: "cycle", label: "Cycle", icon: "calendar-blank-outline", route: "/cycle", module: "cycle" },
    ],
  },
  { id: "documents", title: "Documents", links: [{ id: "papers", label: "Documents", icon: "file-document-outline", route: "/papers", module: "papers" }] },
  {
    id: "notes",
    title: "Notes",
    links: [
      { id: "notes", label: "Notes and lists", icon: "note-text-outline", route: "/notes", module: "notes" },
      { id: "kanban", label: "Boards", icon: "view-column-outline", route: "/kanban", module: "kanban" },
      { id: "wiki", label: "Wiki", icon: "book-open-variant", route: "/wiki", module: "wiki" },
    ],
  },
  { id: "reminders", title: "Reminders", links: [{ id: "reminders", label: "Reminders", icon: "bell-ring-outline", route: "/reminders" }] },
  {
    id: "life",
    title: "Life",
    links: [
      { id: "travel", label: "Travel", icon: "bag-suitcase-outline", route: "/travel", module: "travel" },
      { id: "home", label: "Home", icon: "home-outline", route: "/home", module: "home" },
      { id: "media", label: "Media", icon: "filmstrip-box-multiple", route: "/media", module: "media" },
    ],
  },
  {
    id: "devlab",
    title: "DevLab",
    links: [
      { id: "tools", label: "Tools", icon: "calculator-variant-outline", route: "/tools", module: "tools" },
      { id: "builder", label: "Tool Builder", icon: "puzzle-outline", route: "/builder", module: "builder" },
      { id: "rules", label: "Rules", icon: "source-branch", route: "/rules", module: "rules" },
      { id: "net", label: "Network", icon: "access-point-network", route: "/net", module: "net" },
      { id: "lab", label: "Phone Lab", icon: "chip", route: "/lab", module: "lab" },
      { id: "dev", label: "Dev Tools", icon: "code-braces", route: "/dev", module: "dev" },
    ],
  },
];

/**
 * Sections for this file: modules that are off are left out (their data stays), a section
 * with nothing left is hidden, and sections follow the order set in Settings → Modules.
 * Reminders has no module and sits after the module sections it follows in the list.
 */
export function menuSections(db: DB, allowed: (id: ModuleId) => boolean = () => true): MenuSection[] {
  const order = db.settings.modules.map((m) => m.id);
  const on = (id: ModuleId) => db.settings.modules.find((m) => m.id === id)?.enabled === true && allowed(id);
  const shown = MENU_SECTIONS.map((section) => ({ ...section, links: section.links.filter((l) => !l.module || on(l.module)) })).filter((s) => s.links.length > 0);
  const rank = (s: MenuSection, fallback: number) => {
    const idx = s.links.filter((l) => l.module).map((l) => order.indexOf(l.module as ModuleId)).filter((i) => i >= 0);
    return idx.length ? Math.min(...idx) : fallback;
  };
  const withRank = shown.map((s, i) => ({ s, r: rank(s, s.id === "reminders" ? 99 : 100 + i), i }));
  return withRank.sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.s);
}
