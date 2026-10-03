const DATE = /\d{4}-\d{2}-\d{2}|\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/;

export function shadeHasDate(shade: string): boolean {
  return DATE.test(shade);
}

/** Home widget shows the next window. The notification shade does not carry a date. */
export function cycleHomeWidget(next: { line: string; paused: boolean } | null): { window: string; shade: string } {
  const shade = "Next window";
  if (!next) return { window: "No window yet", shade };
  return { window: next.paused ? "Paused" : next.line, shade };
}
