/**
 * Bank texts are read on this phone. Codes and everything else are dropped here.
 * Nothing in this module is sent off the device.
 */
export const SMS_LEAVES_THE_PHONE = false;

export type InboxLine = { sender: string; body: string; at: string; app?: string };
export type KeptLine = { kind: "debit" | "credit" | "balance"; amount: number; sender: string; at: string };

const OTP = /\b(otp|one[ -]?time(?: password)?|verification code|do not share)\b/i;
const INR = /(?:inr|rs\.?|₹)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?)/gi;

function amounts(body: string): number[] {
  const out: number[] = [];
  INR.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INR.exec(body))) {
    const n = Number(match[1].replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) out.push(Math.round(n * 100) / 100);
  }
  return out;
}

function parseBank(line: InboxLine): KeptLine | null {
  const nums = amounts(line.body);
  if (!nums.length) return null;
  const debit = /\b(debited|debit|paid|sent|spent|withdrawn|purchase of)\b/i.test(line.body);
  const credit = /\b(credited|credit|received|added)\b/i.test(line.body);
  const balance = /\b(avl\.?\s*bal|available balance|a\/c bal|balance)\b/i.test(line.body);
  if (debit) return { kind: "debit", amount: nums[0], sender: line.sender, at: line.at };
  if (credit) return { kind: "credit", amount: nums[0], sender: line.sender, at: line.at };
  if (balance) return { kind: "balance", amount: nums[0], sender: line.sender, at: line.at };
  return null;
}

export function filterInbox(lines: InboxLine[]): { kept: KeptLine[]; dropped: number } {
  const kept: KeptLine[] = [];
  let dropped = 0;
  for (const line of lines) {
    if (OTP.test(line.body)) {
      dropped += 1;
      continue;
    }
    const parsed = parseBank(line);
    if (!parsed) {
      dropped += 1;
      continue;
    }
    kept.push(parsed);
  }
  return { kept, dropped };
}

export type SmsMemory = { key: string; choice: "category" | "transfer" | "ignore"; category?: string };

