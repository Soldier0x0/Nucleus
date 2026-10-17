import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useStore } from "@/src/core/store";
import { getLockSignal, useLockSignal } from "@/src/core/lockSignal";
import { DEBOUNCE_MS, shouldSyncNow } from "@/src/core/autoSync";
import { syncInFlight, syncLastAttemptAt, syncWithDesktop } from "@/src/core/syncWithDesktop";
import { subscribeNetworkWake } from "@/src/native/android";

const TICK_MS = 15000;
const DEBOUNCE_SLACK_MS = 250;

/**
 * Automatic LAN sync while both apps are open (desktop plan D2).
 *
 * Lives inside the unlocked tab shell and is gated three ways: the lock signal
 * must read "unlocked", the app must be in the foreground, and a desktop must
 * be paired. Every failure is swallowed. The manual "Sync now" flow keeps its
 * progress lines, summary and plain-word errors.
 */
export function AutoSync() {
  const { db, applySync, localChangeAt } = useStore();
  const lock = useLockSignal();
  const [appActive, setAppActive] = useState(() => AppState.currentState === "active");
  const [tick, setTick] = useState(0);
  const running = useRef(false);
  const failures = useRef(0);
  const coveredChange = useRef<number | null>(null);
  const dbRef = useRef(db);
  dbRef.current = db;

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => setAppActive(state === "active"));
    return () => sub.remove();
  }, []);

  useEffect(() => subscribeNetworkWake(() => setTick((n) => n + 1)), []);

  useEffect(() => {
    if (!appActive) return;
    const timer = setInterval(() => setTick((n) => n + 1), TICK_MS);
    return () => clearInterval(timer);
  }, [appActive]);

  useEffect(() => {
    if (!appActive || localChangeAt === null) return;
    const wait = Math.max(0, localChangeAt + DEBOUNCE_MS - Date.now()) + DEBOUNCE_SLACK_MS;
    const timer = setTimeout(() => setTick((n) => n + 1), wait);
    return () => clearTimeout(timer);
  }, [appActive, localChangeAt]);

  useEffect(() => {
    const pairedCount = (db.settings.pairedDevices ?? []).length;
    if (
      !shouldSyncNow({
        appActive,
        unlocked: lock === "unlocked",
        pairedCount,
        inFlight: running.current || syncInFlight(),
        now: Date.now(),
        lastLocalChangeAt: localChangeAt,
        lastAttemptAt: syncLastAttemptAt(),
        selfAppliedRevisionMarker: coveredChange.current,
        consecutiveFailures: failures.current,
      })
    )
      return;

    const marker = localChangeAt;
    running.current = true;
    void (async () => {
      let succeeded = false;
      let attempted = false;
      try {
        for (const device of dbRef.current.settings.pairedDevices ?? []) {
          if (getLockSignal() !== "unlocked" || AppState.currentState !== "active") return;
          try {
            attempted = true;
            const result = await syncWithDesktop(dbRef.current, device, { silent: true });
            applySync(() => result.db);
            coveredChange.current = marker;
            succeeded = true;
            return;
          } catch {
            // Silent by design: try the next paired desktop.
          }
        }
      } finally {
        if (succeeded || attempted) failures.current = succeeded ? 0 : failures.current + 1;
        running.current = false;
      }
    })();
  }, [appActive, lock, tick, localChangeAt, db, applySync]);

  return null;
}
