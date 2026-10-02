import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { storage } from "@/src/utils/storage";
import type { DB, Settings } from "./types";
import { DB_KEY, emptyDB, LEGACY_DB_KEY, normalizeDB } from "./defaults";

type Store = {
  db: DB;
  ready: boolean;
  update: (fn: (db: DB) => DB) => void;
  setSettings: (patch: Partial<Settings>) => void;
  replace: (db: DB) => void;
};

const StoreContext = createContext<Store | null>(null);

/**
 * Single local document store. Loaded once, persisted with a short debounce.
 * Everything stays on-device; there is no network layer.
 */
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB>(emptyDB);
  const [ready, setReady] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Upgrade path: Nucleus data becomes the Nucleus data, nothing lost.
    Promise.all([storage.getItem(DB_KEY), storage.getItem(LEGACY_DB_KEY)]).then(([cur, legacy]) => {
      const raw = cur ?? legacy;
      if (raw) {
        try {
          setDb(normalizeDB(JSON.parse(raw)));
        } catch {
          setDb(emptyDB());
        }
      }
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => storage.setItem(DB_KEY, JSON.stringify(db)), 250);
  }, [db, ready]);

  const update = useCallback((fn: (db: DB) => DB) => setDb((d) => fn(d)), []);
  const setSettings = useCallback((patch: Partial<Settings>) => setDb((d) => ({ ...d, settings: { ...d.settings, ...patch } })), []);
  const replace = useCallback((next: DB) => setDb(normalizeDB(next)), []);

  const value = useMemo(() => ({ db, ready, update, setSettings, replace }), [db, ready, update, setSettings, replace]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const s = useContext(StoreContext);
  if (!s) throw new Error("StoreProvider missing");
  return s;
}

export const useModuleEnabled = (id: string) => useStore().db.settings.modules.find((m) => m.id === id)?.enabled ?? false;
