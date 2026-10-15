import type { ModuleId, Settings } from "./types";

/**
 * The cards the Favourites landing can show. Attention and the next reminder
 * are app-wide; budget, spend, and service belong to a module.
 */
export type FavoriteCardId = "attention" | "reminder" | "budget" | "spend" | "service";

const CARDS: { id: FavoriteCardId; module?: ModuleId }[] = [
  { id: "attention" },
  { id: "reminder" },
  { id: "budget", module: "money" },
  { id: "spend", module: "money" },
  { id: "service", module: "vehicles" },
];

const isOn = (settings: Pick<Settings, "modules">, id: ModuleId) => settings.modules.find((m) => m.id === id)?.enabled === true;

/**
 * Cards for the landing, in order. Cards of modules that are off drop out;
 * a single-module shell (`only`) keeps only that module's cards.
 */
export function favoriteCards(settings: Pick<Settings, "modules">, only: ModuleId | null = null): FavoriteCardId[] {
  return CARDS.filter((card) => {
    if (only && card.module && card.module !== only) return false;
    if (card.module && !isOn(settings, card.module)) return false;
    return true;
  }).map((card) => card.id);
}
