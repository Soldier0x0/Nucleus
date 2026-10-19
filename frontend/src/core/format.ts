/** Hex chunk; the platform's RNG when present (Hermes may lack Web Crypto entirely). */
function randChunk(len: number): string {
  const c = globalThis.crypto;
  if (typeof c?.getRandomValues !== "function") return Math.random().toString(36).slice(2, 2 + len);
  const n = Math.ceil(len / 2);
  const b = new Uint8Array(n);
  c.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, len);
}

/** Record ids: random party, ending with a time chunk so recently made rows sort naturally. */
export const uid = (): string => `${randChunk(8)}${randChunk(8)}-${Date.now().toString(36).slice(-4)}`;

export const todayISO = () => toISODate(new Date());

export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(s: string, n: number) {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function addMonths(s: string, n: number) {
  const d = parseISO(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISODate(d);
}

export function daysBetween(a: string, b: string) {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}

export const monthKey = (s: string) => s.slice(0, 7);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthLabel = (key: string) => MONTHS[Number(key.slice(5, 7)) - 1] ?? key;

export function fmtDate(s?: string) {
  if (!s) return "—";
  const d = parseISO(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function relDays(n: number) {
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  if (n < 0) return `${-n} days ago`;
  return `in ${n} days`;
}

const SYMBOLS: Record<string, string> = {
  INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "AED ", AUD: "A$", BDT: "৳", BRL: "R$",
  CAD: "C$", CHF: "CHF ", CNY: "¥", DKK: "kr ", HKD: "HK$", IDR: "Rp ", JPY: "¥", KRW: "₩",
  KWD: "KD ", LKR: "Rs ", MXN: "MX$", MYR: "RM ", NOK: "kr ", NPR: "Rs ", NZD: "NZ$", PHP: "₱",
  PKR: "Rs ", PLN: "zł ", QAR: "QR ", SAR: "SAR ", SEK: "kr ", SGD: "S$", THB: "฿", TRY: "₺", ZAR: "R ",
};
const ZERO_DECIMALS = new Set(["JPY", "KRW", "IDR", "VND"]);
export const CURRENCIES = Object.keys(SYMBOLS);

export function money(n: number, cur: string, opts: { decimals?: boolean } = {}) {
  const sym = SYMBOLS[cur] ?? `${cur} `;
  const abs = Math.abs(n);
  const dec = ZERO_DECIMALS.has(cur) ? false : (opts.decimals ?? abs < 100);
  const locale = cur === "INR" ? "en-IN" : "en-US";
  let body: string;
  try {
    body = abs.toLocaleString(locale, { minimumFractionDigits: dec ? 2 : 0, maximumFractionDigits: dec ? 2 : 0 });
  } catch {
    body = dec ? abs.toFixed(2) : String(Math.round(abs));
  }
  return `${n < 0 ? "-" : ""}${sym}${body}`;
}

export function num(n: number, digits = 1) {
  if (!isFinite(n)) return "—";
  const r = Number(n.toFixed(digits));
  return r.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function parseNum(s: string): number {
  const v = parseFloat(String(s).replace(/,/g, ""));
  return isFinite(v) ? v : NaN;
}

export const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
export function median(a: number[]) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** "1 card", "3 cards"; pass `many` for irregular plurals. */
export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
