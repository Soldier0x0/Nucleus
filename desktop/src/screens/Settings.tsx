import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { MODULES } from "@core/modules";
import { countsOf } from "@core/merge";
import { isValidPin } from "../platform/security";
import { WrongPinError, changeSecurePin, lockSecure } from "../platform/secure";
import { applyThemePref, storedThemePref, THEME_KEY } from "../platform/theme";
import { localPrefs } from "../platform/storage";
import { backupFileName, decryptBackup, exportBackup, parseBackup, type BackupFile, type PickedBackup } from "../platform/backup";
import { passwordStrength } from "../platform/crypto";
import { isTauri } from "../platform/env";
import { Pairing } from "../components/Pairing";
import type { ModuleId } from "@core/types";

const DESKTOP_MODULES: ModuleId[] = ["vehicles", "money", "papers", "notes", "kanban", "wiki"];
const PHONE_ONLY: ModuleId[] = ["lab", "net", "cycle", "health"];

export function Settings() {
  const { db, setSettings, replace } = useStore();
  const [theme, setTheme] = useState(storedThemePref());
  const [pinDraft, setPinDraft] = useState({ current: "", next: "", again: "" });
  const [pinMsg, setPinMsg] = useState("");
  const [exportPw, setExportPw] = useState("");
  const [dataMsg, setDataMsg] = useState("");
  const [pending, setPending] = useState<{ picked: PickedBackup & { kind: "encrypted" }; name: string } | null>(null);
  const [importPw, setImportPw] = useState("");
  const importInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    applyThemePref(theme);
    localPrefs.set(THEME_KEY, theme);
  }, [theme]);

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

  const acceptImport = (file: BackupFile, name: string) => {
    const counts = file.counts ?? countsOf(file.data);
    const summary = Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`).join(", ") || "nothing";
    if (!window.confirm(`Replace the document on this computer with "${name}"?\n\nIt contains ${summary}. The current document is overwritten.`)) {
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
    <div className="stack">
      <div className="settings-grid">
        <section className="card">
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

        <section className="card">
          <h2>Look</h2>
          <label className="field"><span>Theme</span>
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">Follow the system</option>
            </select>
          </label>
          <label className="field"><span>Distance unit</span>
            <select value={db.settings.distanceUnit} onChange={(e) => setSettings({ distanceUnit: e.target.value as "km" | "mi" })}>
              <option value="km">Kilometres</option>
              <option value="mi">Miles</option>
            </select>
          </label>
        </section>

        <section className="card">
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

        <Pairing />

        <section className="card">
          <h2>Sections</h2>
          <p className="muted">Modules are shared with the phone. Phone-only modules never appear on the desktop.</p>
          <table className="table">
            <tbody>
              {MODULES.map((m) => {
                const id = m.id as ModuleId;
                const state = db.settings.modules.find((x) => x.id === id);
                const desktop = DESKTOP_MODULES.includes(id);
                const phoneOnly = PHONE_ONLY.includes(id);
                return (
                  <tr key={m.id} className={desktop ? "" : "muted"}>
                    <td>{m.name}</td>
                    <td className="right">
                      {phoneOnly ? (
                        <span className="chip">Phone only</span>
                      ) : desktop ? (
                        <label className="switch">
                          <input type="checkbox" checked={state?.enabled ?? true} onChange={(e) => toggleModule(id, e.target.checked)} />
                          <span>On desktop</span>
                        </label>
                      ) : (
                        <span className="chip">Later phase</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2>Roadmap</h2>
          <table className="table">
            <tbody>
              <tr><td><span className="chip on">D1 · now</span></td><td>Encrypted desktop editor: PIN lock, phone-format crypto, import and export, Today, Money, Vehicles, Papers, Notes/Wiki/Kanban, Settings.</td></tr>
              <tr><td><span className="chip">D2</span></td><td>Sync with the phone in both directions, with the same merge rules the phone already uses.</td></tr>
              <tr><td><span className="chip">D3</span></td><td>Files and photos: vault sync, gallery, receipts.</td></tr>
              <tr><td><span className="chip">D4</span></td><td>Packaging and polish: updates, first-run tour, performance pass.</td></tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
