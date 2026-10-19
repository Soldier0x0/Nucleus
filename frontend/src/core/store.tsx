import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { storage, secureStorage } from "@/src/utils/storage";
import { decryptString, encryptString, isEncrypted, replaceStoredDocument } from "./crypto";
import type { DB, Settings } from "./types";
import { DB_KEY, emptyDB, LEGACY_DB_KEY, normalizeDB } from "./defaults";
import { planOpen, resolveOpen } from "./openDb";
import { clearFailures, clearPin } from "./security";
import { uid } from "./format";
import { stampChanges } from "./syncStamp";
import {
  buildDecoyDB,
  DECOY_DB_KEY,
  defaultProfileIndex,
  encodeSwitchMarker,
  parseProfileIndex,
  parseSwitchMarker,
  persistDocumentKey,
  PROFILE_INDEX_KEY,
  profileDocKey,
  shellSettings,
  SWITCH_MARKER_KEY,
  type ProfileIndex,
  type ProfileMeta,
  type VaultSession,
} from "./profiles";

type Store = {
  db: DB;
  ready: boolean;
  /** A saved snapshot exists but could not be read. Nothing is written while this is set. */
  unreadable: boolean;
  /** "decoy" is invisible in the UI. Screens must not mention it. */
  session: VaultSession;
  profiles: ProfileMeta[];
  activeProfileId: string;
  retryLoad: () => void;
  discardUnreadable: () => Promise<void>;
  update: (fn: (db: DB) => DB) => void;
  /** Applies an already-merged document (sync) without re-stamping local rows. */
  applySync: (fn: (db: DB) => DB) => void;
  /** Wall-clock ms of the last local edit. Remote-applied sync data does not move it. */
  localChangeAt: number | null;
  setSettings: (patch: Partial<Settings>) => void;
  replace: (db: DB) => void;
  openReal: () => Promise<void>;
  openDecoy: () => Promise<void>;
  prepareDecoy: () => Promise<void>;
  addProfile: (name: string) => Promise<boolean>;
  switchProfile: (id: string) => Promise<void>;
  renameProfile: (id: string, name: string) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  /** Erases the vault you are looking at. From the decoy profile this does not touch the real one. */
  wipeVisible: () => Promise<void>;
  /** Lock-screen recovery. Removes every profile, the decoy, and the PIN. */
  wipeDeviceData: () => Promise<void>;
};

const StoreContext = createContext<Store | null>(null);

async function readIndex(): Promise<ProfileIndex> {
  try {
    return parseProfileIndex(await secureStorage.getItem(PROFILE_INDEX_KEY));
  } catch {
    return defaultProfileIndex();
  }
}

async function writeIndex(index: ProfileIndex) {
  await secureStorage.setItem(PROFILE_INDEX_KEY, JSON.stringify(index));
}

async function readDocument(key: string): Promise<DB | null> {
  const raw = await storage.getItem(key);
  if (!raw) return null;
  const json = isEncrypted(raw) ? await decryptString(raw) : raw;
  return normalizeDB(JSON.parse(json));
}

