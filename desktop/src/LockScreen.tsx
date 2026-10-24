/**
 * PIN lock: first run can set a 4+ digit PIN or skip (optional lock, v0.18);
 * every launch asks for the PIN when one is set. The PIN opens the Stronghold
 * vault; with no PIN the app opens straight to the data.
 */
import { useEffect, useState } from "react";
import { PIN_MIN_DIGITS, backoffLabel, backoffRemainingMs, isValidPin } from "./platform/security";
import { WrongPinError, createSecure, readBackoff, registerFailure, clearFailures, resetSecure, unlockSecure } from "./platform/secure";
import { confirmDialog } from "./components/Dialog";
import { WinControls } from "./components/WinControls";

function digitsOnly(value: string) {
  return value.replace(/\D+/g, "").slice(0, 12);
}

export function LockScreen({ mode, onUnlocked }: { mode: "create" | "unlock"; onUnlocked: () => void }) {
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [waitMs, setWaitMs] = useState(0);

  useEffect(() => {
    if (mode !== "unlock") return;
    let timer: ReturnType<typeof setInterval> | null = null;
    readBackoff().then((b) => setWaitMs(backoffRemainingMs(b))).catch(() => {});
    timer = setInterval(async () => {
      try {
        const remaining = backoffRemainingMs(await readBackoff());
        setWaitMs(remaining);
      } catch {
        /* keep ticking */
      }
    }, 1000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || waitMs > 0) return;
    setError("");
    if (!isValidPin(pin)) {
      setError(`Use at least ${PIN_MIN_DIGITS} digits.`);
      return;
    }
    setBusy(true);
    try {
      if (mode === "create") {
        if (pin !== again) {
          setError("The two PINs do not match.");
          return;
        }
        await createSecure(pin);
        onUnlocked();
        return;
      }
      await unlockSecure(pin);
      await clearFailures();
      onUnlocked();
    } catch (err) {
      setPin("");
      if (err instanceof WrongPinError) {
        const backoff = await registerFailure();
        setWaitMs(backoffRemainingMs(backoff));
        setError(backoffRemainingMs(backoff) > 0 ? `Too many tries. Wait ${backoffLabel(backoffRemainingMs(backoff))}.` : "Wrong PIN.");
      } else {
        setError(err instanceof Error ? err.message : "Could not unlock.");
      }
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (
      !(await confirmDialog({
        title: "Erase this computer?",
        body: "This erases the PIN, the key and the document on this computer. Backups are not touched.",
        confirmLabel: "Erase",
        danger: true,
      }))
    )
      return;
    await resetSecure();
    window.location.reload();
  };

  const skip = async () => {
    if (
      !(await confirmDialog({
        title: "Open without a PIN?",
        body: "Nucleus opens straight to your data on this computer, and anyone who uses this computer can read it. The saved document stays encrypted either way. You can add a PIN later in Settings → Security.",
        confirmLabel: "Open without a PIN",
      }))
    )
      return;
    try {
      await createSecure(null);
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set up the key store.");
    }
  };

  return (
    <div className="lock-wrap">
      <WinControls overlay />
      <form className="lock-card" onSubmit={submit}>
        <div className="lock-brand">Nucleus</div>
        <p className="muted">{mode === "create" ? "Choose a PIN for this computer. It is asked every time Nucleus opens." : "Enter your PIN to unlock."}</p>
        <label className="field">
          <span>PIN</span>
          <input
            data-testid="pin-input"
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => setPin(digitsOnly(e.target.value))}
            placeholder={`${PIN_MIN_DIGITS}+ digits`}
          />
        </label>
        {mode === "create" ? (
          <label className="field">
            <span>Repeat PIN</span>
            <input
              data-testid="pin-again"
              type="password"
              inputMode="numeric"
              value={again}
              onChange={(e) => setAgain(digitsOnly(e.target.value))}
              placeholder={`${PIN_MIN_DIGITS}+ digits`}
            />
          </label>
        ) : null}
        {error ? <p className="error" data-testid="lock-error">{error}</p> : null}
        <button className="primary" type="submit" disabled={busy || waitMs > 0 || pin.length < PIN_MIN_DIGITS}>
          {mode === "create" ? "Create PIN" : waitMs > 0 ? `Wait ${backoffLabel(waitMs)}` : "Unlock"}
        </button>
        { mode === "unlock" ? (
          <button className="link danger" type="button" onClick={reset}>
            Forgot the PIN? Reset this computer
          </button>
        ) : null}
        {mode === "create" ? (
          <button className="link" type="button" data-testid="lock-skip-pin" onClick={() => void skip()}>
            Skip — open without a PIN
          </button>
        ) : null}
        <p className="muted small">Your data stays on this computer. There is no recovery if the PIN and backups are lost.</p>
      </form>
    </div>
  );
}
