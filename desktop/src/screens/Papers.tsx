import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { openPath } from "@tauri-apps/plugin-opener";
import { fromB64 } from "../platform/crypto";
import { isTauri } from "../platform/env";
import { vault } from "../platform/storage";
import { dataUriBase64Payload, paperAttachmentUri, paperBadge, paperIsPdf, paperMime, stripDataUriBase64 } from "@core/paperNormalize";
import { PAPER_TAGS, effectivePaperTags, paperTagsFromKind } from "@core/paperTags";
import { fmtDate, todayISO, uid } from "@core/format";
import type { Paper, PaperKind, PaperTag } from "@core/types";

const KIND_LABEL: Record<PaperKind, string> = {
  licence: "Licence",
  registration: "Registration",
  insurance: "Insurance",
  passport: "Passport",
  fastag: "FASTag",
  warranty: "Warranty",
  puc: "PUC",
  personal_accident: "Personal accident",
  other: "Other",
};

const ALL_TAGS: readonly PaperTag[] = PAPER_TAGS;
const MAX_FILE = 20 * 1024 * 1024;

function attachmentKind(paper: Paper): "none" | "image" | "pdf" | "elsewhere" {
  const uri = paperAttachmentUri(paper);
  if (!uri) return "none";
  if (paperIsPdf(paper)) return "pdf";
  if ((paperMime(paper) ?? "").startsWith("image/")) return "image";
  if (uri.startsWith("data:image/")) return "image";
  if (/^(vault:|blob:)/.test(uri)) return "image";
  if (uri.startsWith("data:")) return "image";
  return "elsewhere";
}

function extFor(mime: string, fileName: string): string {
  const byMime: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };
  if (byMime[mime]) return byMime[mime];
  const m = /\.([a-z0-9]{2,5})$/i.exec(fileName);
  return m ? m[1].toLowerCase() : "bin";
}

