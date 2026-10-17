import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
// Bundled worker: a same-origin asset, so the CSP needs no new sources.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * In-app PDF viewer (v0.14): pdf.js renders straight into the webview, so
 * papers no longer hand off to system apps on every page open.
 */
export function PdfPane({ data, title }: { data: Uint8Array; title: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [gen, setGen] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let dead = false;
    setError("");
    setPages(0);
    setPage(1);
    setZoom(1);
    (async () => {
      try {
        const doc = await getDocument({ data: new Uint8Array(data) }).promise;
        if (dead) {
          void doc.destroy();
          return;
        }
        docRef.current = doc;
        setPages(doc.numPages);
        setGen((n) => n + 1);
      } catch {
        if (!dead) setError("This PDF could not be shown here. Try the system viewer.");
      }
    })();
    return () => {
      dead = true;
      if (docRef.current) void docRef.current.destroy();
      docRef.current = null;
    };
  }, [data]);

  useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || page < 1 || page > doc.numPages) return;
    let dead = false;
    (async () => {
      try {
        const pdfPage = await doc.getPage(page);
        if (dead) return;
        const container = canvas.parentElement;
        const fit = container ? Math.max(0.3, (container.clientWidth - 24) / pdfPage.getViewport({ scale: 1 }).width) : 1;
        const viewport = pdfPage.getViewport({ scale: fit * zoom });
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await pdfPage.render({ canvasContext: ctx, viewport }).promise;
      } catch {
        if (!dead) setError("Page render failed. Try another zoom or the system viewer.");
      }
    })();
    return () => {
      dead = true;
    };
  }, [data, page, zoom, gen]);

  return (
    <div className="pdf-pane" data-testid="pdf-pane">
      <div className="row pdf-bar no-print">
        <span className="muted small grow">{title}</span>
        <button className="small-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
        <span className="small">{pages ? `${page} / ${pages}` : "…"}</span>
        <button className="small-btn" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>›</button>
        <button className="small-btn" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>−</button>
        <span className="small muted">{Math.round(zoom * 100)}%</span>
        <button className="small-btn" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>+</button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="pdf-scroll">
        <canvas ref={canvasRef} className="pdf-canvas" />
      </div>
    </div>
  );
}
