/** A shared receipt waits here until Money opens it. */
let pending: string | null = null;
const listeners = new Set<(text: string) => void>();

export function pushReceiptText(text: string) {
  pending = text;
  listeners.forEach((fn) => fn(text));
}

export function takeReceiptText() {
  const text = pending;
  pending = null;
  return text;
}

export function subscribeReceipt(fn: (text: string) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
