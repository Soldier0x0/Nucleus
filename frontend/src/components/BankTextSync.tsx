import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { CHANNELS } from "@/src/core/notify";
import { useStore } from "@/src/core/store";
import { classifyMoney } from "@/src/core/moneyWords";
import { memoryKey, saveBankNotices, type BankAsk, type BankTxn, type InboxLine } from "@/src/core/smsMoney";
import type { DB } from "@/src/core/types";
import { readBankNotices, requestNotificationAccess, subscribeBankNotices } from "@/src/native/android";
import { bankInboxAutoOn } from "@/src/core/bankAccess";
import { AppState } from "react-native";

const notified = new Set<string>();

function categoryFor(body: string, kind: "debit" | "credit" | "balance"): string | null {
  if (kind === "balance") return "Balance";
  return classifyMoney(body, kind === "credit" ? "income" : "expense")?.category ?? null;
}

function rowFromAsk(ask: BankAsk, choice: "category" | "transfer"): BankTxn {
  const transfer = choice === "transfer";
  return {
    id: ask.id,
    type: ask.kind === "credit" && !transfer ? "income" : "expense",
    amount: ask.kind === "balance" ? 0 : ask.amount,
    category: transfer ? "Transfer" : ask.category,
    date: ask.date,
    note: ask.sender,
    transfer,
    ...(ask.kind === "balance" ? { balance: ask.amount } : {}),
  };
}

async function postAsks(asks: BankAsk[]) {
  if (!asks.length) return;
  await Notifications.setNotificationCategoryAsync("sms-ask", [
    { identifier: "keep", buttonTitle: "Keep" },
    { identifier: "transfer", buttonTitle: "Own transfer" },
    { identifier: "ignore", buttonTitle: "Ignore" },
  ]).catch(() => {});
  for (const ask of asks) {
    if (notified.has(ask.id)) continue;
    notified.add(ask.id);
    await Notifications.scheduleNotificationAsync({
      identifier: `sms-ask:${ask.id}`,
      content: {
        title: ask.notification.title,
        body: ask.sender,
        categoryIdentifier: "sms-ask",
        data: {
          kind: "sms-ask",
          id: ask.id,
          sender: ask.sender,
          amount: ask.amount,
          lineKind: ask.kind,
          date: ask.date,
          category: ask.category,
        },
      },
      trigger: Platform.OS === "android" ? { channelId: CHANNELS.smsAsk } : null,
    }).catch(() => {});
  }
}

/** Reads bank notifications on this phone, keeps debit, credit, and balance lines, and asks once when a line is unclear. */
export async function syncBankInbox(db: DB, update: (fn: (db: DB) => DB) => void): Promise<{ kept: number; dropped: number; asks: BankAsk[] }> {
  const inbox: InboxLine[] = readBankNotices();
  const applied = saveBankNotices(inbox, {
    ownAccounts: db.settings.ownAccounts,
    memory: db.settings.smsMemory,
    categoryFor,
  });
  if (applied.saved.length) {
    update((d) => {
      const have = new Set(d.txns.map((row) => row.id));
      const next = applied.saved.filter((row) => row.date && !have.has(row.id));
      if (!next.length) return d;
      return { ...d, txns: [...d.txns, ...next] };
    });
  }
  await postAsks(applied.asks);
  return { kept: applied.saved.length, dropped: applied.dropped, asks: applied.asks };
}

function remember(update: (fn: (db: DB) => DB) => void, ask: BankAsk, choice: "category" | "transfer" | "ignore") {
  const key = memoryKey(ask.sender);
  update((d) => {
    const memory = d.settings.smsMemory.filter((row) => row.key !== key);
    const category = choice === "transfer" ? "Transfer" : choice === "category" ? ask.category : undefined;
    const smsMemory = [...memory, { key, choice, category }];
    if (choice === "ignore" || !ask.date) return { ...d, settings: { ...d.settings, smsMemory } };
    if (d.txns.some((row) => row.id === ask.id)) return { ...d, settings: { ...d.settings, smsMemory } };
    return { ...d, txns: [...d.txns, rowFromAsk(ask, choice === "transfer" ? "transfer" : "category")], settings: { ...d.settings, smsMemory } };
  });
}

/** Keeps bank texts while the app is open. An unclear line asks once, with actions. */
export function BankTextSync() {
  const { db, ready, session, update } = useStore();
  const dbRef = useRef(db);
  dbRef.current = db;
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (!data || data.kind !== "sms-ask") return;
      const action = response.actionIdentifier;
      if (action !== "keep" && action !== "transfer" && action !== "ignore") return;
      const ask: BankAsk = {
        id: String(data.id ?? ""),
        sender: String(data.sender ?? ""),
        amount: Number(data.amount) || 0,
        kind: data.lineKind === "credit" || data.lineKind === "balance" ? data.lineKind : "debit",
        date: String(data.date ?? ""),
        category: String(data.category ?? "Other"),
        reason: "sender",
        notification: { title: "", body: "", actions: [] },
      };
      if (!ask.id || !ask.sender) return;
      remember(update, ask, action === "keep" ? "category" : action);
    });
    return () => sub.remove();
  }, [update]);

  // Plan 5.5: notification access granted from the system sheet turns the switch on here too.
  useEffect(() => {
    if (!ready || session !== "real" || Platform.OS !== "android") return;
    const check = () => {
      const s = dbRef.current.settings;
      if (bankInboxAutoOn({ accessOn: requestNotificationAccess(), inboxOn: s.smsInbox, turnedOff: s.bankTextsOff })) {
        update((d) => ({ ...d, settings: { ...d.settings, smsInbox: true, bankTextsAsked: true } }));
      }
    };
    check();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => sub.remove();
  }, [ready, session, update]);

  useEffect(() => {
    if (!ready || session !== "real" || !db.settings.smsInbox) return;
    let alive = true;
    const run = () => {
      if (alive) syncBankInbox(dbRef.current, update).catch(() => {});
    };
    run();
    const unsub = subscribeBankNotices(run);
    return () => {
      alive = false;
      unsub();
    };
  }, [ready, session, db.settings.smsInbox, db.settings.smsMemory, db.settings.ownAccounts, update]);

  return null;
}
