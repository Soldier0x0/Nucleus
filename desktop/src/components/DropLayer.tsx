import { useEffect, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { readFile } from "@tauri-apps/plugin-fs";
import { useStore } from "../store";
import { isTauri } from "../platform/env";
import { parseBackup } from "../platform/backup";
import { vault } from "../platform/storage";
import { isAttachableMime, mimeFromExt } from "../platform/ingest";
import { todayISO, uid } from "@core/format";
import type { Paper } from "@core/types";

const MAX_FILE = 20 * 1024 * 1024;

/**
 * Drag-drop import (v0.14): a backup JSON dropped anywhere replaces the
 * document after a confirm; images and PDFs are attached as new papers.
 * Browser preview has no drop events, so this layer only mounts in Tauri.
 */
export function DropLayer() {
  const { update, replace } = useStore();
  const [hover, setHover] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    let alive = true;
    void getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "enter" || event.payload.type === "over") setHover(true);
        else if (event.payload.type === "leave") setHover(false);
        else if (event.payload.type === "drop") {
          setHover(false);
          void handleDrop(event.payload.paths);
        }
      })
      .then((fn) => {
        if (alive) unlisten = fn;
        else fn();
      })
      .catch(() => {});
    return () => {
      alive = false;
      unlisten?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(""), 5000);
    return () => clearTimeout(t);
  }, [note]);

  const handleDrop = async (paths: string[]) => {
    setNote("");
    for (const path of paths.slice(0, 5)) {
      const name = path.split(/[\\/]/).pop() ?? "file";
      try {
        if (/\.json$/i.test(name)) {
          await importBackup(path, name);
          continue;
        }
        await attachPaper(path, name);
      } catch (err) {
        setNote(`${name}: ${err instanceof Error ? err.message : "could not be imported"}`);
      }
    }
  };

  const importBackup = async (path: string, name: string) => {
    const bytes = await readFile(path);
    if (bytes.length > MAX_FILE) throw new Error("larger than 20 MB");
    const text = new TextDecoder().decode(bytes);
    const picked = parseBackup(text);
    if (picked.kind === "encrypted") throw new Error("encrypted backups import in Settings");
    if (!window.confirm(`Replace the document on this computer with "${name}"? The current document is overwritten.`)) return;
    replace(picked.file.data);
    setNote(`Imported ${name}.`);
  };

  const attachPaper = async (path: string, name: string) => {
    const bytes = await readFile(path);
    if (bytes.length > MAX_FILE) throw new Error("larger than 20 MB");
    const ext = (name.match(/\.([a-z0-9]{1,5})$/i)?.[1] ?? "").toLowerCase();
    const mime = mimeFromExt(ext) ?? "application/octet-stream";
    if (!isAttachableMime(mime)) throw new Error("drop a PDF or an image, or a backup .json");
    const slug = name.replace(/\.[a-z0-9]{1,5}$/i, "").replace(/[^A-Za-z0-9_-]+/g, " ").trim().slice(0, 60) || "Dropped file";
    const id = uid();
    const nvName = `${id}.${ext || "pdf"}`;
    await vault.save(nvName, bytes);
    const row: Paper = {
      id,
      kind: "other",
      tags: ["Other"],
      title: slug,
      createdAt: todayISO(),
      file: `vault:${nvName}`,
      mime,
    };
    update((d) => ({ ...d, papers: [row, ...d.papers] }));
    setNote(`Attached ${name} to Papers.`);
  };

  return (
    <>
      {hover ? (
        <div className="drop-overlay" data-testid="drop-overlay">
          <div className="card wide-card">
            <h2>Drop to import</h2>
            <p className="muted">A backup .json replaces this document. Images and PDFs attach as papers.</p>
          </div>
        </div>
      ) : null}
      {note ? <div className="drop-note" data-testid="drop-note">{note}</div> : null}
    </>
  );
}
