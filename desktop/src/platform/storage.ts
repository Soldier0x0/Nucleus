/**
 * Document storage + vault files.
 *
 * In the native app everything lives under the Tauri app-data directory:
 * - `storage.json` holds the small key/value map (the encrypted document envelope)
 * - `vault/` holds paper attachments (PDFs, photos)
 *
 * In a plain browser (`yarn dev`) the same API falls back to localStorage so the
 * UI can be previewed. The browser fallback is dev-only and not secure: secrets
 * written there are labelled by the secure store.
 */
import { BaseDirectory, exists, mkdir, readDir, readFile, readTextFile, remove, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { isTauri } from "./env";
import { fromB64, toB64 } from "./crypto";

const KV_FILE = "storage.json";
const VAULT_DIR = "vault";
const VAULT_PREFIX = "nucleus.desktop.vault.";

type Kv = Record<string, string>;

/** Serialize writes so two quick saves cannot clobber each other. */
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

// ---------- key/value documents ----------
async function readKv(): Promise<Kv> {
  if (!isTauri()) return {};
  try {
    if (!(await exists(KV_FILE, { baseDir: BaseDirectory.AppData }))) return {};
    return JSON.parse(await readTextFile(KV_FILE, { baseDir: BaseDirectory.AppData })) as Kv;
  } catch {
    return {};
  }
}

async function writeKv(kv: Kv): Promise<void> {
  await mkdir("", { baseDir: BaseDirectory.AppData, recursive: true }).catch(() => {});
  await writeTextFile(KV_FILE, JSON.stringify(kv), { baseDir: BaseDirectory.AppData });
}

export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (!isTauri()) return localStorage.getItem(key);
    const kv = await readKv();
    return Object.prototype.hasOwnProperty.call(kv, key) ? kv[key] : null;
  },

  async setItem(key: string, value: string): Promise<void> {
    if (!isTauri()) {
      localStorage.setItem(key, value);
      return;
    }
    await serial(async () => {
      const kv = await readKv();
      kv[key] = value;
      await writeKv(kv);
    });
  },

  async removeItem(key: string): Promise<void> {
    if (!isTauri()) {
      localStorage.removeItem(key);
      return;
    }
    await serial(async () => {
      const kv = await readKv();
      delete kv[key];
      await writeKv(kv);
    });
  },
};

// ---------- vault files ----------
export function safeVaultName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^\.+/, "_").slice(0, 120);
  return cleaned || "file";
}

export const vault = {
  async save(name: string, bytes: Uint8Array): Promise<string> {
    const clean = safeVaultName(name);
    if (!isTauri()) {
      localStorage.setItem(VAULT_PREFIX + clean, toB64(bytes));
      return clean;
    }
    await mkdir(VAULT_DIR, { baseDir: BaseDirectory.AppData, recursive: true }).catch(() => {});
    await writeFile(`${VAULT_DIR}/${clean}`, bytes, { baseDir: BaseDirectory.AppData });
    return clean;
  },

  async read(name: string): Promise<Uint8Array | null> {
    const clean = safeVaultName(name);
    if (!isTauri()) {
      const raw = localStorage.getItem(VAULT_PREFIX + clean);
      return raw ? fromB64(raw) : null;
    }
    try {
      return await readFile(`${VAULT_DIR}/${clean}`, { baseDir: BaseDirectory.AppData });
    } catch {
      return null;
    }
  },

  async list(): Promise<string[]> {
    if (!isTauri()) {
      const out: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(VAULT_PREFIX)) out.push(key.slice(VAULT_PREFIX.length));
      }
      return out.sort();
    }
    try {
      const entries = await readDir(VAULT_DIR, { baseDir: BaseDirectory.AppData });
      return entries.filter((e) => e.isFile).map((e) => e.name).sort();
    } catch {
      return [];
    }
  },

  async remove(name: string): Promise<void> {
    const clean = safeVaultName(name);
    if (!isTauri()) {
      localStorage.removeItem(VAULT_PREFIX + clean);
      return;
    }
    await remove(`${VAULT_DIR}/${clean}`, { baseDir: BaseDirectory.AppData }).catch(() => {});
  },

  /** Absolute path for the system opener; null in the browser preview. */
  async absolutePath(name: string): Promise<string | null> {
    if (!isTauri()) return null;
    const { appDataDir, join } = await import("@tauri-apps/api/path");
    return join(await appDataDir(), VAULT_DIR, safeVaultName(name));
  },
};

export const localPrefs = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* preview only */
    }
  },
};
