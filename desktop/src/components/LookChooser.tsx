import { applyThemePref, THEME_KEY } from "../platform/theme";
import { localPrefs } from "../platform/storage";

/**
 * First launch (v0.14): follow the system and ask once which look to keep.
 * Shown after unlock, before the shell, when no theme preference was saved.
 */
export function LookChooser({ onChosen }: { onChosen: () => void }) {
  const pick = (pref: string) => {
    localPrefs.set(THEME_KEY, pref);
    applyThemePref(pref);
    onChosen();
  };

  return (
    <div className="boot look-ask" data-testid="look-chooser">
      <div className="card wide-card">
        <h2>Choose your look</h2>
        <p className="muted">You can change this any time in Settings → Look.</p>
        <div className="row">
          <button className="primary" onClick={() => pick("system")}>Follow the system</button>
          <button className="small-btn" onClick={() => pick("dark")}>Always dark</button>
          <button className="small-btn" onClick={() => pick("light")}>Always light</button>
        </div>
      </div>
    </div>
  );
}
