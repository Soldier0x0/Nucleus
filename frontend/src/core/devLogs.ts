export const DEV_LOG_SCHEMA = "nucleus-dev-log/1";

type DevLogRow = { at: string; kind: string; detail?: string };

const rows: DevLogRow[] = [];
const MAX = 400;

export function devLog(kind: string, detail?: string) {
  const safeKind = kind.replace(/[^\w.-]/g, "_").slice(0, 40);
  const safeDetail = detail ? detail.replace(/[^\w .:=-]/g, "_").slice(0, 120) : undefined;
  rows.push({ at: new Date().toISOString(), kind: safeKind, detail: safeDetail });
  if (rows.length > MAX) rows.splice(0, rows.length - MAX);
}

export function scrubStack(stack?: string): string | undefined {
  if (!stack) return undefined;
  return stack
    .split("\n")
    .map((line) => line.replace(/\b\d{4,}\b/g, "n").replace(/@[\w.-]+\([^)]*\)/g, "@fn()"))
    .slice(0, 12)
    .join("\n");
}

export function buildDeveloperLog(extra?: { perfMs?: Record<string, number>; app?: string; build?: string; platform?: string; model?: string }): string {
  const lines: string[] = [];
  lines.push(`schema: ${DEV_LOG_SCHEMA}`);
  lines.push(`app: ${extra?.app ?? "unknown"}`);
  lines.push(`build: ${extra?.build ?? "dev"}`);
  lines.push(`platform: ${extra?.platform ?? "unknown"}`);
  lines.push(`model: ${extra?.model ?? "unknown"}`);
  lines.push("--- events ---");
  for (const row of rows) {
    lines.push(`${row.at} ${row.kind}${row.detail ? ` ${row.detail}` : ""}`);
  }
  if (extra?.perfMs) {
    lines.push("--- perf ---");
    for (const [key, ms] of Object.entries(extra.perfMs)) {
      if (Number.isFinite(ms)) lines.push(`${key}: ${Math.round(ms)}ms`);
    }
  }
  lines.push("--- note ---");
  lines.push("No names, amounts, odometer, capture text, or document contents are included.");
  return lines.join("\n");
}
