/**
 * A visit summary the person can read on screen and save.
 * It quotes published ranges. It does not diagnose.
 */
import type { CycleState } from "./types";
import { cleanBuddyName, estimateLine, forecast, listedSymptoms, symptomLabel } from "./cycle";
import { fmtDate } from "./format";

export const VISIT_GUIDE = [
  "Age is not asked.",
  "This is not a diagnosis.",
  "FIGO (2018) describes a typical cycle length as about 24 to 38 days. That range is a published description. It is not a label on this log.",
  "ACOG patient guidance says to contact a clinician for severe pain, or for bleeding that soaks through a pad or tampon every hour for several hours.",
];

/** Private initials unless the person chooses the full name. */
export function reportLabel(mode: CycleState["reportName"], name: string): string {
  if (mode === "normal") return cleanBuddyName(name) || "Private";
  const clean = cleanBuddyName(name);
  if (!clean) return "Private";
  return clean
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}.`)
    .join(" ");
}

export function doctorParagraphs(cycle: CycleState, today: string): string[] {
  const next = forecast(cycle, today);
  const name = reportLabel(cycle.reportName, cycle.buddyName);
  const logs = [...cycle.days]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 40)
    .map((day) => {
      const bits = [fmtDate(day.date), day.bleeding ?? "", day.flow ?? "", ...listedSymptoms(day).map(symptomLabel)].filter(Boolean);
      return bits.join(" · ");
    });
  return [
    "Doctor report",
    `Name: ${name}`,
    `Prepared ${fmtDate(today)}.`,
    next ? estimateLine(next) : "Log a period before a range can be shown. This is not a prediction.",
    next && !next.paused ? `Range ${fmtDate(next.from)} to ${fmtDate(next.to)}.` : "No open range.",
    logs.length ? `Logged days: ${logs.join(" | ")}` : "No logged days.",
    ...VISIT_GUIDE,
  ];
}

export function doctorReport(cycle: CycleState, today: string): string {
  return doctorParagraphs(cycle, today).join("\n\n");
}

function pdfText(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, "?").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapLines(paragraphs: string[]): string[] {
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > 90) {
        if (line) lines.push(line);
        line = word.slice(0, 90);
      } else line = next;
    }
    if (line) lines.push(line);
    lines.push("");
  }
  return lines;
}

function pageStream(lines: string[]): string {
  const cmds = ["BT", "/F1 11 Tf", "72 750 Td"];
  lines.forEach((line, index) => {
    if (index > 0) cmds.push("0 -16 Td");
    cmds.push(`(${pdfText(line)}) Tj`);
  });
  cmds.push("ET");
  return cmds.join("\n");
}

/** A small Helvetica PDF. Non-ASCII characters become question marks. */
export function textPdf(paragraphs: string[]): string {
  const wrapped = wrapLines(paragraphs);
  const source = wrapped.length ? wrapped : [""];
  const pages: string[][] = [];
  for (let i = 0; i < source.length; i += 42) pages.push(source.slice(i, i + 42));
  const fontId = 3 + pages.length * 2;
  const objects: string[] = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  const kids = pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ");
  objects.push(`2 0 obj\n<< /Type /Pages /Count ${pages.length} /Kids [${kids}] >>\nendobj\n`);
  pages.forEach((page, index) => {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    const stream = pageStream(page);
    objects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>\nendobj\n`,
    );
    objects.push(`${contentId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);
  });
  objects.push(`${fontId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);

  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(body.length);
    body += object;
  }
  const xrefAt = body.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  body += xref;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return body;
}
