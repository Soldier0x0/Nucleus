export type PhoneBattery = {
  level: number | null;
  state: string | null;
  saver: boolean;
  cycleCount: number | null;
  health: string | null;
  temperatureC: number | null;
  voltageV: number | null;
  technology: string | null;
};

const empty: PhoneBattery = {
  level: null,
  state: null,
  saver: false,
  cycleCount: null,
  health: null,
  temperatureC: null,
  voltageV: null,
  technology: null,
};

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function parsePhoneBattery(json: string): PhoneBattery {
  let raw: unknown = null;
  try {
    raw = JSON.parse(json);
  } catch {
    return empty;
  }
  if (!raw || typeof raw !== "object") return empty;
  const row = raw as Record<string, unknown>;
  return {
    level: numberOrNull(row.level),
    state: textOrNull(row.state),
    saver: row.saver === true,
    cycleCount: numberOrNull(row.cycleCount),
    health: textOrNull(row.health),
    temperatureC: numberOrNull(row.temperatureC),
    voltageV: numberOrNull(row.voltageV),
    technology: textOrNull(row.technology),
  };
}

export function batterySummary(facts: PhoneBattery): { figure: string; lines: string[] } {
  const figure = facts.level == null || facts.level < 0 ? "—" : `${Math.round(facts.level * 100)}%`;
  const lines: string[] = [];
  if (facts.state) lines.push(facts.state);
  if (facts.saver) lines.push("Battery saver on");
  if (facts.cycleCount != null && facts.cycleCount >= 0) lines.push(`${facts.cycleCount} cycles`);
  if (facts.health) lines.push(facts.health);
  if (facts.temperatureC != null) lines.push(`${facts.temperatureC.toFixed(1)}°C`);
  if (facts.voltageV != null) lines.push(`${facts.voltageV.toFixed(2)} V`);
  if (facts.technology) lines.push(facts.technology);
  return { figure, lines };
}

export function phoneBatteryReported(facts: PhoneBattery): boolean {
  return facts.level != null || facts.cycleCount != null || facts.health != null || facts.temperatureC != null || facts.voltageV != null || facts.technology != null;
}
