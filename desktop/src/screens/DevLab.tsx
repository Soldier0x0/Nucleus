import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "../store";
import { countsOf } from "@core/merge";
import { JOURNAL_CAP, JOURNAL_DAYS } from "@core/journal";
import { readDesktopSync } from "../sync/identity";
import { desktopHostname, desktopLanIp, syncServerStatus } from "../sync/server";
import { syncSummaries } from "../sync/runtime";
import { isTauri } from "../platform/env";

/**
 * Dev Lab (v0.14): the hidden developer screen. Not in the sidebar —
 * Ctrl+Alt+D or the palette reach it. Read-only views over the document and
 * the sync transport, plus a copyable debug snapshot.
 */
export function DevLab() {
  const { db } = useStore();
  const [status, setStatus] = useState<{ running: boolean; host: string | null; port: number | null } | null>(null);
  const [lanIp, setLanIp] = useState<string | null>(null);
  const [host, setHost] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    void syncServerStatus().then(setStatus).catch(() => {});
    void desktopLanIp().then(setLanIp).catch(() => {});
    void desktopHostname().then(setHost).catch(() => {});
  }, []);

  const counts = useMemo(() => countsOf(db), [db]);
  const identity = readDesktopSync(db);
  const summaries = syncSummaries();
  const tombstones = Object.keys(db.tombstones ?? {}).length;

  const debug = useMemo(() => {
    const lines: string[] = [
      `# Nucleus desktop debug`,
      `installId: ${db.settings.installId ?? "—"}`,
      `identity: ${identity ? `${identity.name} (${identity.deviceId.slice(0, 8)}…)` : "not paired"}`,
      `server: ${status ? (status.running ? `${status.host ?? "?"}:${status.port}` : "stopped") : isTauri() ? "…" : "browser preview"}`,
      `lanIp: ${lanIp ?? "—"} · hostname: ${host ?? "—"}`,
      `journal: ${(db.journal ?? []).length}/${JOURNAL_CAP} entries, 120-day window`,
      `tombstones: ${tombstones}`,
      ``,
      `# collections`,
      ...Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => `${k}: ${n}`),
      ``,
      `# sync summaries`,
      ...Object.entries(summaries).map(([deviceId, s]) => `${deviceId.slice(0, 8)}… in ${s.inCount} out ${s.outCount} at ${s.at}`),
    ];
    return lines.join("\n");
  }, [db, counts, identity, status, lanIp, host, tombstones, summaries]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(debug);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const rows: { label: string; value: ReactNode }[] = [
    { label: "Install id", value: db.settings.installId ?? "—" },
    { label: "Sync identity", value: identity ? `${identity.name} · ${identity.deviceId.slice(0, 12)}…` : "not paired" },
    { label: "Server", value: status ? (status.running ? `${status.host}:${status.port}` : "stopped") : isTauri() ? "…" : "browser preview" },
    { label: "LAN", value: isTauri() ? `${lanIp ?? "—"} · ${host ?? "—"}` : "browser preview" },
    { label: "Journal", value: `${(db.journal ?? []).length} entries (cap ${JOURNAL_CAP}, window ${JOURNAL_DAYS}d)` },
    { label: "Tombstones", value: String(tombstones) },
    { label: "Sync summaries", value: Object.keys(summaries).length ? Object.values(summaries).map((s) => `${s.inCount} in / ${s.outCount} out`).join(" · ") : "—" },
  ];

  return (
    <div className="two-stack">
      <section className="card">
        <h2>Dev Lab</h2>
        <p className="muted small">Read-only developer view. Ctrl+Alt+D or the palette opens this; it is never in the sidebar.</p>
        <table className="table wide">
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}><td className="muted">{r.label}</td><td>{r.value}</td></tr>
            ))}
            {Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => (
              <tr key={k}><td className="muted">{k}</td><td>{n}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="row">
          <button className="small-btn" onClick={() => void copy()}>{copied ? "Copied" : "Copy debug snapshot"}</button>
        </div>
      </section>
      <section className="card">
        <h3>Debug snapshot</h3>
        <pre className="debug-pre">{debug}</pre>
      </section>
    </div>
  );
}
