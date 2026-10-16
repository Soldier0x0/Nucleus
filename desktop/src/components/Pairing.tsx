import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { pairQrPayload, removePairedDevice } from "@core/pairing";
import { syncStatusLine } from "@core/syncStatus";
import type { PairedDevice } from "@core/types";
import { useStore } from "../store";
import { isTauri } from "../platform/env";
import { randomBytes } from "../platform/crypto";
import { QrCode } from "./QrCode";
import { newDesktopSyncIdentity, readDesktopSync, rememberPublicIdentity, withDesktopSync } from "../sync/identity";
import { desktopHostname, ensureSyncServer, type SyncServerStart, type SyncServerStatus } from "../sync/server";
import { forgetSyncSummary, setPairCode, subscribeSyncSummaries, syncSummaries } from "../sync/runtime";

function randomCode(): string {
  const n = randomBytes(4);
  const value = ((n[0] << 24) >>> 0) + (n[1] << 16) + (n[2] << 8) + n[3];
  return String(value % 1_000_000).padStart(6, "0");
}

export function Pairing() {
  const { db, update } = useStore();
  const identity = readDesktopSync(db);
  const deviceId = identity?.deviceId ?? "";
  const [server, setServer] = useState<SyncServerStart | null>(null);
  const [status, setStatus] = useState<SyncServerStatus | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const summaries = useSyncExternalStore(subscribeSyncSummaries, syncSummaries);
  const now = new Date().toISOString();
  const devices = db.settings.pairedDevices ?? [];

  useEffect(() => {
    if (!isTauri() || deviceId) return;
    let alive = true;
    (async () => {
      const name = ((await desktopHostname().catch(() => null)) ?? "Nucleus Desktop").trim().slice(0, 40) || "Nucleus Desktop";
      if (!alive) return;
      const created = newDesktopSyncIdentity(name);
      rememberPublicIdentity(created);
      update((d) => (readDesktopSync(d) ? d : withDesktopSync(d, created)));
    })().catch(() => alive && setMsg("Could not set up the sync identity on this computer."));
    return () => {
      alive = false;
    };
  }, [deviceId, update]);

  useEffect(() => {
    if (identity) rememberPublicIdentity(identity);
  }, [deviceId]);

  useEffect(() => {
    if (!identity || !isTauri()) return;
    let alive = true;
    setMsg("");
    (async () => {
      try {
        const next = await ensureSyncServer(identity);
        if (!alive) return;
        setStatus(next);
        setServer(next.running && next.host && next.port ? { host: next.host, port: next.port, name: identity.name, deviceId: identity.deviceId } : null);
      } catch (err) {
        if (alive) setMsg(err instanceof Error ? err.message : "Could not start the sync server.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [deviceId]);

  useEffect(() => {
    if (deviceId) setCode(randomCode());
  }, [deviceId]);

  useEffect(() => {
    setPairCode(code || null);
    return () => setPairCode(null);
  }, [code]);

  const qrText = useMemo(() => {
    if (!identity || !server || !code) return "";
    return pairQrPayload({ deviceId: identity.deviceId, name: identity.name, publicKey: identity.publicKey, host: server.host, port: server.port, code });
  }, [identity, server, code]);

  const remove = (device: PairedDevice) => {
    if (!window.confirm(`Remove ${device.name}? It must be paired again before it can sync.`)) return;
    update((d) => removePairedDevice(d, device.id));
    forgetSyncSummary(device.id);
  };

  if (!isTauri()) {
    return (
      <section className="card">
        <h2>Pair a phone</h2>
        <p className="muted">Phone sync needs the installed desktop app; the browser preview has no local server.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Pair a phone</h2>
      <p className="muted">Open Nucleus on the phone, go to its Sync screen and scan this code. Both apps stay open on the same Wi-Fi.</p>
      {msg ? <p className="error">{msg}</p> : null}
      {!identity ? (
        <p className="muted">Setting up this computer's sync identity…</p>
      ) : !server ? (
        <p className="muted">Starting the sync server…</p>
      ) : (
        <div className="pair-layout">
          <div className="qr-box">
            <QrCode text={qrText} />
          </div>
          <div className="pair-side">
            <div className="pair-code">{code}</div>
            <p className="muted small">Type this six-digit code on the phone if the camera cannot scan the code.</p>
            <p className="muted small">
              Manual address: <code>{server.host}:{server.port}</code>
            </p>
            <div className="row">
              <button className="small-btn" onClick={() => setCode(randomCode())}>New code</button>
              <span className={status?.running ? "chip on" : "chip"}>{status?.running ? "Server on" : "Server off"}</span>
            </div>
          </div>
        </div>
      )}
      <hr />
      <h3>Paired devices</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Device</th>
            <th>Last sync</th>
            <th>Last round</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {devices.length === 0 ? (
            <tr>
              <td colSpan={4} className="muted">No phones paired yet.</td>
            </tr>
          ) : (
            devices.map((device) => {
              const summary = summaries[device.id];
              return (
                <tr key={device.id}>
                  <td>{device.name}</td>
                  <td>{device.lastSyncAt ? syncStatusLine(device.lastSyncAt, now) : "Not synced yet"}</td>
                  <td>{summary ? `${summary.inCount} in, ${summary.outCount} out` : "—"}</td>
                  <td className="right">
                    <button className="small-btn" onClick={() => remove(device)}>Remove</button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </section>
  );
}