/**
 * Single local document store. Loaded once, persisted with a short debounce.
 * If the saved snapshot cannot be opened, it is left on disk and the empty
 * document in memory is not written back over it.
 * The decoy session persists only to its own key.
 */
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB>(emptyDB);
  const [ready, setReady] = useState(false);
  const [unreadable, setUnreadable] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [localChangeAt, setLocalChangeAt] = useState<number | null>(null);
  const [session, setSession] = useState<VaultSession>("real");
  const [profiles, setProfiles] = useState<ProfileMeta[]>(defaultProfileIndex().profiles);
  const [activeProfileId, setActiveProfileId] = useState(defaultProfileIndex().activeId);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writable = useRef(false);
  const dropLegacyAfterSave = useRef(false);
  const writeGen = useRef(0);
  const slot = useRef<VaultSession>("real");
  const dbRef = useRef(db);
  const activeIdRef = useRef(activeProfileId);
  dbRef.current = db;
  activeIdRef.current = activeProfileId;

  const flushCurrent = useCallback(async () => {
    if (!writable.current) return;
    if (timer.current) clearTimeout(timer.current);
    const generation = ++writeGen.current;
    const key = persistDocumentKey(slot.current);
    const sealed = await encryptString(JSON.stringify(dbRef.current));
    if (!writable.current || writeGen.current !== generation) return;
    await storage.setItem(key, sealed);
  }, []);

  useEffect(() => {
    let cancelled = false;
    writable.current = false;
    slot.current = "real";
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
        const index = await readIndex();
        if (cancelled) return;
        // A switch may have ended between carrying the primary document and
        // naming the profile in the index. The marker says which profile is in
        // the primary document; tie the index to it.
        let live = index;
        const to = parseSwitchMarker(await secureStorage.getItem(SWITCH_MARKER_KEY));
        if (to && index.profiles.some((p) => p.id === to)) {
          live = { ...index, activeId: to };
          await writeIndex(live);
          if (cancelled) return;
        }
        await secureStorage.removeItem(SWITCH_MARKER_KEY);
        setProfiles(live.profiles);
        setActiveProfileId(live.activeId);
        setSession("real");
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
    if (!ready || !writable.current || unreadable || db.settings.installId || db.settings.readOnly) return;
    setDb((d) => (d.settings.installId ? d : { ...d, settings: { ...d.settings, installId: uid() } }));
  }, [ready, unreadable, db.settings.installId, db.settings.readOnly]);

  useEffect(() => {
    if (!writable.current) return;
    if (timer.current) clearTimeout(timer.current);
    const generation = ++writeGen.current;
    const key = persistDocumentKey(slot.current);
    timer.current = setTimeout(() => {
      encryptString(JSON.stringify(db))
        .then((v) => {
          if (!writable.current || writeGen.current !== generation) return;
          return storage.setItem(key, v);
        })
        .then(() => {
          if (!writable.current || writeGen.current !== generation || slot.current !== "real" || !dropLegacyAfterSave.current) return;
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
    slot.current = "real";
    setSession("real");
    setReady(false);
    setUnreadable(false);
    setLoadAttempt((n) => n + 1);
  }, []);

  const discardUnreadable = useCallback(async () => {
    await replaceStoredDocument(DB_KEY, LEGACY_DB_KEY, JSON.stringify(emptyDB()));
    dropLegacyAfterSave.current = false;
    slot.current = "real";
    writable.current = true;
    setSession("real");
    setUnreadable(false);
    setDb(emptyDB());
    setReady(true);
  }, []);

  const update = useCallback((fn: (db: DB) => DB) => {
    if (!writable.current || dbRef.current.settings.readOnly) return;
    setDb((d) => (d.settings.readOnly ? d : stampChanges(d, fn(d), new Date().toISOString())));
    setLocalChangeAt(Date.now());
  }, []);
  const applySync = useCallback((fn: (db: DB) => DB) => {
    if (!writable.current) return;
    setDb((d) => (d.settings.readOnly ? d : fn(d)));
  }, []);
  const setSettings = useCallback((patch: Partial<Settings>) => {
    if (!writable.current) return;
    setDb((d) => (d.settings.readOnly ? d : { ...d, settings: { ...d.settings, ...patch } }));
  }, []);
  const replace = useCallback((next: DB) => {
    if (!writable.current) return;
    setDb(normalizeDB(next));
    setLocalChangeAt(Date.now());
  }, []);

  const openReal = useCallback(async () => {
    if (!writable.current || slot.current === "real") return;
    await flushCurrent();
    slot.current = "real";
    const next = (await readDocument(DB_KEY)) ?? emptyDB();
    setSession("real");
    setDb(next);
  }, [flushCurrent]);

  const openDecoy = useCallback(async () => {
    if (!writable.current || slot.current === "decoy") return;
    await flushCurrent();
    let next: DB;
    try {
      next = (await readDocument(DECOY_DB_KEY)) ?? buildDecoyDB(dbRef.current);
    } catch {
      next = buildDecoyDB(dbRef.current);
    }
    slot.current = "decoy";
    setSession("decoy");
    setDb(next);
  }, [flushCurrent]);

  const prepareDecoy = useCallback(async () => {
    if (!writable.current || slot.current !== "real") return;
    const existing = await storage.getItem(DECOY_DB_KEY);
    if (existing) return;
    const next = buildDecoyDB(dbRef.current);
    await storage.setItem(DECOY_DB_KEY, await encryptString(JSON.stringify(next)));
  }, []);

  const applyIndex = useCallback((index: ProfileIndex) => {
    setProfiles(index.profiles);
    setActiveProfileId(index.activeId);
  }, []);

  const switchProfile = useCallback(
    async (id: string) => {
      if (!writable.current || slot.current !== "real" || id === activeIdRef.current) return;
      await flushCurrent();
      const sealedCurrent = await encryptString(JSON.stringify(dbRef.current));
      await storage.setItem(profileDocKey(activeIdRef.current), sealedCurrent);
      const next = await readDocument(profileDocKey(id));
      if (!next) return;
      await storage.setItem(DB_KEY, await encryptString(JSON.stringify(next)));
      // Marker after the primary carries the new profile, index after the
      // marker: a marker on boot then proves the document already switched.
      await secureStorage.setItem(SWITCH_MARKER_KEY, encodeSwitchMarker(id));
      const index = await readIndex();
      const updated = { ...index, activeId: id };
      await writeIndex(updated);
      await secureStorage.removeItem(SWITCH_MARKER_KEY);
      applyIndex(updated);
      setDb(next);
    },
    [applyIndex, flushCurrent],
  );

  const addProfile = useCallback(
    async (name: string) => {
      if (!writable.current || slot.current !== "real") return false;
      const index = await readIndex();
      if (index.profiles.length >= 6) return false;
      const id = uid();
      const fresh = emptyDB();
      fresh.settings = shellSettings(dbRef.current.settings);
      await storage.setItem(profileDocKey(id), await encryptString(JSON.stringify(fresh)));
      const updated = { ...index, profiles: [...index.profiles, { id, name: name.trim() || "Profile" }] };
      await writeIndex(updated);
      applyIndex(updated);
      await switchProfile(id);
      return true;
    },
    [applyIndex, switchProfile],
  );

  const renameProfile = useCallback(
    async (id: string, name: string) => {
      if (!writable.current || slot.current !== "real") return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const index = await readIndex();
      const updated = { ...index, profiles: index.profiles.map((p) => (p.id === id ? { ...p, name: trimmed } : p)) };
      await writeIndex(updated);
      applyIndex(updated);
    },
    [applyIndex],
  );

  const deleteProfile = useCallback(
    async (id: string) => {
      if (!writable.current || slot.current !== "real" || id === activeIdRef.current) return;
      const index = await readIndex();
      if (index.profiles.length < 2) return;
      // The index first: a crash in between leaves the doc orphaned but never
      // an index row that points at a missing document.
      const profilesNext = index.profiles.filter((p) => p.id !== id);
      const updated = { activeId: index.activeId, profiles: profilesNext };
      await writeIndex(updated);
      applyIndex(updated);
      await storage.removeItem(profileDocKey(id));
    },
    [applyIndex],
  );

  const wipeDeviceData = useCallback(async () => {
    writable.current = false;
    if (timer.current) clearTimeout(timer.current);
    writeGen.current += 1;
    const index = await readIndex();
    await Promise.all([
      ...index.profiles.map((p) => storage.removeItem(profileDocKey(p.id))),
      storage.removeItem(DECOY_DB_KEY),
      secureStorage.removeItem(PROFILE_INDEX_KEY),
      clearPin(),
      clearFailures(),
    ]);
    await replaceStoredDocument(DB_KEY, LEGACY_DB_KEY, JSON.stringify(emptyDB()));
    dropLegacyAfterSave.current = false;
    slot.current = "real";
    const fresh = defaultProfileIndex();
    applyIndex(fresh);
    setSession("real");
    writable.current = true;
    setUnreadable(false);
    setDb(emptyDB());
    setReady(true);
  }, [applyIndex]);

  const wipeVisible = useCallback(async () => {
    if (slot.current === "decoy") {
      const next = buildDecoyDB(dbRef.current);
      setDb(next);
      return;
    }
    await wipeDeviceData();
  }, [wipeDeviceData]);

  const value = useMemo(
    () => ({
      db,
      ready,
      unreadable,
      session,
      profiles,
      activeProfileId,
      retryLoad,
      discardUnreadable,
      update,
      applySync,
      localChangeAt,
      setSettings,
      replace,
      openReal,
      openDecoy,
      prepareDecoy,
      addProfile,
      switchProfile,
      renameProfile,
      deleteProfile,
      wipeVisible,
      wipeDeviceData,
    }),
    [
      db,
      ready,
      unreadable,
      session,
      profiles,
      activeProfileId,
      retryLoad,
      discardUnreadable,
      update,
      applySync,
      localChangeAt,
      setSettings,
      replace,
      openReal,
      openDecoy,
      prepareDecoy,
      addProfile,
      switchProfile,
      renameProfile,
      deleteProfile,
      wipeVisible,
      wipeDeviceData,
    ],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const s = useContext(StoreContext);
  if (!s) throw new Error("StoreProvider missing");
  return s;
}

export const useModuleEnabled = (id: string) => useStore().db.settings.modules.find((m) => m.id === id)?.enabled ?? false;
