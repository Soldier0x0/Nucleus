/**
 * Static index and ranked search for the Settings hub (v0.9.8 phase 9.5).
 * Pure data + functions: no React, no store, no I/O. Close matches only.
 */

export type SettingsGroup = "Display" | "Security and privacy" | "Notifications" | "Modules" | "Data and backup" | "About";

export type SettingsEntry = {
  /** Stable id; also used for the result row testID. */
  id: string;
  /** The row label shown in results. */
  title: string;
  /** The hub group this row lives in. Every result shows its group. */
  group: SettingsGroup;
  /** The child screen (or module screen) the row opens. */
  route: string;
  /** Section anchor on that screen, so the row is in view on arrival. */
  anchor: string;
  /** Lowercase words a person might type. Space-separated. */
  terms: string;
};

export type SettingsSearchHit = SettingsEntry & { score: number };

/** Few results only: at most this many, even for a broad query like "lock". */
export const SETTINGS_SEARCH_LIMIT = 8;

/** A single-letter query would match half the app, so terms must be at least this long. */
const MIN_TERM = 2;

export const SETTINGS_INDEX: readonly SettingsEntry[] = [
  // Hub groups themselves.
  { id: "group-display", title: "Display", group: "Display", route: "/settings/display", anchor: "", terms: "appearance theme accent density look launcher you name defaults units currency reopen home screen accessibility online weather tiles widgets packs" },
  { id: "group-security", title: "Security and privacy", group: "Security and privacy", route: "/settings/security", anchor: "", terms: "lock fingerprint pin biometrics profiles decoy clipboard privacy screenshots screen sharing emergency card" },
  { id: "group-notifications", title: "Notifications", group: "Notifications", route: "/settings/notifications", anchor: "", terms: "reminders quiet hours channels sounds bank texts sms lock screen permission" },
  { id: "group-modules", title: "Modules", group: "Modules", route: "/modules", anchor: "", terms: "enable disable reorder menu order turn on off" },
  { id: "group-data", title: "Data and backup", group: "Data and backup", route: "/settings/data", anchor: "", terms: "your data locked file cloud backup export restore sample logs erase" },
  { id: "group-about", title: "About", group: "About", route: "/settings/about", anchor: "", terms: "version build licences licenses credits" },

  // Display.
  { id: "name", title: "What should I call you?", group: "Display", route: "/settings/display", anchor: "you", terms: "name call greeting you" },
  { id: "theme", title: "Theme", group: "Display", route: "/settings/display", anchor: "appearance", terms: "theme paper midnight amoled dune color colours dark light system" },
  { id: "accent", title: "Accent color", group: "Display", route: "/settings/display", anchor: "appearance", terms: "accent colour color swatch brand" },
  { id: "look", title: "Look", group: "Display", route: "/settings/display", anchor: "appearance", terms: "look poster soft cards style layout" },
  { id: "density", title: "Density", group: "Display", route: "/settings/display", anchor: "appearance", terms: "density comfortable dense spacing compact" },
  { id: "launcher", title: "Launcher icon", group: "Display", route: "/settings/display", anchor: "appearance", terms: "launcher icon app icon art picture" },
  { id: "currency", title: "Currency", group: "Display", route: "/settings/display", anchor: "defaults", terms: "currency rupee dollar euro money symbol" },
  { id: "units", title: "Units", group: "Display", route: "/settings/display", anchor: "defaults", terms: "units distance km miles volume litres gallons temperature celsius fahrenheit time 12 24 hour" },
  { id: "autolink", title: "Auto-link vehicle costs", group: "Display", route: "/settings/display", anchor: "defaults", terms: "auto link fuel service expenses money vehicle costs spending" },
  { id: "reopen", title: "Reopen last screen", group: "Display", route: "/settings/display", anchor: "defaults", terms: "reopen last screen hours resume restore continue away" },
  { id: "online", title: "Online features", group: "Display", route: "/settings/display", anchor: "online", terms: "online network requests internet rates weather holidays offline" },
  { id: "home-city", title: "Home city (weather)", group: "Display", route: "/settings/display", anchor: "online", terms: "home city weather forecast location place" },
  { id: "netlog", title: "Network log", group: "Display", route: "/settings/display", anchor: "online", terms: "network log requests online history" },
  { id: "widgets", title: "Widgets and shortcuts", group: "Display", route: "/settings/display", anchor: "home", terms: "widgets shortcuts android home screen countdown budget battery" },
  { id: "packs", title: "Packs", group: "Display", route: "/settings/display", anchor: "home", terms: "packs templates share tools checklists rules file" },
  { id: "contrast", title: "High contrast", group: "Display", route: "/settings/display", anchor: "accessibility", terms: "high contrast visibility accessibility" },
  { id: "largetouch", title: "Large touch targets", group: "Display", route: "/settings/display", anchor: "accessibility", terms: "large touch targets buttons chips accessibility" },
  { id: "motion", title: "Reduce motion", group: "Display", route: "/settings/display", anchor: "accessibility", terms: "reduce motion animation effects accessibility" },

  // Security and privacy.
  { id: "app-lock", title: "App lock", group: "Security and privacy", route: "/settings/security", anchor: "security", terms: "finger finger fingerprint face biometrics biometric unlock pin passcode security lock app" },
  { id: "unlock", title: "How you unlock", group: "Security and privacy", route: "/settings/security", anchor: "security", terms: "unlock method lock fingerprint face pin both biometrics" },
  { id: "lock-timeout", title: "Lock again after switching away", group: "Security and privacy", route: "/settings/security", anchor: "security", terms: "lock timeout minutes seconds immediately away switching background" },
  { id: "lock-policy", title: "When the lock asks", group: "Security and privacy", route: "/settings/security", anchor: "security", terms: "lock asks when policy relaunch screen off" },
  { id: "module-locks", title: "Ask again for these modules", group: "Security and privacy", route: "/settings/security", anchor: "security", terms: "module locks lock modules pin biometrics again" },
  { id: "decoy", title: "Decoy PIN", group: "Security and privacy", route: "/settings/security", anchor: "security", terms: "decoy pin second hidden sample fake lock" },
  { id: "profiles", title: "Profiles", group: "Security and privacy", route: "/settings/security", anchor: "profiles", terms: "profiles add rename switch delete account personal" },
  { id: "clipboard", title: "Clear clipboard after copying", group: "Security and privacy", route: "/settings/security", anchor: "security", terms: "clipboard copy amounts clear wipe privacy" },
  { id: "privacy-mode", title: "Privacy mode", group: "Security and privacy", route: "/settings/security", anchor: "security", terms: "privacy mode mask amounts hide blur" },
  { id: "privacy-usage", title: "Privacy and usage", group: "Security and privacy", route: "/settings/security", anchor: "security", terms: "privacy usage permissions what stays data" },
  { id: "screenshots", title: "Allow screen sharing", group: "Security and privacy", route: "/settings/security", anchor: "security", terms: "screenshots screen sharing screen capture discord whatsapp demo" },
  { id: "emergency-card", title: "Emergency card", group: "Security and privacy", route: "/settings/security", anchor: "emergency", terms: "emergency blood group contact phone lock screen card plate" },
  { id: "emergency-show", title: "Show on the lock screen", group: "Security and privacy", route: "/settings/security", anchor: "emergency", terms: "emergency show lock screen card before unlock" },
  { id: "emergency-details", title: "Emergency contact details", group: "Security and privacy", route: "/settings/security", anchor: "emergency", terms: "emergency blood contact name phone note allergy" },

  // Notifications.
  { id: "reminders", title: "Reminders", group: "Notifications", route: "/settings/notifications", anchor: "reminders", terms: "reminders alarms schedule rules notify" },
  { id: "quiet-hours", title: "Quiet hours", group: "Notifications", route: "/settings/notifications", anchor: "reminders", terms: "quiet hours night silence do not disturb morning" },
  { id: "notice-sounds", title: "Notification sounds", group: "Notifications", route: "/settings/notifications", anchor: "channels", terms: "notification sounds channel android settings sound" },
  { id: "channel-reminders", title: "Reminders sound", group: "Notifications", route: "/settings/notifications", anchor: "channels", terms: "reminders sound notification channel" },
  { id: "channel-water", title: "Water sound", group: "Notifications", route: "/settings/notifications", anchor: "channels", terms: "water sound notification channel" },
  { id: "channel-smsAsk", title: "Bank text questions sound", group: "Notifications", route: "/settings/notifications", anchor: "channels", terms: "bank text upi question sound notification channel" },
  { id: "channel-cycle", title: "Cycle sound", group: "Notifications", route: "/settings/notifications", anchor: "channels", terms: "cycle period sound notification channel" },
  { id: "bank-texts", title: "Bank texts", group: "Notifications", route: "/settings/notifications", anchor: "bank-texts", terms: "sms bank texts notification access debit credit balance messages inbox upi codes" },
  { id: "lock-alerts", title: "Lock-screen alerts", group: "Notifications", route: "/settings/notifications", anchor: "lock-screen", terms: "lock screen alerts notifications reminders show" },
  { id: "notification-permission", title: "Notification permission", group: "Notifications", route: "/settings/notifications", anchor: "lock-screen", terms: "post notifications permission allow deny android settings" },
  { id: "lockscreen-note", title: "Lock-screen content", group: "Notifications", route: "/settings/notifications", anchor: "lock-screen", terms: "lock screen hide sensitive content bank texts reminder titles" },

  // Modules (the existing /modules screen).
  { id: "modules-enable", title: "Turn modules on or off", group: "Modules", route: "/modules", anchor: "", terms: "modules enable disable hide show menu" },
  { id: "modules-order", title: "Menu order", group: "Modules", route: "/modules", anchor: "", terms: "menu order reorder move arrange" },
  { id: "home-tiles", title: "Home board tiles", group: "Modules", route: "/modules", anchor: "", terms: "home board tiles reorder size enable" },

  // Data and backup.
  { id: "local-data", title: "Local data", group: "Data and backup", route: "/settings/data", anchor: "your-data", terms: "local data size vehicles fuel transactions storage" },
  { id: "encrypted", title: "Encrypted on this device", group: "Data and backup", route: "/settings/data", anchor: "your-data", terms: "encrypted aes keystore security at rest" },
  { id: "export", title: "Export everything", group: "Data and backup", route: "/settings/data", anchor: "your-data", terms: "export backup json file save" },
  { id: "restore", title: "Restore from backup", group: "Data and backup", route: "/settings/data", anchor: "your-data", terms: "restore backup merge replace file other phone" },
  { id: "export-table", title: "Export a table or calendar", group: "Data and backup", route: "/settings/data", anchor: "your-data", terms: "export csv table calendar ics spreadsheet" },
  { id: "timeline", title: "Timeline", group: "Data and backup", route: "/settings/data", anchor: "your-data", terms: "timeline history events" },
  { id: "review", title: "Year in Review", group: "Data and backup", route: "/settings/data", anchor: "your-data", terms: "year review summary counted" },
  { id: "diagnostics", title: "Diagnostics", group: "Data and backup", route: "/settings/data", anchor: "your-data", terms: "diagnostics health storage reminders network activity" },
  { id: "dev-logs", title: "Download logs for developer", group: "Data and backup", route: "/settings/data", anchor: "your-data", terms: "developer logs download share errors perf file" },
  { id: "self-check", title: "Run self-check", group: "Data and backup", route: "/settings/data", anchor: "your-data", terms: "self check diagnostics tests fix report" },
  { id: "sample-add", title: "Add sample data", group: "Data and backup", route: "/settings/data", anchor: "your-data", terms: "sample demo data add explore" },
  { id: "sample-remove", title: "Remove sample data", group: "Data and backup", route: "/settings/data", anchor: "your-data", terms: "sample demo data remove" },
  { id: "erase", title: "Erase all data", group: "Data and backup", route: "/settings/data", anchor: "your-data", terms: "erase delete reset wipe everything" },
  { id: "locked-file", title: "Locked file", group: "Data and backup", route: "/settings/data", anchor: "locked-file", terms: "locked file passphrase cloud drive onedrive upload copy" },
  { id: "cloud-store", title: "Store the locked file in the cloud", group: "Data and backup", route: "/settings/data", anchor: "locked-file", terms: "cloud drive onedrive upload sign in store backup" },

  // About.
  { id: "version", title: "Version", group: "About", route: "/settings/about", anchor: "about", terms: "version build number nucleus" },
  { id: "never-leave", title: "Your records never leave", group: "About", route: "/settings/about", anchor: "about", terms: "records never leave privacy online queries" },
  { id: "licences", title: "Licences", group: "About", route: "/settings/about", anchor: "licences", terms: "licences licenses credits open source expo react native material design icons open meteo weather" },
];

