import { useEffect, useRef, useState } from "react";
import { ScreenToolbar } from "../components/ScreenToolbar";
import { confirmDialog } from "../components/Dialog";
import { useStore } from "../store";
import { MODULES } from "@core/modules";
import { countsOf } from "@core/merge";
import { isValidPin } from "../platform/security";
import { WrongPinError, changeSecurePin, lockSecure } from "../platform/secure";
import { applyThemePref, storedThemePref, THEME_KEY } from "../platform/theme";
import { autostartEnabled, autostartSet } from "../platform/autostart";
import { localPrefs } from "../platform/storage";
import { backupFileName, decryptBackup, exportBackup, parseBackup, type BackupFile, type PickedBackup } from "../platform/backup";
import { EXPORT_KINDS, exportFileName, exportKindFile } from "../platform/exporters";
import { passwordStrength } from "../platform/crypto";
import { isTauri } from "../platform/env";
import { checkForUpdateNow, friendlyUpdateError } from "../platform/updater";
import { BMC_URL, SPONSORS_URL, openExternal } from "../platform/support";
import { APP_VERSION } from "../App";
import { Pairing } from "../components/Pairing";
import type { ModuleId } from "@core/types";

// The desktop truth (v0.16): every module the phone has has a real screen
// here, so every row below is an ordinary switch in the sidebar's order.
const SECTION_ORDER: ModuleId[] = ["money", "vehicles", "health", "cycle", "home", "travel", "papers", "notes", "media", "kanban", "tools", "rules", "dev", "builder", "net", "lab"];

