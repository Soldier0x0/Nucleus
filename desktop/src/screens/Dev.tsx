import { useMemo, useState } from "react";
import { sha256 } from "@noble/hashes/sha2.js";
import { fromB64, fromUtf8, randomBytes, toB64, toUtf8 } from "../platform/crypto";

/**
 * Dev tools on desktop, like the phone's Dev module: a Base64 yard, a hash
 * yard and identity helpers. Everything runs through the same crypto stack
 * the vault uses — no second implementation appears anywhere.
 */
type Kind = "base64" | "hash" | "ids";

const grp = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");

export function Dev() {
  const [kind, setKind] = useState<Kind>("base64");

  const [encText, setEncText] = useState("");
  const [hashText, setHashText] = useState("");
  const digest = useMemo(() => (hashText ? grp(sha256(toUtf8(hashText))) : ""), [hashText]);
  const b64Out = useMemo(() => (encText ? toB64(toUtf8(encText)) : ""), [encText]);

  const [decodeIn, setDecodeIn] = useState("");
  const decodeOut = useMemo(() => {
    try {
      return fromB64(decodeIn.trim());
    } catch {
      return null;
    }
  }, [decodeIn]);

  const [ids, setIds] = useState<string[]>([]);
  const makeIds = () =>
    setIds(Array.from({ length: 6 }, () => {
      const b = randomBytes(16);
      return `${grp(b.slice(0, 4))}-${grp(b.slice(4, 6))}-${grp(b.slice(6, 8))}-${grp(b.slice(8, 10))}-${grp(b.slice(10, 16))}`;
    }));

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setCopied("");
    }
  };
  const [copied, setCopied] = useState("");

  return (
    <>
      <header className="topbar">
        <div>
          <p className="caption">Base64 yard · sha-256 · generated ids — nothing leaves this computer</p>
          <h1>Dev Tools</h1>
        </div>
      </header>
      <div className="workcol">
        <nav className="tabs" aria-label="Dev tool groups">
          {([["base64", "Base64"], ["hash", "Hash"], ["ids", "Ids"]] as [Kind, string][]).map(([k, l]) => (
            <button key={k} className={kind === k ? "tab on" : "tab"} onClick={() => setKind(k)} data-testid={`dev-tab-${k}`}>
              {l}
            </button>
          ))}
        </nav>
        {kind === "base64" ? (
          <div className="two-stack">
            <section className="card">
              <h2>Text → Base64</h2>
              <div className="field">
                <span>Text</span>
                <textarea className="filter" rows={3} value={encText} onChange={(e) => setEncText(e.target.value)} data-testid="dev-enc-input" />
              </div>
              <div className="field">
                <span>Base64</span>
                <textarea className="filter mono" rows={3} value={b64Out} readOnly data-testid="dev-enc-out" />
              </div>
              <button className="small-btn" disabled={!b64Out} onClick={() => void copy("encode", b64Out)}>{copied === "encode" ? "Copied" : "Copy"}</button>
            </section>
            <section className="card">
              <h2>Base64 → Text</h2>
              <div className="field">
                <span>Base64</span>
                <textarea className="filter mono" rows={3} value={decodeIn} onChange={(e) => setDecodeIn(e.target.value)} data-testid="dev-dec-input" />
              </div>
              <div className="field">
                <span>Text</span>
                <textarea
                  className="filter"
                  rows={3}
                  value={decodeOut === null ? "Not valid Base64" : decodeOut.length ? fromUtf8(decodeOut) : ""}
                  readOnly
                  data-testid="dev-dec-out"
                />
              </div>
              <button className="small-btn" disabled={!decodeOut || !decodeOut.length} onClick={() => decodeOut && void copy("decode", fromUtf8(decodeOut))}>{copied === "decode" ? "Copied" : "Copy"}</button>
            </section>
          </div>
        ) : null}
        {kind === "hash" ? (
          <section className="card">
            <h2>sha-256</h2>
            <p className="muted small">Pastes here are hashed in memory only.</p>
            <div className="field">
              <span>Text to hash</span>
              <textarea className="filter" rows={3} value={hashText} onChange={(e) => setHashText(e.target.value)} data-testid="dev-hash-input" />
            </div>
            <div className="field">
              <span>Digest</span>
              <textarea className="filter mono" rows={2} value={digest} readOnly data-testid="dev-hash-out" />
            </div>
            <button className="small-btn" disabled={!digest} onClick={() => void copy("hash", digest)}>{copied === "hash" ? "Copied" : "Copy"}</button>
          </section>
        ) : null}
        {kind === "ids" ? (
          <section className="card">
            <h2>Generated ids</h2>
            <p className="muted small">Random 128-bit ids from the same source the document uses.</p>
            <button className="primary" onClick={makeIds} data-testid="dev-ids-button">Make six</button>
            {ids.length ? (
              <table className="table wide">
                <tbody>
                  {ids.map((id) => (
                    <tr key={id}>
                      <td className="mono small">{id}</td>
                      <td className="right no-print"><button className="small-btn" onClick={() => void copy(id, id)}>{copied === id ? "Copied" : "Copy"}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </section>
        ) : null}
      </div>
    </>
  );
}
