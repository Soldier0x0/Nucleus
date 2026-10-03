import { File, Paths } from "expo-file-system";
import { buildBackup } from "@/src/core/backup";
import { encryptWithPassword } from "@/src/core/crypto";
import type { DB } from "@/src/core/types";
import { bundleForFile, FILE_PASSPHRASE_KEY } from "@/src/core/vaultFile";
import { secureStorage } from "@/src/utils/storage";
import { writeLockedFile } from "./android";

export { FILE_PASSPHRASE_KEY };

/** Encrypts the whole document and stores that one file. The passphrase is not inside the file. */
export async function uploadLockedCopy(db: DB, passphrase: string): Promise<boolean> {
  const secret = passphrase.trim();
  if (!secret) return false;
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
  const ok = await writeLockedFile(file.uri);
  if (ok) await secureStorage.setItem(FILE_PASSPHRASE_KEY, secret);
  return ok;
}
