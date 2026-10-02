import { useCallback } from "react";
import { useStore } from "./store";
import { appendLog } from "./online";
import type { NetLogEntry } from "./types";

/** Online flag + network logger bound to the store. */
export function useOnline() {
  const { db, update } = useStore();
  const log = useCallback((e: NetLogEntry) => update((d) => appendLog(d, e)), [update]);
  return { online: db.settings.online, log };
}
