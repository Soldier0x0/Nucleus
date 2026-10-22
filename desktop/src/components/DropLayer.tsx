import { useEffect, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { join } from "@tauri-apps/api/path";
import { readDir, readFile } from "@tauri-apps/plugin-fs";
import { useStore } from "../store";
import { confirmDialog } from "./Dialog";
import { isTauri } from "../platform/env";
import { parseBackup } from "../platform/backup";
import { vault } from "../platform/storage";
import { isAttachableMime, mimeFromExt } from "../platform/ingest";
import { todayISO, uid } from "@core/format";
import type { Paper } from "@core/types";

const MAX_FILE = 20 * 1024 * 1024;
const MAX_DROP_FILES = 40;

type Dropped = { path: string; name: string };

/**
 * Drag-drop import (v0.14): a backup JSON dropped anywhere replaces the
 * document after a confirm; images and PDFs attach as new papers; folders
 * recurse (v0.15) and every PDF/image inside comes along. Browser preview
 * has no drop events, so this layer only mounts in Tauri.
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

  /** Depth-limited folder walk. */
  const walkDir = async (dir: string, out: Dropped[], cap: number, depth: number) => {
    if (depth > 3 || out.length >= cap) return;
    let entries: Awaited<ReturnType<typeof readDir>>;
    try {
      entries = await readDir(dir);
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= cap) return;
      const child = await join(dir, e.name);
      if (e.isDirectory) await walkDir(child, out, cap, depth + 1);
      else if (e.name && !e.name.startsWith(".")) out.push({ path: child, name: e.name });
    }
  };

  /** Dropped folders unfold; nested folders walk down too. */
  const collectFiles = async (paths: string[], cap: number): Promise<Dropped[]> => {
    const out: Dropped[] = [];
    for (const path of paths) {
      if (out.length >= cap) break;
      let isDir = false;
      try {
        const entries = await readDir(path);
        isDir = true;
        for (const e of entries) {
          if (out.length >= cap) break;
          const child = await join(path, e.name);
          if (e.isDirectory) await walkDir(child, out, cap, 1);
          else if (!e.name.startsWith(".")) out.push({ path: child, name: e.name });
        }
      } catch {
        isDir = false;
      }
      if (isDir) continue;
      const name = path.split(/[\\/]/).pop() ?? "file";
      if (name && !name.startsWith(".")) out.push({ path, name });
    }
    return out;
  };

  const handleDrop = async (paths: string[]) => {
    setNote("");
    const files = await collectFiles(paths, MAX_DROP_FILES);
    let attached = 0;
    let firstError = "";
    let importedName = "";
    let skippedJson = 0;
    // A backup replaces the whole document, so it must land before any paper
    // does — files attached first would be overwritten by it.
    const backupIndex = files.findIndex(({ name }) => /\.json$/i.test(name));
    if (backupIndex >= 0) {
      const { path, name } = files[backupIndex];
      try {
        if (await importBackup(path, name)) importedName = name;
      } catch (err) {
        firstError = `${name}: ${err instanceof Error ? err.message : "could not be imported"}`;
      }
      skippedJson = files.filter((f, i) => i !== backupIndex && /\.json$/i.test(f.name)).length;
    }
    for (let i = 0; i < files.length; i += 1) {
      if (i === backupIndex) continue;
      const { path, name } = files[i];
      if (/\.json$/i.test(name)) {
        if (backupIndex < 0) skippedJson += 1;
        continue;
      }
      try {
        await attachPaper(path, name);
        attached++;
      } catch (err) {
        firstError = `${name}: ${err instanceof Error ? err.message : "could not be imported"}`;
      }
    }
    const parts: string[] = [];
    if (importedName) parts.push(`Imported ${importedName}.`);
    if (attached) parts.push(`Attached ${attached} file${attached === 1 ? "" : "s"} to Papers.`);
    if (skippedJson) parts.push(`Skipped ${skippedJson} more .json file${skippedJson === 1 ? "" : "s"}.`);
    if (firstError) parts.push(firstError);
    setNote(parts.join(" ") || "Nothing importable in the drop.");
  };

  /** true when the document was replaced. */
  const importBackup = async (path: string, name: string): Promise<boolean> => {
    const bytes = await readFile(path);
    if (bytes.length > MAX_FILE) throw new Error("larger than 20 MB");
    const text = new TextDecoder().decode(bytes);
    const picked = parseBackup(text);
    if (picked.kind === "encrypted") throw new Error("encrypted backups import in Settings");
    if (
      !(await confirmDialog({
        title: "Replace this document?",
        body: `The document on this computer is replaced with "${name}". The current one is overwritten.`,
        confirmLabel: "Replace",
        danger: true,
      }))
    )
      return false;
    replace(picked.file.data);
    return true;
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
