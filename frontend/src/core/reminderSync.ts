import type { DB } from "./types";

/** What the OS reminder list depends on. A change to any of these schedules again. */
export function reminderInputs(db: DB): string {
  return JSON.stringify([
    db.rules,
    db.txns.filter((t) => t.type === "expense").length,
    db.subscriptions,
    db.reminders,
    db.medicines,
    db.settings.remindersEnabled,
    db.settings.quietHours,
    db.settings.lockAlerts,
  ]);
}

export const REMINDER_SYNC_DEBOUNCE_MS = 400;

/** Warn once (plan 4.3): there is something to ring, but notifications are denied for good. */
export function shouldWarnDenied(input: { pending: number; granted: boolean; canAskAgain: boolean; warned: boolean }): boolean {
  return input.pending > 0 && !input.granted && !input.canAskAgain && !input.warned;
}

