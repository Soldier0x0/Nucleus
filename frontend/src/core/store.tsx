import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { storage } from "@/src/utils/storage";
import { decryptString, encryptString, isEncrypted, replaceStoredDocument } from "./crypto";
import type { DB, Settings } from "./types";
import { DB_KEY, emptyDB, LEGACY_DB_KEY, normalizeDB } from "./defaults";
import { planOpen, resolveOpen } from "./openDb";

type Store = {
  db: DB;
  ready: boolean;
  /** A saved snapshot exists but could not be read. Nothing is written while this is set. */
  unreadable: boolean;
  retryLoad: () => void;
  discardUnreadable: () => Promise<void>;
  update: (fn: (db: DB) => DB) => void;
  setSettings: (patch: Partial<Settings>) => void;
  replace: (db: DB) => void;
};

const StoreContext = createContext<Store | null>(null);

/**
 * Single local document store. Loaded once, persisted with a short debounce.
 * If the saved snapshot cannot be opened, it is left on disk and the empty
 * document in memory is not written back over it.
 */
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB>(emptyDB);
  const [ready, setReady] = useState(false);
  const [unreadable, setUnreadable] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writable = useRef(false);
  const dropLegacyAfterSave = useRef(false);
  const writeGen = useRef(0);

  useEffect(() => {
    let cancelled = false;
    writable.current = false;
    (async () => {
      try {
        const [cur, legacy] = await Promise.all([storage.getItem(DB_KEY), storage.getItem(LEGACY_DB_KEY)]);
        if (cancelled) return;
        const outcome = await resolveOpen(planOpen(cur, legacy), async (raw) => (isEncrypted(raw) ? decryptString(raw) : raw));
        if (cancelled) return;
        if (outcome.status === "unreadable") {
          setUnreadable(true);
          setReady(true);
          return;
        }
        if (outcome.status === "opened") {
          const next = normalizeDB(JSON.parse(outcome.json));
          dropLegacyAfterSave.current = outcome.dropLegacyAfterSave;
          setDb(next);
          if (outcome.dropLegacyNow) storage.removeItem(LEGACY_DB_KEY).catch(() => {});
        }
        writable.current = true;
        setUnreadable(false);
        setReady(true);
      } catch {
        if (cancelled) return;
        writable.current = false;
        setUnreadable(true);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  useEffect(() => {
    if (!writable.current) return;
    if (timer.current) clearTimeout(timer.current);
    const generation = ++writeGen.current;
    timer.current = setTimeout(() => {
      encryptString(JSON.stringify(db))
        .then((v) => {
          if (!writable.current || writeGen.current !== generation) return;
          return storage.setItem(DB_KEY, v);
        })
        .then(() => {
          if (!writable.current || writeGen.current !== generation || !dropLegacyAfterSave.current) return;
          dropLegacyAfterSave.current = false;
          return storage.removeItem(LEGACY_DB_KEY);
        })
        .catch(() => {
          // Keep the previous snapshot. A failed save must not be retried by swapping in an empty document.
        });
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [db, ready, unreadable]);

  const retryLoad = useCallback(() => {
    writable.current = false;
    dropLegacyAfterSave.current = false;
    setReady(false);
    setUnreadable(false);
    setLoadAttempt((n) => n + 1);
  }, []);

  const discardUnreadable = useCallback(async () => {
    await replaceStoredDocument(DB_KEY, LEGACY_DB_KEY, JSON.stringify(emptyDB()));
    dropLegacyAfterSave.current = false;
    writable.current = true;
    setUnreadable(false);
    setDb(emptyDB());
    setReady(true);
  }, []);

  const update = useCallback((fn: (db: DB) => DB) => {
    if (!writable.current) return;
    setDb((d) => fn(d));
  }, []);
  const setSettings = useCallback((patch: Partial<Settings>) => {
    if (!writable.current) return;
    setDb((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  }, []);
  const replace = useCallback((next: DB) => {
    if (!writable.current) return;
    setDb(normalizeDB(next));
  }, []);

  const value = useMemo(
    () => ({ db, ready, unreadable, retryLoad, discardUnreadable, update, setSettings, replace }),
    [db, ready, unreadable, retryLoad, discardUnreadable, update, setSettings, replace],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const s = useContext(StoreContext);
  if (!s) throw new Error("StoreProvider missing");
  return s;
}

export const useModuleEnabled = (id: string) => useStore().db.settings.modules.find((m) => m.id === id)?.enabled ?? false;
