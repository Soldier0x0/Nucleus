/** True for a 24-hour HH:MM (or H:MM) clock time, e.g. "09:30" or "7:05". */
export function clockOk(s: string): boolean {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return false;
  return Number(m[1]) < 24 && Number(m[2]) < 60;
}
