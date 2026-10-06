import { paySubscription } from "./actions";
import { addDays, fmtDate, todayISO } from "./format";
import type { AttentionMark, DB, Subscription } from "./types";

export type BillMark = "due" | "paid" | "snoozed";

export type RepeatingBill = {
  id: string;
  name: string;
  amount: number;
  cycle: Subscription["cycle"];
  category: string;
  next: string;
  mark: BillMark;
};

export type BoardTile = { id: string; size: "large" | "small" };

const BILL_TILES = ["billdue", "rent", "emi", "subs", "billpaid"] as const;

function billKey(id: string): string {
  return `bill:${id}`;
}

function markFor(mark: AttentionMark | undefined, today: string): BillMark {
  if (!mark) return "due";
  switch (mark.status) {
    case "snoozed":
      return mark.until && mark.until > today ? "snoozed" : "due";
    case "done":
      return "paid";
    case "dismissed":
      return "due";
    default: {
      const never: never = mark.status;
      return never;
    }
  }
}

/** Recurring bills live on subscriptions. One-off expenses stay off this board. */
export function repeatingBillBoard(db: DB, today = todayISO()): RepeatingBill[] {
  return db.subscriptions
    .filter((row) => row.active)
    .map((row) => ({
      id: row.id,
      name: row.name,
      amount: row.amount,
      cycle: row.cycle,
      category: row.category,
      next: row.nextRenewal,
      mark: markFor(db.attention[billKey(row.id)], today),
    }))
    .sort((a, b) => a.next.localeCompare(b.next) || a.name.localeCompare(b.name));
}

export function billReminder(bill: RepeatingBill): string {
  switch (bill.mark) {
    case "paid":
      return `${bill.name} is paid`;
    case "snoozed":
      return `${bill.name} is snoozed`;
    case "due":
      return `${bill.name} is due ${fmtDate(bill.next)}`;
    default: {
      const never: never = bill.mark;
      return never;
    }
  }
}

export function setBillMark(db: DB, id: string, mark: BillMark, today = todayISO()): DB {
  const key = billKey(id);
  switch (mark) {
    case "paid": {
      const paid = paySubscription(db, id);
      return { ...paid, attention: { ...paid.attention, [key]: { status: "done" } } };
    }
    case "snoozed":
      return { ...db, attention: { ...db.attention, [key]: { status: "snoozed", until: addDays(today, 3) } } };
    case "due": {
      if (!db.attention[key]) return db;
      const attention = { ...db.attention };
      delete attention[key];
      return { ...db, attention };
    }
    default: {
      const never: never = mark;
      return never;
    }
  }
}

function isRent(row: RepeatingBill): boolean {
  return row.category === "Rent";
}

function isEmi(row: RepeatingBill): boolean {
  return row.category === "Loan EMI" || /\bEMI\b/.test(row.name);
}

function isSub(row: RepeatingBill): boolean {
  return row.category === "Subscriptions";
}

export function billBoardItems(db: DB, today = todayISO()): BoardTile[] {
  const due = repeatingBillBoard(db, today).filter((row) => row.mark === "due");
  return BILL_TILES.map((id) => ({ id, size: id === "billdue" && due.length > 1 ? "large" : "small" }));
}

export function billCardCopy(db: DB, id: string, today = todayISO()): { title: string; lines: string[] } {
  const rows = repeatingBillBoard(db, today);
  const lines = (picked: RepeatingBill[], empty: string) => (picked.length ? picked.map((row) => billReminder(row)) : [empty]);
  switch (id) {
    case "billdue":
      return { title: "Due", lines: lines(rows.filter((row) => row.mark === "due"), "Nothing due") };
    case "rent":
      return { title: "Rent", lines: lines(rows.filter(isRent), "No rent yet") };
    case "emi":
      return { title: "EMI", lines: lines(rows.filter(isEmi), "No EMI yet") };
    case "subs":
      return { title: "Subscriptions", lines: lines(rows.filter(isSub), "No subscription yet") };
    case "billpaid":
      return { title: "Paid", lines: lines(rows.filter((row) => row.mark === "paid"), "None paid") };
    default:
      return { title: "Bills", lines: lines(rows.filter((row) => row.mark === "due"), "Nothing due") };
  }
}
