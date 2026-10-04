import { File, Paths } from "expo-file-system";
import { buildBackup } from "@/src/core/backup";
import { encryptWithPassword } from "@/src/core/crypto";
import type { CloudProvider, DB } from "@/src/core/types";
import { bundleForFile, cloudSignIn, cloudStoreMessage, FILE_PASSPHRASE_KEY } from "@/src/core/vaultFile";
import { secureStorage } from "@/src/utils/storage";
import { storeLockedFile } from "./android";

export { FILE_PASSPHRASE_KEY };

/** Encrypts the document, signs in to the chosen account, and uploads that one file. */
export async function storeLockedCopy(db: DB, passphrase: string, provider: CloudProvider): Promise<{ ok: boolean; message: string }> {
  if (provider === "off") {
    const sign = cloudSignIn(provider);
    return { ok: false, message: sign.ok ? "Choose Drive or OneDrive first." : sign.message };
  }
  const sign = cloudSignIn(provider);
  if (!sign.ok) return { ok: false, message: sign.message };
  const secret = passphrase.trim();
  if (!secret) return { ok: false, message: cloudStoreMessage(provider, "the passphrase is empty") };
  const payload = buildBackup(bundleForFile(db));
  const enc = await encryptWithPassword(JSON.stringify(payload), secret);
  const json = JSON.stringify({
    format: "nucleus-backup",
    schema: 2,
    encrypted: true,
    exportedAt: payload.exportedAt,
    enc,
  });
  const file = new File(Paths.cache, "nucleus-locked.json");
  if (file.exists) file.delete();
  file.create();
  file.write(json);
  const result = await storeLockedFile(provider, file.uri);
  if (result.ok) await secureStorage.setItem(FILE_PASSPHRASE_KEY, secret);
  return result;
}
