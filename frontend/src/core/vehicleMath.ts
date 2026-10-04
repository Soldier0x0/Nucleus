export function costPerKmLine(perKm: number, unit: "km" | "mi"): string | null {
  if (!Number.isFinite(perKm)) return null;
  const shown = Math.round(perKm * 100) / 100;
  return `${shown} per ${unit}`;
}

export function fuelAgainstTank(litres: number, tankLitres: number): { litres: number; tank: number; line: string } {
  const litresShown = Math.round(litres * 10) / 10;
  const tankShown = Math.round(tankLitres * 10) / 10;
  return { litres: litresShown, tank: tankShown, line: `${litresShown} L of a ${tankShown} L tank` };
}

export function serviceLeftLine(km: number): string {
  const left = Math.round(km);
  if (left <= 0) return `${-left} km past this vehicle's service interval`;
  return `${left} km left before service`;
}
