import type { Paper } from "./types";
import { uid } from "./format";

export function paperAttachmentUri(paper: Paper): string | undefined {
  return paper.file ?? paper.photo;
}

export function paperMime(paper: Paper): string | undefined {
  if (paper.mime) return paper.mime;
  const uri = paperAttachmentUri(paper);
  if (!uri) return undefined;
  if (uri.startsWith("data:application/pdf")) return "application/pdf";
  if (uri.startsWith("data:image/")) return uri.slice(5, uri.indexOf(";"));
  if (uri.toLowerCase().endsWith(".pdf")) return "application/pdf";
  return "image/jpeg";
}

export function paperIsPdf(paper: Paper): boolean {
  return paperMime(paper) === "application/pdf";
}

export function paperBadge(paper: Paper): "PDF" | "Image" | null {
  const uri = paperAttachmentUri(paper);
  if (!uri) return null;
  return paperIsPdf(paper) ? "PDF" : "Image";
}

export function normalizePaper(raw: unknown): Paper {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const kind = typeof row.kind === "string" ? row.kind : "other";
  const allowed = new Set(["licence", "registration", "insurance", "passport", "fastag", "warranty", "puc", "personal_accident", "other"]);
  const next: Paper = {
    id: typeof row.id === "string" ? row.id.slice(0, 40) : uid(),
    kind: (allowed.has(kind) ? kind : "other") as Paper["kind"],
    title: typeof row.title === "string" ? row.title.slice(0, 120) : "Paper",
    createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
  };
  if (typeof row.number === "string" && row.number.trim()) next.number = row.number.trim().slice(0, 80);
  if (typeof row.expiry === "string" && row.expiry.trim()) next.expiry = row.expiry.trim().slice(0, 10);
  if (typeof row.note === "string" && row.note.trim()) next.note = row.note.trim().slice(0, 400);
  if (typeof row.photo === "string" && row.photo.trim()) next.photo = row.photo;
  if (typeof row.file === "string" && row.file.trim()) next.file = row.file;
  if (typeof row.mime === "string" && row.mime.trim()) next.mime = row.mime.trim().slice(0, 80);
  if (row.motorCover === "comprehensive" || row.motorCover === "third-party") next.motorCover = row.motorCover;
  if (row.rsaAddOn === true) next.rsaAddOn = true;
  if (typeof row.insurer === "string" && row.insurer.trim()) next.insurer = row.insurer.trim().slice(0, 80);
  if (typeof row.personId === "string") next.personId = row.personId.slice(0, 40);
  if (typeof row.vehicleId === "string") next.vehicleId = row.vehicleId.slice(0, 40);
  return next;
}
