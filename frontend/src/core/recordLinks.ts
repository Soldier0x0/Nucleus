export type SharedLink = {
  fromKind: string;
  fromId: string;
  toKind: string;
  toId: string;
  because: "date" | "amount";
};

export function suggestShared(input: {
  debits: { id: string; date: string; amount: number }[];
  receipts: { id: string; date: string; amount: number }[];
  trips: { id: string; start: string; end: string }[];
  fuel: { id: string; date: string; total: number }[];
  periods: { id: string; date: string }[];
  missedWork: { id: string; date: string }[];
}): SharedLink[] {
  const links: SharedLink[] = [];
  for (const debit of input.debits) {
    for (const receipt of input.receipts) {
      if (debit.amount === receipt.amount || debit.date === receipt.date) {
        links.push({
          fromKind: "txn",
          fromId: debit.id,
          toKind: "receipt",
          toId: receipt.id,
          because: debit.amount === receipt.amount ? "amount" : "date",
        });
      }
    }
  }
  for (const trip of input.trips) {
    for (const fill of input.fuel) {
      if (fill.date >= trip.start && fill.date <= trip.end) {
        links.push({ fromKind: "trip", fromId: trip.id, toKind: "fuel", toId: fill.id, because: "date" });
      }
    }
  }
  for (const period of input.periods) {
    for (const missed of input.missedWork) {
      if (period.date === missed.date) {
        links.push({ fromKind: "cycle", fromId: period.id, toKind: "work", toId: missed.id, because: "date" });
      }
    }
  }
  return links;
}
