/**
 * v0.9.8 (plan 7.2): the fixed merchant table behind the online/offline tag.
 * No model: a known chain or app names the channel, anything else stays a
 * suggestion the person can pick, and their answer is remembered.
 */
import type { DB, TxnChannel, TxnChannelOverride } from "./types";

export const CHANNEL_LABELS: { value: TxnChannel; label: string }[] = [
  { value: "online_food", label: "Online food" },
  { value: "online_grocery", label: "Online grocery" },
  { value: "in_person", label: "In person" },
];

export const CHANNEL_LIMIT = 80;

export function channelLabel(channel: TxnChannel): string {
  return CHANNEL_LABELS.find((row) => row.value === channel)?.label ?? "In person";
}

export function isChannel(value: unknown): value is TxnChannel {
  return value === "online_food" || value === "online_grocery" || value === "in_person";
}

const FOOD_APPS = ["zomato", "swiggy"];
const GROCERY_APPS = ["instamart", "blinkit", "zepto", "bigbasket"];
const FOOD_CHAINS = ["kfc", "dominos", "pizza hut", "popeyes"];

const clean = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function hasWord(text: string, word: string) {
  return ` ${text} `.includes(` ${word} `);
}

function hasPhrase(text: string, phrase: string) {
  return ` ${text} `.includes(` ${phrase} `);
}

/** The built-in answer. Apps win over counter chains, so "Zomato KFC" is online food. */
export function seedChannel(text: string): TxnChannel | null {
  const t = clean(text);
  if (!t) return null;
  if (FOOD_APPS.some((app) => hasWord(t, app))) return "online_food";
  if (GROCERY_APPS.some((app) => hasWord(t, app))) return "online_grocery";
  if (FOOD_CHAINS.some((chain) => hasPhrase(t, chain))) return "in_person";
  return null;
}

/**
 * The name a correction is filed under. A known app or chain first; otherwise the
 * first word of four letters or more, so "Shenoy Stores" can be taught once.
 */
export function merchantKey(text: string): string | null {
  const t = clean(text);
  if (!t) return null;
  for (const app of [...FOOD_APPS, ...GROCERY_APPS]) if (hasWord(t, app)) return app;
  for (const chain of FOOD_CHAINS) if (hasPhrase(t, chain)) return chain;
  const token = t.split(" ").find((word) => word.length >= 4 && !/^\d+$/.test(word));
  return token ?? null;
}

/** A saved correction wins over the table. Nothing known returns null so the tag stays unset. */
export function classifyChannel(overrides: TxnChannelOverride[], text: string): TxnChannel | null {
  const key = merchantKey(text);
  if (key) {
    const hit = overrides.find((row) => row.key === key);
    if (hit) return hit.channel;
  }
  return seedChannel(text);
}

/** Remember one answer for one merchant. Blank or generic notes change nothing. */
export function learnMerchantChannel(db: DB, text: string, channel: TxnChannel): DB {
  const key = merchantKey(text);
  if (!key) return db;
  const others = db.settings.merchantOverrides.filter((row) => row.key !== key);
  const merchantOverrides = [...others, { key, channel }].slice(-CHANNEL_LIMIT);
  return { ...db, settings: { ...db.settings, merchantOverrides } };
}
