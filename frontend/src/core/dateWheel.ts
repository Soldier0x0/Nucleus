/** Pure helpers for the D/M/Y date wheels. */

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

/** ISO date for a wheel pick. The day is clamped, so 31 Feb becomes 28/29 Feb. */
export function wheelISO(year: number, month: number, day: number): string {
  const d = Math.min(Math.max(1, day), daysInMonth(year, month));
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Years shown on the wheel: 30 back and 15 ahead of today, widened to include the value. */
export function wheelYears(todayYear: number, valueYear?: number): number[] {
  const lo = Math.min(todayYear - 30, valueYear ?? todayYear);
  const hi = Math.max(todayYear + 15, valueYear ?? todayYear);
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

/** Quick picks under the wheels. */
export const MONTH_CHIPS = [1, 3, 6, 12] as const;
