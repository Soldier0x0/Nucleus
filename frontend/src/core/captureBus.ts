/** A shared line of text, from the capture bar or from another app. No classification. */
type Listener = (text: string) => void;
const listeners = new Set<Listener>();

export function subscribeCapture(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function pushCaptureText(text: string) {
  const t = text.trim();
  if (!t) return;
  for (const fn of listeners) fn(t);
}