export function Settings() {
  const { db, setSettings, replace } = useStore();
  const [theme, setTheme] = useState(storedThemePref());
  const [pinDraft, setPinDraft] = useState({ current: "", next: "", again: "" });
  const [pinMsg, setPinMsg] = useState("");
  const [exportPw, setExportPw] = useState("");
  const [dataMsg, setDataMsg] = useState("");
  const [pending, setPending] = useState<{ picked: PickedBackup & { kind: "encrypted" }; name: string } | null>(null);
  const [importPw, setImportPw] = useState("");
  const [startWithPc, setStartWithPc] = useState(false);
  const [startMsg, setStartMsg] = useState("");
  const [updMsg, setUpdMsg] = useState("");
  const [updBusy, setUpdBusy] = useState(false);
  const importInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    applyThemePref(theme);
    localPrefs.set(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    void autostartEnabled().then(setStartWithPc).catch(() => {});
  }, []);

  const toggleAutostart = async (on: boolean) => {
    setStartMsg("");
    try {
      await autostartSet(on);
      setStartWithPc(await autostartEnabled());
      setStartMsg(on ? "Nucleus starts with this computer." : "Nucleus will not start with this computer.");
    } catch (err) {
      setStartMsg(err instanceof Error ? err.message : "Could not change that setting.");
    }
  };

  const checkForUpdate = async () => {
    setUpdBusy(true);
    try {
      await checkForUpdateNow(setUpdMsg);
    } catch (err) {
      setUpdMsg(friendlyUpdateError(err));
    } finally {
      setUpdBusy(false);
    }
  };

  const changePin = async () => {
    setPinMsg("");
    if (!isValidPin(pinDraft.next)) return setPinMsg("The new PIN needs at least 4 digits.");
    if (pinDraft.next !== pinDraft.again) return setPinMsg("The new PINs do not match.");
    try {
      await changeSecurePin(pinDraft.current, pinDraft.next);
      setPinDraft({ current: "", next: "", again: "" });
      setPinMsg("PIN changed.");
    } catch (err) {
      setPinMsg(err instanceof WrongPinError ? "The current PIN is wrong." : err instanceof Error ? err.message : "Could not change the PIN.");
    }
  };

  const doExport = async (withPassword: boolean) => {
    setDataMsg("");
    if (withPassword && exportPw.length < 6) return setDataMsg("Use at least 6 characters for the backup password.");
    try {
      const name = await exportBackup(db, withPassword ? exportPw : undefined);
      setDataMsg(name ? `Saved ${name}.` : "Export cancelled.");
    } catch (err) {
      setDataMsg(err instanceof Error ? err.message : "Export failed.");
    }
  };

  const exportOne = async (kind: (typeof EXPORT_KINDS)[number]["kind"]) => {
    setDataMsg("");
    try {
      const name = await exportKindFile(db, kind);
      setDataMsg(name ? `Saved ${name}.` : "Export cancelled.");
    } catch (err) {
      setDataMsg(err instanceof Error ? err.message : "Export failed.");
    }
  };

  const acceptImport = async (file: BackupFile, name: string) => {
    const counts = file.counts ?? countsOf(file.data);
    const summary = Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`).join(", ") || "nothing";
    if (
      !(await confirmDialog({
        title: `Restore "${name}"?`,
        body: `Replaces the document on this computer. It contains ${summary}. The current document is overwritten.`,
        confirmLabel: "Replace",
        danger: true,
      }))
    ) {
      setPending(null);
      return;
    }
    replace(file.data);
    setPending(null);
    setImportPw("");
    setDataMsg(`Imported ${name}. Changes are saved as you edit.`);
  };

  const pickImport = async (file: File) => {
    setDataMsg("");
    setPending(null);
    try {
      const picked = parseBackup(await file.text());
      if (picked.kind === "encrypted") {
        setPending({ picked, name: file.name });
        return;
      }
      acceptImport(picked.file, file.name);
    } catch (err) {
      setDataMsg(err instanceof Error ? err.message : "Could not read this file.");
    }
  };

  const unlockImport = async () => {
    if (!pending) return;
    setDataMsg("");
    try {
      const file = await decryptBackup(pending.picked.env, importPw);
      acceptImport(file, pending.name);
    } catch (err) {
      setDataMsg(err instanceof Error ? err.message : "Could not decrypt this backup.");
    }
  };

  const toggleModule = (id: ModuleId, enabled: boolean) => {
    setSettings({ modules: db.settings.modules.map((m) => (m.id === id ? { ...m, enabled } : m)) });
  };

  return (
    <>
      <ScreenToolbar>
        <div>
          <p className="caption">Everything the desktop keeps lives here · v{APP_VERSION}</p>
          <h1>Settings</h1>
        </div>
      </ScreenToolbar>
      <div className="workcol">
        <div className="settings-grid">
          <section className="card st-general">
            <h2>General</h2>
            <label className="switch">
              <input type="checkbox" checked={startWithPc} disabled={!isTauri()} onChange={(e) => void toggleAutostart(e.target.checked)} />
              <span>Start with this computer</span>
            </label>
            {startMsg ? <p className="muted small" data-testid="autostart-note">{startMsg}</p> : null}
            {!isTauri() ? <p className="muted small">Available in the installed app.</p> : null}
          </section>

          <section className="card st-look">
            <h2>Look</h2>
            <label className="field"><span>Theme</span>
              <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                <option value="system">Follow the system</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label className="field"><span>Distance unit</span>
              <select value={db.settings.distanceUnit} onChange={(e) => setSettings({ distanceUnit: e.target.value as "km" | "mi" })}>
                <option value="km">Kilometres</option>
                <option value="mi">Miles</option>
              </select>
            </label>
          </section>

          <section className="card st-security">
            <h2>Security</h2>
            <p className="muted">The PIN opens the key store on this computer. The document is always encrypted with that key.</p>
            <label className="field"><span>Current PIN</span><input type="password" inputMode="numeric" value={pinDraft.current} onChange={(e) => setPinDraft({ ...pinDraft, current: e.target.value.replace(/\D+/g, "") })} /></label>
            <label className="field"><span>New PIN</span><input type="password" inputMode="numeric" value={pinDraft.next} onChange={(e) => setPinDraft({ ...pinDraft, next: e.target.value.replace(/\D+/g, "") })} /></label>
            <label className="field"><span>Repeat new PIN</span><input type="password" inputMode="numeric" value={pinDraft.again} onChange={(e) => setPinDraft({ ...pinDraft, again: e.target.value.replace(/\D+/g, "") })} /></label>
            {pinMsg ? <p className={pinMsg === "PIN changed." ? "ok-text" : "error"}>{pinMsg}</p> : null}
            <div className="row">
              <button className="primary" onClick={changePin} disabled={!pinDraft.current || !pinDraft.next}>Change PIN</button>
              <button className="small-btn" onClick={() => { lockSecure(); window.location.reload(); }}>Lock now</button>
            </div>
          </section>

          <div className="st-devices">
            <Pairing />
          </div>

          <section className="card st-backup">
            <h2>Backup</h2>
            <p className="muted">Files match the phone format, so a phone backup opens here and this export opens on the phone.</p>
            <div className="row">
              <button className="primary" onClick={() => doExport(false)}>Export backup</button>
              <input type="password" placeholder="Password (min 6)" value={exportPw} onChange={(e) => setExportPw(e.target.value)} />
              <button className="small-btn" onClick={() => doExport(true)} disabled={exportPw.length < 6}>Export encrypted</button>
            </div>
            {exportPw ? <p className="muted small">{passwordStrength(exportPw).label} — {passwordStrength(exportPw).hint}</p> : null}
            <hr />
            <div className="row">
              <button className="primary" onClick={() => importInput.current?.click()}>Import backup…</button>
              <input ref={importInput} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void pickImport(f); }} />
            </div>
            {pending ? (
              <div className="row">
                <input type="password" placeholder={`Password for ${pending.name}`} value={importPw} onChange={(e) => setImportPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && unlockImport()} />
                <button className="primary" onClick={unlockImport} disabled={!importPw}>Unlock backup</button>
              </div>
            ) : null}
            {dataMsg ? <p className={dataMsg.startsWith("Imported") || dataMsg.startsWith("Saved") ? "ok-text" : "error"}>{dataMsg}</p> : null}
            <details className="why">
              <summary>Document info</summary>
              <table className="facts">
                <tbody>
                  {Object.entries(countsOf(db)).filter(([, n]) => n > 0).map(([k, n]) => (
                    <tr key={k}><td>{k}</td><td>{n}</td></tr>
                  ))}
                  <tr><td>Install id</td><td>{db.settings.installId ?? "—"}</td></tr>
                  <tr><td>Saved by</td><td>{isTauri() ? "this computer" : "browser preview"}</td></tr>
                  <tr><td>Backup file name</td><td>{backupFileName()}</td></tr>
                </tbody>
              </table>
            </details>
          </section>

          <section className="card st-exports" data-testid="settings-exports">
            <h2>Spreadsheet exports</h2>
            <p className="muted">Same columns as the phone exports — open them in a spreadsheet or Numbers.</p>
            <div className="row">
              {EXPORT_KINDS.map(({ kind, label, ext }) => (
                <button key={kind} className="small-btn" onClick={() => void exportOne(kind)} title={exportFileName(kind)}>
                  {label} ({ext})
                </button>
              ))}
            </div>
          </section>

          <section className="card st-sections">
            <h2>Sections</h2>
            <p className="muted">Every module runs here as well as on the phone. Switch one off and its sidebar section goes with it.</p>
            <table className="table">
              <tbody>
                {[...MODULES].sort((a, b) => SECTION_ORDER.indexOf(a.id as ModuleId) - SECTION_ORDER.indexOf(b.id as ModuleId)).map((m) => {
                  const id = m.id as ModuleId;
                  const state = db.settings.modules.find((x) => x.id === id);
                  return (
                    <tr key={m.id}>
                      <td>{m.name}</td>
                      <td className="right">
                        <label className="switch" data-testid={`settings-module-${id}`}>
                          <input type="checkbox" checked={state?.enabled ?? true} onChange={(e) => toggleModule(id, e.target.checked)} />
                          <span>On desktop</span>
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="card st-about">
            <h2>About</h2>
            <ul className="aboutlist">
              <li><span className="logo" style={{ width: 20, height: 20 }}></span><b>Nucleus v{APP_VERSION}</b> — the desktop of your phone vault.</li>
              <li>Everything lives in one encrypted file saved as you edit. No account, no cloud, no ads.</li>
              <li>Sync runs peer-to-peer with the phone over your own Wi-Fi.</li>
              <li>Desktop today: Today, Attention, Money, Vehicles, Health, Cycle, Home, Travel, Papers, Notes, Media, Tools, Rules, Dev Tools, Tool Builder, Network, Lab, Settings, Dev Lab (Ctrl+Alt+D).</li>
            </ul>
            {isTauri() ? (
              <div className="row" style={{ marginTop: 10 }}>
                <button className="small-btn" onClick={() => void checkForUpdate()} disabled={updBusy} data-testid="settings-check-update">
                  {updBusy ? "Checking…" : "Check for updates"}
                </button>
                {updMsg ? <span className="muted small" data-testid="settings-update-msg">{updMsg}</span> : null}
              </div>
            ) : null}
            <div className="row" style={{ marginTop: 10 }}>
              <button
                className="small-btn"
                onClick={() => void openExternal(BMC_URL)}
                title="buymeacoffee.com/soldier0x0"
                data-testid="settings-support-bmc"
              >
                <svg
                  className="ic"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  style={{ width: 13, height: 13, verticalAlign: -2, marginRight: 5 }}
                >
                  {/* the same cup as the sidebar row — glyphs, not emoji */}
                  <path d="M4 9h11v5.2A4.8 4.8 0 0 1 10.2 19H8.8A4.8 4.8 0 0 1 4 14.2Z" />
                  <path d="M15 10.4h2.1a2.4 2.4 0 0 1 0 4.8H15" />
                  <path d="M7.5 5.5v1.8M10.5 5.5v1.8" />
                </svg>
                Buy me a coffee
              </button>
              <button
                className="small-btn"
                onClick={() => void openExternal(SPONSORS_URL)}
                title="github.com/sponsors/Soldier0x0"
                data-testid="settings-support-sponsors"
              >
                Sponsor on GitHub
              </button>
              <span className="muted small">Keeps the builds and updates coming — thank you.</span>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
