/**
 * Desktop document store. Same shape as the phone's store for the parts the
 * desktop needs: load -> normalizeDB -> context, update(fn) with
 * stampChanges/updatedAt so phase D2 sync can merge cleanly, setSettings,
 * and a short debounced encrypted save.
 *
 * Profiles/decoy logic is deliberately absent on desktop.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { DB, Settings } from "@core/types";
import { emptyDB } from "@core/defaults";
import { stampChanges } from "@core/syncStamp";
import { uid } from "@core/format";
import { discardDocument, dropLegacyDocument, loadDocument, saveDocument } from "./platform/document";

type Store = {
  db: DB;
  ready: boolean;
  /** A saved snapshot exists but could not be read. Nothing is written while this is set. */
  unreadable: boolean;
  retryLoad: () => void;
  discardUnreadable: () => Promise<void>;
  update: (fn: (db: DB) => DB) => void;
  setSettings: (patch: Partial<Settings>) => void;
  /** Applies an already-merged document (sync) without re-stamping local rows. */
  applySync: (fn: (db: DB) => DB) => void;
  replace: (db: DB) => void;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB>(emptyDB);
  const [ready, setReady] = useState(false);
  const [unreadable, setUnreadable] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writable = useRef(false);
  const dropLegacyAfterSave = useRef(false);
  const writeGen = useRef(0);
  const dbRef = useRef(db);
  dbRef.current = db;

  useEffect(() => {
    let cancelled = false;
    writable.current = false;
    (async () => {
      try {
        const result = await loadDocument();
        if (cancelled) return;
        if (result.status === "unreadable") {
          setUnreadable(true);
          setReady(true);
          return;
        }
        if (result.status === "opened") {
          dropLegacyAfterSave.current = result.dropLegacyAfterSave;
          setDb(result.db);
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

  // A fresh document gets this computer's install id, mirroring the phone.
  useEffect(() => {
    if (!ready || !writable.current || unreadable || db.settings.installId) return;
    setDb((d) => (d.settings.installId ? d : { ...d, settings: { ...d.settings, installId: uid() } }));
  }, [ready, unreadable, db.settings.installId]);

  useEffect(() => {
    if (!writable.current) return;
    if (timer.current) clearTimeout(timer.current);
    const generation = ++writeGen.current;
    timer.current = setTimeout(() => {
      saveDocument(db)
        .then(async () => {
          if (!writable.current || writeGen.current !== generation || !dropLegacyAfterSave.current) return;
          dropLegacyAfterSave.current = false;
          await dropLegacyDocument();
        })
        .catch(() => {
          // Keep the previous snapshot. A failed save must not be retried with an empty document.
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
    await discardDocument();
    dropLegacyAfterSave.current = false;
    writable.current = true;
    setUnreadable(false);
    setDb(emptyDB());
    setReady(true);
  }, []);

  const update = useCallback((fn: (db: DB) => DB) => {
    if (!writable.current) return;
    setDb((d) => (d.settings.readOnly ? d : stampChanges(d, fn(d), new Date().toISOString())));
  }, []);

  const setSettings = useCallback((patch: Partial<Settings>) => {
    if (!writable.current) return;
    setDb((d) => (d.settings.readOnly ? d : { ...d, settings: { ...d.settings, ...patch } }));
  }, []);

  const applySync = useCallback((fn: (db: DB) => DB) => {
    if (!writable.current) return;
    setDb((d) => (d.settings.readOnly ? d : fn(d)));
  }, []);

  const replace = useCallback((next: DB) => {
    if (!writable.current) return;
    setDb({ ...next, settings: { ...next.settings, readOnly: false } });
  }, []);

  const value = useMemo(
    () => ({ db, ready, unreadable, retryLoad, discardUnreadable, update, setSettings, applySync, replace }),
    [db, ready, unreadable, retryLoad, discardUnreadable, update, setSettings, applySync, replace],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const s = useContext(StoreContext);
  if (!s) throw new Error("StoreProvider missing");
  return s;
}