export function memoryKey(sender: string): string {
  return sender.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export type BankDecision =
  | { outcome: "drop" }
  | { outcome: "save"; category: string; transfer: boolean }
  | { outcome: "ask"; reason: "sender" | "category" | "transfer"; notification: { title: string; body: string; actions: string[] } };

function ownTransfer(body: string, ownAccounts: string[]): boolean {
  if (/\b(own account|transferred to your|self transfer)\b/i.test(body)) return true;
  return ownAccounts.some((account) => account.length > 2 && body.includes(account));
}

const ASK_ACTIONS = ["Keep", "Own transfer", "Ignore"];

export function decideBankLine(input: {
  sender: string;
  body: string;
  kind: "debit" | "credit" | "balance";
  knownSenders: string[];
  ownAccounts: string[];
  memory: SmsMemory[];
  category: string | null;
}): BankDecision {
  const key = memoryKey(input.sender);
  const remembered = input.memory.find((row) => row.key === key);
  if (remembered?.choice === "ignore") return { outcome: "drop" };
  if (remembered?.choice === "transfer") return { outcome: "save", category: "Transfer", transfer: true };
  if (remembered?.choice === "category" && remembered.category) return { outcome: "save", category: remembered.category, transfer: false };
  if (input.kind === "balance") return { outcome: "save", category: "Balance", transfer: false };
  if (ownTransfer(input.body, input.ownAccounts)) {
    return { outcome: "ask", reason: "transfer", notification: { title: "Was this your own account?", body: input.sender, actions: ASK_ACTIONS } };
  }
  const known = input.knownSenders.some((sender) => memoryKey(sender) === key || input.sender.toLowerCase().includes(sender.toLowerCase()));
  if (!known) {
    return { outcome: "ask", reason: "sender", notification: { title: "Unknown bank sender", body: input.sender, actions: ASK_ACTIONS } };
  }
  if (!input.category && input.kind === "debit") {
    return { outcome: "ask", reason: "category", notification: { title: "What was this payment?", body: input.sender, actions: ASK_ACTIONS } };
  }
  return { outcome: "save", category: input.category || "Other", transfer: false };
}

export function countsAsSpending(row: { kind: "debit" | "credit" | "balance"; transfer: boolean }): boolean {
  return row.kind === "debit" && !row.transfer;
}

export type BankTxn = {
  id: string;
  type: "expense" | "income";
  amount: number;
  category: string;
  date: string;
  note: string;
  transfer: boolean;
  balance?: number;
};

export type BankAsk = {
  id: string;
  sender: string;
  amount: number;
  kind: KeptLine["kind"];
  date: string;
  category: string;
  reason: "sender" | "category" | "transfer";
  notification: { title: string; body: string; actions: string[] };
};

/** Calendar day for a bank text. Accepts an ISO time or the inbox clock in milliseconds. */
export function bankDate(at: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(at)) return at.slice(0, 10);
  const n = Number(at);
  if (!Number.isFinite(n) || n < 1_000_000_000) return "";
  const ms = n < 10_000_000_000 ? n * 1000 : n;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function smsTxnId(sender: string, at: string, kind: string): string {
  return `sms:${memoryKey(sender)}:${at}:${kind}`;
}

/**
 * Kept lines become ledger rows. An unknown sender, an unclear category, or a possible
 * own-account transfer is an ask, not a saved row. Codes never appear in the result.
 */
export function applyInbox(
  lines: InboxLine[],
  input: {
    knownSenders: string[];
    ownAccounts: string[];
    memory: SmsMemory[];
    categoryFor: (body: string, kind: KeptLine["kind"]) => string | null;
  },
): { saved: BankTxn[]; asks: BankAsk[]; dropped: number } {
  const filtered = filterInbox(lines);
  const saved: BankTxn[] = [];
  const asks: BankAsk[] = [];
  for (const line of filtered.kept) {
    const source = lines.find((row) => row.sender === line.sender && row.at === line.at);
    const body = source?.body ?? "";
    const category = input.categoryFor(body, line.kind);
    const decision = decideBankLine({
      sender: line.sender,
      body,
      kind: line.kind,
      knownSenders: input.knownSenders,
      ownAccounts: input.ownAccounts,
      memory: input.memory,
      category,
    });
    const date = bankDate(line.at);
    const id = smsTxnId(line.sender, line.at, line.kind);
    if (decision.outcome === "save" && date) {
      saved.push({
        id,
        type: line.kind === "credit" ? "income" : "expense",
        amount: line.kind === "balance" ? 0 : line.amount,
        category: decision.category,
        date,
        note: line.sender,
        transfer: decision.transfer,
        ...(line.kind === "balance" ? { balance: line.amount } : {}),
      });
    } else if (decision.outcome === "ask") {
      asks.push({
        id,
        sender: line.sender,
        amount: line.amount,
        kind: line.kind,
        date,
        category: category || "Other",
        reason: decision.reason,
        notification: decision.notification,
      });
    }
  }
  return { saved, asks, dropped: filtered.dropped };
}

const PAYMENT_NAME = /google pay|\bgpay\b|phonepe|phone pe|\bbank\b|\bhdfc\b|\bicici\b|\bsbi\b|axis bank|\bkotak\b/i;

function isBankNotice(line: { sender: string; app?: string }): boolean {
  const app = (line.app ?? "").toLowerCase();
  if (app.includes("nbu.paisa") || app.includes("walletnfcrel") || app.includes("phonepe")) return true;
  if (app.includes("bank")) return true;
  return PAYMENT_NAME.test(`${line.sender} ${line.app ?? ""}`);
}

/**
 * Google Pay, PhonePe, and bank notifications become ledger rows.
 * An unknown sender still asks. An own-account transfer still asks.
 */
export function saveBankNotices(
  lines: InboxLine[],
  input: {
    ownAccounts: string[];
    memory: SmsMemory[];
    categoryFor: (body: string, kind: KeptLine["kind"]) => string | null;
  },
): { saved: BankTxn[]; asks: BankAsk[]; dropped: number } {
  const applied = applyInbox(lines, {
    knownSenders: [],
    ownAccounts: input.ownAccounts,
    memory: input.memory,
    categoryFor: input.categoryFor,
  });
  const saved = [...applied.saved];
  const asks: BankAsk[] = [];
  for (const ask of applied.asks) {
    const source = lines.find((row) => smsTxnId(row.sender, row.at, ask.kind) === ask.id);
    if (ask.reason !== "transfer" && ask.date && source && isBankNotice(source)) {
      saved.push({
        id: ask.id,
        type: ask.kind === "credit" ? "income" : "expense",
        amount: ask.kind === "balance" ? 0 : ask.amount,
        category: ask.kind === "balance" ? "Balance" : ask.category || "Other",
        date: ask.date,
        note: ask.sender,
        transfer: false,
        ...(ask.kind === "balance" ? { balance: ask.amount } : {}),
      });
    } else {
      asks.push(ask);
    }
  }
  return { saved, asks, dropped: applied.dropped };
}
