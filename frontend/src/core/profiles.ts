/**
 * Profiles and the decoy vault. Pure: the store decides which document key to write.
 * The decoy document is never the active real snapshot.
 */
import type { DB, Settings } from "./types";
import { DB_KEY, emptyDB } from "./defaults";
import { withSampleData } from "./sample";

export const DECOY_DB_KEY = "nucleus.profile.decoy.v1";
export const PROFILE_INDEX_KEY = "nucleus.profiles.v1";
export const DEFAULT_PROFILE_ID = "personal";

export const profileDocKey = (id: string) => `nucleus.profile.${id}.v1`;

export type PinMatch = "primary" | "decoy" | "none";
export type ProfileMeta = { id: string; name: string };
export type ProfileIndex = { activeId: string; profiles: ProfileMeta[] };
export type VaultSession = "real" | "decoy";

export function defaultProfileIndex(): ProfileIndex {
  return { activeId: DEFAULT_PROFILE_ID, profiles: [{ id: DEFAULT_PROFILE_ID, name: "Personal" }] };
}

export function parseProfileIndex(raw: string | null): ProfileIndex {
  if (!raw) return defaultProfileIndex();
  try {
    const parsed = JSON.parse(raw) as Partial<ProfileIndex>;
    const profiles = Array.isArray(parsed.profiles)
      ? parsed.profiles
          .filter((p) => p && typeof p.id === "string" && p.id.length > 0)
          .map((p) => ({ id: p.id, name: typeof p.name === "string" && p.name.trim() ? p.name.trim() : "Profile" }))
      : [];
    if (!profiles.length) return defaultProfileIndex();
    const activeId = profiles.some((p) => p.id === parsed.activeId) ? (parsed.activeId as string) : profiles[0].id;
    return { activeId, profiles };
  } catch {
    return defaultProfileIndex();
  }
}

/** Primary always wins when both hashes match, so a duplicated PIN cannot hide the real profile. */
export function pickPinMatch(primary: boolean, decoy: boolean): PinMatch {
  if (primary) return "primary";
  if (decoy) return "decoy";
  return "none";
}

export function persistDocumentKey(session: VaultSession) {
  return session === "decoy" ? DECOY_DB_KEY : DB_KEY;
}

/** Look of the phone, without any records. Used so a new profile and the decoy feel like the same app. */
export function shellSettings(from: Settings): Settings {
  const base = emptyDB().settings;
  return {
    ...base,
    onboarded: true,
    currency: from.currency,
    distanceUnit: from.distanceUnit,
    volumeUnit: from.volumeUnit,
    tempUnit: from.tempUnit,
    timeFormat: from.timeFormat,
    theme: from.theme,
    accent: from.accent,
    density: from.density,
    privacyMode: from.privacyMode,
    lockEnabled: from.lockEnabled,
    unlockMethod: from.unlockMethod,
    biometricEnabled: from.biometricEnabled,
    lockTimeoutSec: from.lockTimeoutSec,
    blockScreenshots: from.blockScreenshots,
    highContrast: from.highContrast,
    largeTouch: from.largeTouch,
    reducedMotion: from.reducedMotion,
    quietHours: { ...from.quietHours },
    emergency: { ...from.emergency },
    modules: base.modules.map((m) => ({ ...m })),
    tiles: base.tiles.map((t) => ({ ...t })),
  };
}

/** A believable workspace. It copies appearance only — never the real records. */
export function buildDecoyDB(from: DB): DB {
  const db = withSampleData({ ...emptyDB(), settings: shellSettings(from.settings) });
  db.settings = { ...db.settings, modules: db.settings.modules.filter((m) => m.id !== "cycle") };
  db.cycle = emptyDB().cycle;
  return db;
}
