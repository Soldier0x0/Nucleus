/**
 * Decisions for opening the on-device database.
 * A failed read must not remove, replace, or re-key the saved copy.
 */

export type OpenPlan =
  | { status: "missing" }
  | { status: "read"; raw: string; dropLegacyNow: boolean; dropLegacyAfterSave: boolean };

export type OpenOutcome =
  | { status: "missing" }
  | { status: "unreadable" }
  | { status: "opened"; json: string; dropLegacyNow: boolean; dropLegacyAfterSave: boolean };

export type DeviceKeyAction = "use" | "create" | "refuse";

/** Which snapshot to read. The legacy key is never chosen when a current snapshot exists. */
export function planOpen(current: string | null, legacy: string | null): OpenPlan {
  if (current) return { status: "read", raw: current, dropLegacyNow: legacy != null, dropLegacyAfterSave: false };
  if (legacy) return { status: "read", raw: legacy, dropLegacyNow: false, dropLegacyAfterSave: true };
  return { status: "missing" };
}

/**
 * Parse one snapshot. Decrypt and JSON failures both become "unreadable"
 * and carry no instruction to delete or replace storage.
 */
export async function resolveOpen(plan: OpenPlan, read: (raw: string) => Promise<string>): Promise<OpenOutcome> {
  if (plan.status === "missing") return { status: "missing" };
  try {
    const json = await read(plan.raw);
    JSON.parse(json);
    return { status: "opened", json, dropLegacyNow: plan.dropLegacyNow, dropLegacyAfterSave: plan.dropLegacyAfterSave };
  } catch {
    return { status: "unreadable" };
  }
}

/**
 * What to do with the bytes already in the key slot.
 * Decrypt never creates a key. A value that is present but the wrong size is never overwritten.
 */
export function deviceKeyAction(bytes: Uint8Array | null, purpose: "decrypt" | "encrypt"): DeviceKeyAction {
  if (bytes && bytes.length === 32) return "use";
  if (bytes) return "refuse";
  switch (purpose) {
    case "decrypt":
      return "refuse";
    case "encrypt":
      return "create";
    default: {
      const unreachable: never = purpose;
      return unreachable;
    }
  }
}

export type KeySlot = "ok" | "missing" | "unusable";

/**
 * Replace the saved document. The key slot is written only when it cannot
 * already open data, and only after the new document is stored.
 */
export async function writeReplacement(
  plain: string,
  deps: {
    inspect: () => Promise<KeySlot>;
    currentKey: () => Promise<Uint8Array>;
    newKey: () => Uint8Array;
    seal: (plain: string, key: Uint8Array) => Promise<string> | string;
    putDocument: (payload: string) => Promise<void>;
    putKey: (key: Uint8Array) => Promise<void>;
    removeLegacy: () => Promise<void>;
  },
): Promise<void> {
  const slot = await deps.inspect();
  const key = slot === "ok" ? await deps.currentKey() : deps.newKey();
  const payload = await deps.seal(plain, key);
  await deps.putDocument(payload);
  if (slot !== "ok") await deps.putKey(key);
  await deps.removeLegacy();
}