export function Papers() {
  const { db, update } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(db.papers[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<PaperTag | "All">("All");
  const paper = db.papers.find((p) => p.id === selectedId) ?? db.papers[0] ?? null;

  const rows = db.papers
    .map((p) => ({ paper: p, tags: effectivePaperTags(p) }))
    .filter(({ paper: p, tags }) => (tag === "All" ? true : tags.includes(tag)))
    .filter(({ paper: p }) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return [p.title, p.number, p.note, p.insurer].some((v) => v?.toLowerCase().includes(q));
    });

  const addPaper = () => {
    const row: Paper = { id: uid(), kind: "other", tags: ["Other"], title: "Untitled", createdAt: todayISO() };
    update((d) => ({ ...d, papers: [row, ...d.papers] }));
    setSelectedId(row.id);
  };

  const removePaper = async (p: Paper) => {
    if (!window.confirm(`Delete "${p.title}" from this computer?`)) return;
    const uri = paperAttachmentUri(p);
    if (uri?.startsWith("vault:")) await vault.remove(uri.slice("vault:".length));
    update((d) => ({ ...d, papers: d.papers.filter((x) => x.id !== p.id) }));
    setSelectedId(null);
  };

  const patch = (p: Paper, changes: Partial<Paper>) => update((d) => ({ ...d, papers: d.papers.map((x) => (x.id === p.id ? { ...x, ...changes } : x)) }));

  return (
    <div className="papers-grid">
      <aside className="card p-list">
        <div className="row spread">
          <h2>Vault</h2>
          <button className="small-btn" onClick={addPaper}>New</button>
        </div>
        <input placeholder="Search title, number, note" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="tag-row">
          {(["All", ...ALL_TAGS] as const).map((t) => (
            <button key={t} className={tag === t ? "chip on" : "chip"} onClick={() => setTag(t)}>{t}</button>
          ))}
        </div>
        <div className="doc-list">
          {rows.map(({ paper: p, tags }) => (
            <button key={p.id} className={p.id === paper?.id ? "doc on" : "doc"} onClick={() => setSelectedId(p.id)}>
              <span className="doc-title">{p.title}</span>
              <span className="muted small">
                {p.expiry ? `expires ${p.expiry}` : KIND_LABEL[p.kind]}
                {paperBadge(p) ? ` · ${paperBadge(p)}` : ""}
                {tags.length && tag === "All" ? ` · ${tags.join(", ")}` : ""}
              </span>
            </button>
          ))}
          {rows.length === 0 ? <p className="muted">No papers match.</p> : null}
        </div>
      </aside>
      <div className="stack">
        {paper ? <PaperDetail paper={paper} onPatch={(c) => patch(paper, c)} onDelete={() => removePaper(paper)} /> : <section className="card"><p className="muted">Pick a paper, or create one.</p></section>}
      </div>
    </div>
  );
}

function PaperDetail({ paper, onPatch, onDelete }: { paper: Paper; onPatch: (c: Partial<Paper>) => void; onDelete: () => void }) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [viewerNote, setViewerNote] = useState("");
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const kind = attachmentKind(paper);
  const uri = paperAttachmentUri(paper);
  const tags = effectivePaperTags(paper);

  useEffect(() => {
    let revoke: string | null = null;
    let alive = true;
    setViewerNote("");
    (async () => {
      if (kind !== "image") {
        setImgUrl(null);
        return;
      }
      if (uri?.startsWith("data:")) {
        setImgUrl(uri);
        return;
      }
      if (uri?.startsWith("vault:")) {
        const bytes = await vault.read(uri.slice("vault:".length));
        if (!bytes) {
          if (alive) setImgUrl(null);
          return;
        }
        const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: paperMime(paper) ?? "application/octet-stream" }));
        revoke = url;
        if (alive) setImgUrl(url);
        return;
      }
      setImgUrl(null);
    })().catch(() => alive && setImgUrl(null));
    return () => {
      alive = false;
      if (revoke) URL.revokeObjectURL(revoke);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paper.id, paper.file, paper.photo, paper.mime]);

  const attach = async (file: File) => {
    setViewerNote("");
    if (file.size > MAX_FILE) {
      setViewerNote("That file is larger than 20 MB.");
      return;
    }
    const mime = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const name = `${paper.id}.${extFor(mime, file.name)}`;
    if (uri?.startsWith("vault:") && uri.slice("vault:".length) !== name) await vault.remove(uri.slice("vault:".length));
    await vault.save(name, bytes);
    onPatch({ file: `vault:${name}`, mime, photo: undefined });
  };

  const removeAttachment = async () => {
    if (uri?.startsWith("vault:")) await vault.remove(uri.slice("vault:".length));
    onPatch({ file: undefined, mime: undefined, photo: undefined });
  };

  const openAttachment = async () => {
    if (!uri) return;
    setViewerNote("");
    setOpening(true);
    try {
      if (uri.startsWith("vault:")) {
        const name = uri.slice("vault:".length);
        if (isTauri()) {
          const abs = await vault.absolutePath(name);
          if (abs) {
            await openPath(abs);
            return;
          }
        }
        const bytes = await vault.read(name);
        if (!bytes) {
          setViewerNote("The stored file could not be read from the vault folder.");
          return;
        }
        window.open(URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: paperMime(paper) ?? "application/pdf" })), "_blank");
        return;
      }
      if (uri.startsWith("data:")) {
        const bytes = fromB64(stripDataUriBase64(dataUriBase64Payload(uri)));
        const name = `paper-${paper.id}.pdf`;
        await vault.save(name, bytes);
        if (isTauri()) {
          const abs = await vault.absolutePath(name);
          if (abs) {
            await openPath(abs);
            return;
          }
        }
        window.open(URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })), "_blank");
        return;
      }
      if (uri.startsWith("blob:") || uri.startsWith("http")) {
        window.open(uri, "_blank");
        return;
      }
      setViewerNote("This file is still on your phone. It will come over with sync (Phase D2); for now, attach a copy from this computer.");
    } catch (err) {
      setViewerNote(err instanceof Error ? err.message : "Could not open the file.");
    } finally {
      setOpening(false);
    }
  };

  const toggleTag = (t: PaperTag) => {
    const next = tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t];
    onPatch({ tags: next.length ? next : ["Other"] });
  };

  return (
    <>
      <section className="card">
        <div className="row spread">
          <input className="title-input" value={paper.title} onChange={(e) => onPatch({ title: e.target.value })} />
          <button className="link danger" onClick={onDelete}>Delete</button>
        </div>
        <div className="paper-fields">
          <label className="field"><span>Kind</span>
            <select value={paper.kind} onChange={(e) => onPatch({ kind: e.target.value as PaperKind, tags: paperTagsFromKind(e.target.value as PaperKind) })}>
              {(Object.keys(KIND_LABEL) as PaperKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </label>
          <label className="field"><span>Number</span>
            <input value={paper.number ?? ""} onChange={(e) => onPatch({ number: e.target.value || undefined })} />
          </label>
          <label className="field"><span>Expiry</span>
            <input type="date" value={paper.expiry ?? ""} onChange={(e) => onPatch({ expiry: e.target.value || undefined })} />
          </label>
          <label className="field"><span>Insurer</span>
            <input value={paper.insurer ?? ""} onChange={(e) => onPatch({ insurer: e.target.value || undefined })} />
          </label>
        </div>
        <label className="field"><span>Note</span>
          <textarea rows={2} value={paper.note ?? ""} onChange={(e) => onPatch({ note: e.target.value || undefined })} />
        </label>
        <div className="tag-row">
          {ALL_TAGS.map((t) => (
            <button key={t} className={tags.includes(t) ? "chip on" : "chip"} onClick={() => toggleTag(t)}>{t}</button>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="row spread">
          <h2>Attachment</h2>
          <div className="row">
            <button className="small-btn" onClick={() => fileInput.current?.click()}>{kind === "none" ? "Attach file" : "Replace"}</button>
            {kind !== "none" ? <button className="link danger" onClick={removeAttachment}>Remove</button> : null}
            {kind !== "none" ? <button className="small-btn" disabled={opening} onClick={openAttachment}>{kind === "pdf" ? "Open in system viewer" : "Open"}</button> : null}
          </div>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void attach(file);
          }}
        />
        {viewerNote ? <p className="error">{viewerNote}</p> : null}
        {kind === "image" && imgUrl ? <img className="paper-photo" src={imgUrl} alt={paper.title} /> : null}
        {kind === "pdf" ? (
          <p className="muted">
            PDF stored {uri?.startsWith("data:") ? "inside the document" : "in the vault folder"}. Use the system viewer — the webview cannot render PDFs on every Linux setup.
          </p>
        ) : null}
        {kind === "elsewhere" ? <p className="muted">Attachment path: {uri}</p> : null}
        {kind === "none" ? <p className="muted">No file attached yet.</p> : null}
        {paper.expiry ? <p className="muted small">Expires {fmtDate(paper.expiry)}</p> : null}
      </section>
    </>
  );
}
