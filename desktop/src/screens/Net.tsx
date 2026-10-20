import { useEffect, useState } from "react";
import { useStore } from "../store";
import { uid } from "@core/format";
import type { NetLogEntry } from "@core/types";
import { lookupDns, pingHost, startLanScan, stopLanScan, subscribeLan } from "../platform/net";
import type { LanEvent } from "../platform/net";

/**
 * Network on desktop: ping, DNS and a private-subnet scan, same as the
 * phone's module. Results are not saved; the run log on this screen is
 * the shared online log so the Search record can find past checks.
 */
export function Net() {
  const { db, update } = useStore();
  const online = db.settings.online;
  const [host, setHost] = useState("");
  const [ping, setPing] = useState("");
  const [dns, setDns] = useState("");
  const [busy, setBusy] = useState<"ping" | "dns" | null>(null);
  const [scanning, setScanning] = useState(false);
  const [checked, setChecked] = useState(0);
  const [hosts, setHosts] = useState<string[]>([]);
  const [scanNote, setScanNote] = useState("");

  const log = (entry: NetLogEntry) => update((d) => ({ ...d, netlog: [entry, ...d.netlog].slice(0, 200) }));

  useEffect(() => {
    let remove: ((this: unknown) => void) | null = null;
    subscribeLan((event: LanEvent) => {
      if (event.type === "host" && event.ip) setHosts((list) => (list.includes(event.ip!) ? list : [...list, event.ip!].sort()));
      if (event.type === "progress") setChecked(event.checked ?? 0);
      if (event.type === "done") {
        setScanning(false);
        setScanNote(`${event.found ?? 0} answered`);
      }
      if (event.type === "error") {
        setScanning(false);
        setScanNote(event.message ?? "The scan stopped.");
      }
    })
      .then((fn) => {
        remove = fn;
      })
      .catch(() => {});
    return () => {
      remove?.();
      void stopLanScan();
    };
  }, []);

  const runPing = async () => {
    setBusy("ping");
    setPing("");
    try {
      const result = await pingHost(host);
      log({ id: uid(), at: new Date().toISOString(), service: "Ping", query: host.trim(), ok: result.ok });
      setPing(result.ok ? `${result.detail} · ${result.ms} ms` : result.detail);
    } catch (e) {
      setPing(typeof e === "string" ? e : e instanceof Error && e.message ? e.message : "No reply");
    } finally {
      setBusy(null);
    }
  };

  const runDns = async () => {
    setBusy("dns");
    setDns("");
    try {
      const result = await lookupDns(host);
      log({ id: uid(), at: new Date().toISOString(), service: "DNS", query: host.trim(), ok: true });
      setDns(result.addresses.join("\n") || "No address");
    } catch (e) {
      log({ id: uid(), at: new Date().toISOString(), service: "DNS", query: host.trim(), ok: false });
      setDns(typeof e === "string" ? e : e instanceof Error && e.message ? e.message : "That name did not resolve.");
    } finally {
      setBusy(null);
    }
  };

  const toggleScan = () => {
    if (scanning) {
      void stopLanScan();
      setScanning(false);
      return;
    }
    setHosts([]);
    setChecked(0);
    setScanNote("");
    void startLanScan()
      .then((started) => {
        setScanning(started);
        if (started) log({ id: uid(), at: new Date().toISOString(), service: "This network", query: "private subnet", ok: true });
        else setScanNote("The scan did not start.");
      })
      .catch((e) => setScanNote(typeof e === "string" ? e : e instanceof Error && e.message ? e.message : "The scan did not start."));
  };

  return (
    <div className="topbar">
      <div className="workcol two-stack">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Checks</h2>
          <p className="muted small">
            Online has to be on. A ping or a DNS lookup sends only the name you type. Nothing from the checks is saved to the document.
          </p>
          {!online ? <p className="small" style={{ color: "var(--warn)" }}>Turn Online on in Settings. No check runs while it is off.</p> : null}
          <div className="field inline">
            <span>Name or address</span>
            <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="moto.local or 192.168.1.15" />
          </div>
          <div className="add-row">
            <button disabled={!online || !host.trim() || busy != null} onClick={() => void runPing()}>
              {busy === "ping" ? "Pinging…" : "Ping"}
            </button>
            <button disabled={!online || !host.trim() || busy != null} onClick={() => void runDns()}>
              {busy === "dns" ? "Looking…" : "DNS"}
            </button>
          </div>
          {ping ? <p className="mono" style={{ whiteSpace: "pre-wrap" }}>{ping}</p> : null}
          {dns ? <p className="mono" style={{ whiteSpace: "pre-wrap" }}>{dns}</p> : null}
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>This network</h2>
          <p className="muted small">
            The scan looks at this computer's own private network, and only while this screen is open. Devices that do not answer on a common port stay hidden.
          </p>
          <div className="add-row">
            <button className={scanning ? "danger-btn" : ""} disabled={!online && !scanning} onClick={toggleScan} data-testid="net-scan">
              {scanning ? "Stop scan" : "Scan this network"}
            </button>
            <button onClick={() => setHosts([])}>Clear list</button>
          </div>
          {scanning ? <p className="muted small">Checked {checked}</p> : null}
          {scanNote ? <p className="small" data-testid="net-scan-note">{scanNote}</p> : null}
          {hosts.map((ip) => (
            <p key={ip} className="mono" style={{ margin: "2px 0" }}>
              {ip}
            </p>
          ))}
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Recent runs</h2>
          {db.netlog.slice(0, 8).map((entry) => (
            <div key={entry.id} className="row small" style={{ padding: "4px 0" }}>
              <span className="mono">{entry.at.slice(11, 16)}</span>
              <span>{entry.service}</span>
              <span className="grow mono">{entry.query}</span>
              <span className={entry.ok ? "pos" : ""} style={{ color: entry.ok ? undefined : "var(--error)" }}>{entry.ok ? "ok" : "no"}</span>
            </div>
          ))}
          {db.netlog.length === 0 ? <p className="muted small">Nothing yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
