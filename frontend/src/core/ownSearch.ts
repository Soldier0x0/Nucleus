import type { DB } from "./types";
import { search, type SearchGroup } from "./search";

function has(q: string, ...fields: (string | undefined)[]) {
  return fields.some((field) => field?.toLowerCase().includes(q));
}

/** Real search includes notes, money, cycle, and trips. A decoy session hides cycle and money. */
export function ownSearch(db: DB, q: string, session: "real" | "decoy"): SearchGroup[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const groups = search(db, q);
  if (session === "real") {
    const days = db.cycle.days.filter((day) => has(needle, day.symptom, day.bleeding, day.date));
    if (days.length) {
      groups.push({
        title: "Cycle",
        items: days.slice(0, 6).map((day) => ({
          id: day.id,
          title: day.symptom || day.bleeding || "Logged day",
          subtitle: "Logged day",
          icon: "calendar-blank-outline",
          route: "/cycle",
        })),
      });
    }
    const trips = db.trips.filter((trip) => has(needle, trip.name, trip.destination, ...trip.itinerary.map((stop) => stop.title)));
    if (trips.length) {
      groups.push({
        title: "Trips",
        items: trips.slice(0, 6).map((trip) => ({
          id: trip.id,
          title: trip.name,
          subtitle: trip.destination,
          icon: "bag-suitcase-outline",
          route: `/travel/${trip.id}`,
        })),
      });
    }
    return groups;
  }
  return groups
    .filter((group) => group.title !== "Transactions" && group.title !== "Subscriptions" && group.title !== "Cycle")
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.route.startsWith("/money") && !item.route.startsWith("/cycle") && !item.route.startsWith("/record/txn") && !item.route.startsWith("/record/subscription")),
    }))
    .filter((group) => group.items.length > 0);
}