function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function scoreEntry(entry: SettingsEntry, query: string, terms: string[]): number {
  const title = entry.title.toLowerCase();
  if (title === query) return 100;
  const titleWords = words(entry.title);
  const keyWords = words(entry.terms);
  const groupWords = words(entry.group);
  let score = title.startsWith(query) ? 40 : 0;
  for (const term of terms) {
    if (term.length < MIN_TERM) return 0;
    if (titleWords.some((w) => w === term)) score += 50;
    else if (titleWords.some((w) => w.startsWith(term))) score += 40;
    else if (keyWords.includes(term)) score += 30;
    else if (keyWords.some((w) => w.startsWith(term))) score += 18;
    else if (groupWords.some((w) => w.startsWith(term))) score += 6;
    else return 0;
  }
  return score;
}

/** Ranked settings rows for a query. Close matches only; empty for empty or unknown input. */
export function searchSettings(query: string, limit: number = SETTINGS_SEARCH_LIMIT): SettingsSearchHit[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return [];
  const terms = q.split(" ").filter(Boolean);
  if (terms.length === 0 || terms.some((t) => t.length < MIN_TERM)) return [];
  const hits: SettingsSearchHit[] = [];
  for (const entry of SETTINGS_INDEX) {
    const score = scoreEntry(entry, q, terms);
    if (score > 0) hits.push({ ...entry, score });
  }
  hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  const max = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : SETTINGS_SEARCH_LIMIT;
  return hits.slice(0, max);
}
