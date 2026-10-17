import type { DB, ModuleId } from "./types";

/** One entry in the top-left menu. `module` gates it; entries without a module are always shown. */
export type MenuLink = { id: string; label: string; icon: string; route: string; module?: ModuleId };
export type MenuSection = { id: string; title: string; links: MenuLink[] };

/**
 * v0.12 menu sections: the approved nine groups —
 * Money · Vehicle · Home · Life · Health (+Cycle) · Travel · Media ·
 * Documents & Notes · Tools. Wiki is gone; its link left with it.
 */
export const MENU_SECTIONS: MenuSection[] = [
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
  { id: "vehicle", title: "Vehicle", links: [{ id: "vehicles", label: "Vehicles", icon: "car-side", route: "/vehicles", module: "vehicles" }] },
  { id: "home", title: "Home", links: [{ id: "home", label: "Home", icon: "home-outline", route: "/home", module: "home" }] },
  { id: "life", title: "Life", links: [{ id: "reminders", label: "Reminders", icon: "bell-ring-outline", route: "/reminders" }] },
  {
    id: "health",
    title: "Health",
    links: [
      { id: "water", label: "Water", icon: "cup-water", route: "/health", module: "health" },
      { id: "medicines", label: "Medicines", icon: "pill", route: "/health/medicines", module: "health" },
      { id: "cycle", label: "Cycle", icon: "calendar-blank-outline", route: "/cycle", module: "cycle" },
    ],
  },
  { id: "travel", title: "Travel", links: [{ id: "travel", label: "Travel", icon: "bag-suitcase-outline", route: "/travel", module: "travel" }] },
  { id: "media", title: "Media", links: [{ id: "media", label: "Media", icon: "filmstrip-box-multiple", route: "/media", module: "media" }] },
  {
    id: "docnotes",
    title: "Documents & Notes",
    links: [
      { id: "papers", label: "Documents", icon: "file-document-outline", route: "/papers", module: "papers" },
      { id: "notes", label: "Notes and lists", icon: "note-text-outline", route: "/notes", module: "notes" },
      { id: "kanban", label: "Boards", icon: "view-column-outline", route: "/kanban", module: "kanban" },
    ],
  },
  {
    id: "tools",
    title: "Tools",
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
 * Sections for this file: modules that are off are left out (their data stays),
 * a section with nothing left is hidden, and sections follow the order set in
 * Settings → Modules. A module-less section (Life) hangs just after the last
 * module section above it, so it keeps its designed seat when nothing moves.
 */
export function menuSections(db: DB, allowed: (id: ModuleId) => boolean = () => true): MenuSection[] {
  const order = db.settings.modules.map((m) => m.id);
  const on = (id: ModuleId) => db.settings.modules.find((m) => m.id === id)?.enabled === true && allowed(id);
  const shown = MENU_SECTIONS.map((section) => ({ ...section, links: section.links.filter((l) => !l.module || on(l.module)) })).filter((s) => s.links.length > 0);
  const rank = (s: MenuSection) => {
    const idx = s.links.filter((l) => l.module).map((l) => order.indexOf(l.module as ModuleId)).filter((i) => i >= 0);
    return idx.length ? Math.min(...idx) : NaN;
  };
  let prev = 0;
  const withRank = shown.map((s, i) => {
    const r = rank(s);
    const anchored = Number.isFinite(r) ? r : prev + 0.5;
    if (Number.isFinite(r)) prev = r;
    return { s, r: anchored, i };
  });
  return withRank.sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.s);
}
