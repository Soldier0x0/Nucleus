import { visibleAttention } from "./attention";
import { money, monthKey, todayISO } from "./format";
import { homeCard, type HomeForecast } from "./homeCards";
import type { AttentionItem } from "./intelligence";
import { monthFlow } from "./moneyDesk";
import { defaultTileSize } from "./presets";
import type { DB } from "./types";

export type HomeWeather = HomeForecast & { feels?: number; wind?: number; aqi?: number };

export type HomeFace = {
  eyebrow: string;
  figure: string;
  detail: string;
  icon: string;
  route: string;
  wide: boolean;
  counts?: { urgent: number; upcoming: number; info: number };
  lines: { icon: string; title: string }[];
  meter?: number;
};

function tally(items: AttentionItem[]): { urgent: number; upcoming: number; info: number } {
  const counts = { urgent: 0, upcoming: 0, info: 0 };
  for (const item of items) {
    switch (item.severity) {
      case "urgent":
        counts.urgent += 1;
        break;
      case "upcoming":
        counts.upcoming += 1;
        break;
      case "info":
        counts.info += 1;
        break;
      default: {
        const unreachable: never = item.severity;
        void unreachable;
      }
    }
  }
  return counts;
}

function cityName(db: DB): string {
  return db.settings.homeCity?.name.split(",")[0]?.trim() ?? "";
}

/** The earlier card: a small label, a large figure, and the lines that belong with it. */
export function homeFace(db: DB, id: string, forecast?: HomeWeather | null): HomeFace {
  const card = homeCard(db, id, forecast ?? null);
  const wide = defaultTileSize(id) === "large";
  const base = { icon: card.icon, route: card.route, wide, lines: [] as HomeFace["lines"] };
  switch (id) {
    case "attention": {
      const items = visibleAttention(db);
      const counts = tally(items);
      const needs = counts.urgent + counts.upcoming;
      return {
        ...base,
        eyebrow: "Attention",
        figure: String(needs),
        detail: needs === 0 ? "All caught up" : (items.find((item) => item.severity !== "info")?.title ?? "All caught up"),
        counts,
        wide: true,
        lines: items.slice(0, 3).map((item) => ({ icon: item.icon, title: item.title })),
      };
    }
    case "weather": {
      const city = cityName(db);
      const feels = forecast?.feels != null ? ` · feels ${Math.round(forecast.feels)}°` : "";
      return {
        ...base,
        eyebrow: city ? `Weather · ${city}` : "Weather",
        figure: forecast ? `${Math.round(forecast.temp)}°` : "—",
        detail: forecast ? `${forecast.label}${feels}` : city ? "Forecast" : "No city saved",
        wide: true,
      };
    }
    case "budget": {
      const flow = monthFlow(db.txns, monthKey(todayISO()));
      const cap = db.budget.monthly;
      return {
        ...base,
        eyebrow: "Money · this month",
        figure: money(flow.out, db.settings.currency),
        detail: cap > 0 ? money(cap, db.settings.currency) : "",
        meter: cap > 0 ? Math.min(1, flow.out / cap) : 0,
        wide: true,
      };
    }
    default:
      return {
        ...base,
        eyebrow: card.title,
        figure: card.lines[0] ?? "",
        detail: card.lines[1] ?? "",
      };
  }
}
