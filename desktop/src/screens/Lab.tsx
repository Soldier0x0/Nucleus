import { useEffect, useState } from "react";
import { ScreenToolbar } from "../components/ScreenToolbar";
import { deviceFacts } from "../platform/net";
import type { DeviceFacts } from "../platform/net";

/**
 * Lab on desktop: "with what a computer has" — the machine facts, a click
 * test and a display test. A computer has no sensors, so the sensor panel
 * says so plainly instead of pretending.
 */
export function Lab() {
  const [facts, setFacts] = useState<DeviceFacts | null>(null);
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [fill, setFill] = useState<string | null>(null);
  const [buzzNote, setBuzzNote] = useState("");

  useEffect(() => {
    let alive = true;
    const pull = () =>
      deviceFacts()
        .then((f) => alive && setFacts(f))
        .catch(() => alive && setFacts(null));
    pull();
    const id = setInterval(pull, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const buzz = async () => {
    setBuzzNote("");
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate([0, 220, 80, 220]);
      setBuzzNote("The webview asked to vibrate. A computer without vibration hardware stays silent.");
      return;
    }
    setBuzzNote("This computer has no vibration hardware.");
  };

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";

  return (
    <>
      <ScreenToolbar>
        <div>
          <p className="caption">Diagnostics for this computer · fills · dev yard</p>
          <h1>Lab</h1>
        </div>
      </ScreenToolbar>
      <div className="workcol two-stack">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>This computer</h2>
          {(
            [
              ["Name", facts?.name ?? "—"],
              ["System", facts?.osVersion ?? (ua || "—")],
              ["Cores", facts ? String(facts.cores) : "—"],
              ["Memory", facts && facts.memoryGb ? `${facts.memoryGb} GB` : "—"],
              ["Webview", ua.slice(0, 90)],
            ] as [string, string][]
          ).map(([k, v]) => (
            <div key={k} className="row small" style={{ padding: "3px 0" }}>
              <span className="muted" style={{ width: 90 }}>
                {k}
              </span>
              <span className="mono grow">{v}</span>
            </div>
          ))}
          <p className="muted small">Nothing here is stored or sent.</p>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Battery</h2>
          {facts?.battery ? (
            <>
              <div className="resultval">{facts.battery}</div>
              <div className="muted small">{facts.acPower ? "On external power." : "On battery."}</div>
              <div className="muted small">The phone's own battery notes stay on the phone.</div>
            </>
          ) : (
            <div className="muted small">This computer did not report a battery — most desktops have none.</div>
          )}
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Sensors</h2>
          <p className="muted small">
            This computer has no accelerometer, gyroscope, magnetometer, light sensor or barometer. The phone's own Phone Lab covers those; this screen shares the same engine, not the same hardware.
          </p>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Click test</h2>
          <div
            className="resultbox lab-pad"
            onMouseDown={(e) => {
              const box = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              setPoints((cur) => [...cur.slice(-60), { x: e.clientX - box.left, y: e.clientY - box.top }]);
            }}
          >
            {points.map((p, i) => (
              <span key={i} style={{ position: "absolute", left: p.x - 4, top: p.y - 4, width: 8, height: 8, borderRadius: 4, background: "var(--accent)" }} />
            ))}
          </div>
          <div className="add-row">
            <button className="small-btn" onClick={() => setPoints([])}>
              Clear
            </button>
            <button className="small-btn" onClick={() => void buzz()}>
              Vibrate
            </button>
          </div>
          {buzzNote ? <div className="muted small">{buzzNote}</div> : null}
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Display test</h2>
          <div className="add-row">
            {["#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF"].map((c) => (
              <button key={c} className="small-btn" style={{ background: c, width: 40, height: 40, border: "1px solid var(--line)" }} onClick={() => setFill(c)} aria-label={c} />
            ))}
          </div>
          <p className="muted small">Dead pixels. Click a colour to fill the screen, then click to come back.</p>
        </div>
      </div>

      {fill ? (
        <div className="fill-page" style={{ background: fill, color: fill === "#FFFFFF" || fill === "#00FF00" ? "#111418" : "#FFFFFF" }} onClick={() => setFill(null)}>
          click to return
        </div>
      ) : null}
    </>
  );
}
