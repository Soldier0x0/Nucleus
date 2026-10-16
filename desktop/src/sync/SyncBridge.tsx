import { useEffect, useRef } from "react";
import { useStore } from "../store";
import { isTauri } from "../platform/env";
import { readDesktopSync } from "./identity";
import { setSyncRuntime } from "./runtime";
import { ensureSyncServer } from "./server";

/** No UI: keeps the HTTP handler wired to the live document and the server up. */
export function SyncBridge() {
  const { db, applySync } = useStore();
  const dbRef = useRef(db);
  dbRef.current = db;
  const deviceId = readDesktopSync(db)?.deviceId ?? "";

  useEffect(() => {
    setSyncRuntime({
      identity: () => readDesktopSync(dbRef.current),
      db: () => dbRef.current,
      apply: applySync,
    });
    return () => setSyncRuntime(null);
  }, [applySync]);

  useEffect(() => {
    const identity = readDesktopSync(dbRef.current);
    if (!identity || !isTauri()) return;
    void ensureSyncServer(identity).catch(() => {});
  }, [deviceId]);

  return null;
}
