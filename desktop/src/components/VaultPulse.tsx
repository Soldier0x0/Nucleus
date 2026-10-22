import { memo, useEffect, useRef, useState } from "react";
import { sha256 } from "@noble/hashes/sha2";

/**
 * The vault fingerprint (the shell's signature moment): the desktop document's
 * SHA-256 digest, abbreviated to 8 hex digits and set in JetBrains Mono next to
 * the sync line. It makes the "one encrypted file" promise visible — the digits
 * move the moment the document does, and stay put when nothing changed. Click
 * copies the full digest. Calm by rule: no ambient loop, one 200ms tick when the
 * hash changes, reduced-motion users get the same info without any pulse.
 */

const DIGITS = 8;

function digestOf(value: unknown): string {
  const bytes = new TextEncoder().encode(value as string);
  return Array.from(sha256(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Keep the JSON stable across runs — the same document must hash the same. */
function canonical(db: unknown): string {
  return JSON.stringify(db, (_k, v) => (v === undefined ? null : v));
}

export const VaultPulse = memo(function VaultPulse({ db }: { db: unknown }) {
  const [hash, setHash] = useState<string>(() => digestOf(canonical(db)));
  const [, setTick] = useState(0); // re-render only for the pill pulse
  const lastHash = useRef(hash);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = digestOf(canonical(db));
      if (next !== lastHash.current) {
        lastHash.current = next;
        setHash(next);
        setTick((n) => n + 1);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [db]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lastHash.current);
      setTick((n) => n + 1);
    } catch {
      /* clipboard can refuse; the pill is not critical */
    }
  };

  return (
    <button
      className="vault-pulse"
      onClick={() => void copy()}
      title="Vault fingerprint — SHA-256. Moves whenever the file changes; click copies the full digest."
      data-testid="vault-fingerprint"
    >
      <span className="vp-hash" spellCheck={false}>
        {hash.slice(0, DIGITS)}
      </span>
      <span className="vp-dot" key={hash} aria-hidden="true"></span>
    </button>
  );
});
