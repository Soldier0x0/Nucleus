/** Short window where a system sheet (picker, share, biometrics) must not trigger a relock. */
let activeUntil = 0;

export function pulseExternalActivity(durationMs = 90_000) {
  activeUntil = Math.max(activeUntil, Date.now() + durationMs);
}

export function externalActivityActive(): boolean {
  return Date.now() < activeUntil;
}

export async function withExternalActivity<T>(fn: () => Promise<T>, durationMs = 90_000): Promise<T> {
  pulseExternalActivity(durationMs);
  return fn();
}
