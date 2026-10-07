import { billCardCopy } from "./bills";
import { documentCardCopy } from "./documents";
import { money, monthKey, todayISO } from "./format";
import { attentionItems, vehicleStats } from "./intelligence";
import { vehicleOwnership } from "./life";
import { balanceOverTime, monthFlow, repeatingBills } from "./moneyDesk";
import { parseTransitTileId, publicTransitSpend, transitSpendLine } from "./travelSpend";
import { transitLabel } from "./transit";
import { costPerKmLine, lastFullFill, rangeAfterFullLine, serviceLeftLine } from "./vehicleMath";
import { paperForVehicleDocTile, vehicleDocTileLines, vehicleDocTileTitle, type VehicleDocTileId } from "./vehicleDocs";
import { lowStash } from "./cycle";
import { formatWaterTime } from "./water";
import type { DB } from "./types";

export type HomeForecast = { temp: number; label: string };

export type HomeCard = {
  title: string;
  icon: string;
  lines: string[];
  route: string;
};

const ICONS: Record<string, string> = {
  attention: "bell-outline",
  weather: "weather-partly-cloudy",
  trip: "bag-suitcase-outline",
  budget: "chart-donut",
  balance: "wallet-outline",
  spending: "cash-minus",
  charts: "chart-bar",
  receipts: "receipt",
  bills: "calendar-clock",
  subscriptions: "autorenew",
  funds: "piggy-bank-outline",
  debts: "credit-card-outline",
  categories: "tag-outline",
  networth: "scale-balance",
  route: "map-marker-path",
  mileage: "speedometer",
  fuel: "gas-station-outline",
  papers: "file-document-outline",
  vehicle: "motorbike",
  service: "wrench-outline",
  range: "map-marker-distance",
  stops: "map-marker-outline",
  packing: "bag-checked",
  heading: "compass-outline",
  costkm: "currency-inr",
  fueltank: "gas-station-outline",
  servleft: "wrench-clock",
  transitmetro: "train",
  transittrain: "train-variant",
  transitcab: "taxi",
  transitbus: "bus",
  water: "cup-water",
  cyclestash: "package-variant",
  "vdoc-motor": "shield-car",
  "vdoc-pa": "account-injury",
  "vdoc-puc": "smoke",
  "vdoc-rsa": "car-wrench",
  maintenance: "home-outline",
  chores: "checkbox-marked-outline",
  appliances: "washing-machine",
  notes: "note-text-outline",
  cycle: "calendar-heart",
  warranties: "shield-check-outline",
  utilities: "flash-outline",
  kanban: "view-column-outline",
  wiki: "book-open-variant",
  media: "image-outline",
  rules: "lightning-bolt-outline",
  tools: "calculator-variant-outline",
  history: "history",
  builder: "hammer-wrench",
  dev: "code-braces",
  lab: "flask-outline",
  net: "lan",
  home: "home-outline",
  docgaps: "file-document-alert-outline",
  docids: "card-account-details-outline",
  docinsurance: "shield-check-outline",
  doctrips: "bag-suitcase-outline",
  docfiles: "file-document-outline",
  billdue: "calendar-clock",
  rent: "home-outline",
  emi: "bank-outline",
  subs: "autorenew",
  billpaid: "check-circle-outline",
};

function card(title: string, id: string, lines: string[], route: string): HomeCard {
  return { title, icon: ICONS[id] ?? "square-outline", lines, route };
}

/** What a home card shows, and the screen that card opens. */
export function homeCard(db: DB, id: string, forecast?: HomeForecast | null): HomeCard {
  const cur = db.settings.currency;
  const today = todayISO();
  const month = monthKey(today);
  switch (id) {
    case "attention": {
      const items = attentionItems(db, today);
      const lines = items.length
        ? [`${items.length}`, ...items.slice(0, 3).map((item) => item.title)]
        : ["0", "All caught up"];
      return card("Attention", id, lines, "/(tabs)/attention");
    }
    case "weather": {
      const place = db.settings.homeCity;
      const lines = place
        ? [place.name, forecast ? `${Math.round(forecast.temp)}° ${forecast.label}` : "Forecast"]
        : ["No city saved"];
      return card("Weather", id, lines, "/(tabs)/settings?section=weather");
    }
    case "trip": {
      const trip = [...db.trips].sort((a, b) => a.start.localeCompare(b.start))[0];
      return card("Trip", id, trip ? [trip.name, trip.destination] : ["No trip yet"], trip ? `/travel/${trip.id}` : "/travel");
    }
    case "budget": {
      const flow = monthFlow(db.txns, month);
      return card("Budget", id, [money(flow.out, cur), money(db.budget.monthly, cur)], "/money?sheet=budget");
    }
    case "balance": {
      const points = balanceOverTime(db.txns);
      const last = points[points.length - 1];
      return card("Balance", id, [money(last?.balance ?? 0, cur)], "/money");
    }
    case "spending": {
      const flow = monthFlow(db.txns, month);
      return card("Spending", id, [money(flow.out, cur)], "/money");
    }
    case "charts": {
      const flow = monthFlow(db.txns, month);
      return card("Charts", id, [money(flow.in, cur), money(flow.out, cur)], "/money");
    }
    case "receipts":
      return card("Receipts", id, [String(db.txns.filter((row) => row.photo).length)], "/money");
    case "bills": {
      const bill = repeatingBills(db.txns)[0];
      return card("Bills", id, [bill ? `${bill.name} ${money(bill.amount, cur)}` : money(0, cur)], "/money?tab=subscriptions");
    }
    case "subscriptions":
      return card("Subscriptions", id, [String(db.subscriptions.filter((row) => row.active).length)], "/money?tab=subscriptions");
    case "funds":
      return card("Funds", id, [db.funds[0]?.name ?? String(db.funds.length)], "/money/plan");
    case "debts":
      return card("Debts", id, [db.debts[0]?.name ?? String(db.debts.length)], "/money/plan");
    case "categories":
      return card("Categories", id, [String(new Set(db.txns.map((row) => row.category)).size)], "/money");
    case "networth": {
      const last = db.netWorth[db.netWorth.length - 1];
      return card("Net worth", id, [last ? money(last.assets - last.liabilities, cur) : money(0, cur)], "/money/plan");
    }
    case "route": {
      const trip = [...db.trips].sort((a, b) => a.start.localeCompare(b.start))[0];
      return card("Route", id, trip ? [trip.name, trip.destination] : ["0"], trip ? `/travel/${trip.id}` : "/travel");
    }
    case "transitmetro":
    case "transittrain":
    case "transitcab":
    case "transitbus": {
      const kind = parseTransitTileId(id);
      if (!kind) return card("Transit", id, ["—"], "/travel");
      const month = monthKey(today);
      const line = transitSpendLine(db, month, kind);
      const total = publicTransitSpend(db, month, kind);
      return card(transitLabel(kind), id, [total > 0 ? money(total, cur) : line], "/money");
    }
    case "costkm": {
      const vehicle = db.vehicles[0];
      const own = vehicle ? vehicleOwnership(db, vehicle.id) : null;
      const line = own ? costPerKmLine(own.perKm, db.settings.distanceUnit) : null;
      return card("Cost / km", id, [line ?? "Log fuel and distance"], vehicle ? `/vehicles/${vehicle.id}` : "/vehicles");
    }
    case "fueltank": {
      const vehicle = db.vehicles[0];
      const route = vehicle ? `/vehicles/${vehicle.id}` : "/vehicles";
      return card("Last fill", id, ["Log a fill on Vehicle"], route);
    }
    case "servleft": {
      const vehicle = db.vehicles[0];
      const line = vehicle ? serviceLeftLine(vehicleStats(db, vehicle).service.remaining) : "No vehicle yet";
      return card("Service left", id, [line], vehicle ? `/vehicles/${vehicle.id}` : "/vehicles");
    }
    case "water": {
      const next = db.water.times[0];
      const lines = next ? [formatWaterTime(next.hour, next.minute, db.settings.timeFormat)] : ["No reminder yet"];
      return card("Water", id, lines, "/health");
    }
    case "cyclestash": {
      const lows = lowStash(db.cycle);
      return card("Stash", id, lows.length ? [`${lows.length} running low`] : ["Looks fine"], "/cycle/more");
    }
    case "vdoc-motor":
    case "vdoc-pa":
    case "vdoc-puc": {
      const vehicle = db.vehicles[0];
      const tile = id as VehicleDocTileId;
      const paper = vehicle ? paperForVehicleDocTile(db, vehicle.id, tile) : undefined;
      const lines = vehicle ? vehicleDocTileLines(db, vehicle.id, tile, today) : ["No vehicle"];
      const route = paper ? `/papers/view?id=${paper.id}` : "/papers";
      return card(vehicleDocTileTitle(tile), id, lines, route);
    }
    case "mileage": {
      const last = db.fuel[db.fuel.length - 1];
      const km = last?.odometer ?? db.vehicles[0]?.initialOdometer ?? 0;
      return card("Mileage", id, [`${km} km`], db.vehicles[0] ? `/vehicles/${db.vehicles[0].id}` : "/vehicles");
    }
    case "fuel": {
      const last = db.fuel[db.fuel.length - 1];
      return card("Fuel", id, [last ? money(last.total, cur) : money(0, cur)], db.vehicles[0] ? `/vehicles/${db.vehicles[0].id}` : "/vehicles");
    }
    case "papers":
      return card("Papers", id, [String(db.papers.length)], "/papers");
    case "vehicle": {
      const vehicle = db.vehicles[0];
      return card("Vehicle", id, [vehicle?.name ?? "0"], vehicle ? `/vehicles/${vehicle.id}` : "/vehicles");
    }
    case "service": {
      const last = db.services[db.services.length - 1];
      return card("Service", id, [last ? money(last.cost, cur) : money(0, cur)], db.vehicles[0] ? `/vehicles/${db.vehicles[0].id}` : "/vehicles");
    }
    case "range": {
      const vehicle = db.vehicles[0];
      const unit = db.settings.distanceUnit;
      if (!vehicle) return card("Range", id, ["No vehicle"], "/vehicles");
      const mine = db.fuel.filter((row) => row.vehicleId === vehicle.id);
      const lastFull = lastFullFill(mine);
      const avgKm = vehicleStats(db, vehicle).avgMileage;
      const line =
        lastFull && vehicle.tankLitres && Number.isFinite(avgKm)
          ? rangeAfterFullLine(avgKm, vehicle.tankLitres, unit)
          : null;
      return card("Range", id, [line ?? "After a full fill"], `/vehicles/${vehicle.id}`);
    }
    case "stops":
      return card("Stops", id, [String(db.trips.reduce((sum, trip) => sum + trip.itinerary.filter((item) => item.stop).length, 0))], "/travel");
    case "packing": {
      const trip = db.trips[0];
      const left = trip ? trip.packing.filter((item) => !item.done).length : 0;
      return card("Packing", id, [String(left)], trip ? `/travel/${trip.id}` : "/travel");
    }
    case "heading":
      return card("Heading", id, ["On this phone"], "/compass");
    case "maintenance":
    case "home":
      return card("Home", id, [db.appliances[0]?.name ?? String(db.appliances.length)], "/home");
    case "chores":
      return card("Chores", id, [String(db.chores.length)], "/home");
    case "appliances":
      return card("Appliances", id, [String(db.appliances.length)], "/home");
    case "notes":
      return card("Notes", id, [db.notes[0]?.title || String(db.notes.length)], db.notes[0] ? `/notes?id=${db.notes[0].id}` : "/notes");
    case "cycle":
      return card("Cycle", id, [String(db.cycle.days.length)], "/cycle");
    case "warranties":
      return card("Warranties", id, [String(db.papers.length + db.appliances.length)], "/papers");
    case "utilities":
      return card("Utilities", id, [String(db.utilities.length)], "/home");
    case "kanban":
      return card("Kanban", id, [db.kanban[0]?.name ?? String(db.kanban.length)], "/kanban");
    case "wiki":
      return card("Wiki", id, [db.wiki[0]?.title ?? String(db.wiki.length)], "/wiki");
    case "media":
      return card("Media", id, [db.media[0]?.title ?? String(db.media.length)], "/media");
    case "rules":
      return card("Rules", id, [db.rules[0]?.name ?? String(db.rules.length)], "/rules");
    case "tools":
    case "history":
      return card(id === "history" ? "History" : "Tools", id, [db.toolHistory[0]?.label ?? String(db.toolHistory.length)], "/tools");
    case "builder":
      return card("Builder", id, [db.customTools[0]?.name ?? String(db.customTools.length)], "/builder");
    case "dev":
      return card("Dev", id, ["0"], "/dev");
    case "lab":
      return card("Lab", id, ["0"], "/lab");
    case "net":
      return card("Network", id, [String(db.netlog.length)], "/net");
    case "docgaps":
    case "docids":
    case "docinsurance":
    case "doctrips":
    case "docfiles": {
      const copy = documentCardCopy(db, id);
      return card(copy.title, id, copy.lines, "/papers");
    }
    case "billdue":
    case "rent":
    case "emi":
    case "subs":
    case "billpaid": {
      const copy = billCardCopy(db, id);
      return card(copy.title, id, copy.lines, "/bills");
    }
    default:
      return card(id.charAt(0).toUpperCase() + id.slice(1), id, ["0"], "/");
  }
}
