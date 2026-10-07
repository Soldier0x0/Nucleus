import { Directory, File, Paths } from "expo-file-system";
import { EncodingType, readAsStringAsync, writeAsStringAsync } from "expo-file-system/legacy";
import { attachmentNeedsViewerMaterialize, looksLikePdfMagicFromBase64, stripDataUriBase64 } from "./paperNormalize";

export { attachmentNeedsViewerMaterialize } from "./paperNormalize";

const LARGE_B64_CHARS = 2_000_000;

function decodeBase64(b64: string): Uint8Array {
  if (typeof atob !== "function") throw new Error("base64 decode unavailable");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function ensurePaperViewDir(): Directory {
  const dir = new Directory(Paths.cache, "paper-view");
  if (!dir.exists) dir.create();
  return dir;
}

async function assertMaterializedPdf(dest: File): Promise<void> {
  if (!dest.exists) throw new Error("materialized file missing");
  if (dest.size <= 4) throw new Error("materialized file empty");
  const headB64 = await readAsStringAsync(dest.uri, { encoding: EncodingType.Base64, length: 4, position: 0 });
  const head = atob(headB64);
  if (!head.startsWith("%PDF")) throw new Error("materialized file is not a PDF");
}

async function writePdfToFile(dest: File, rawB64: string): Promise<void> {
  const b64 = stripDataUriBase64(rawB64);
  if (!b64) throw new Error("empty data URI");
  if (!looksLikePdfMagicFromBase64(b64)) throw new Error("data is not a PDF");

  if (dest.exists) dest.delete();
  dest.create();

  const preferLegacy = b64.length > LARGE_B64_CHARS;
  if (preferLegacy) {
    await writeAsStringAsync(dest.uri, b64, { encoding: EncodingType.Base64 });
  } else {
    try {
      const maybePromise = dest.write(decodeBase64(b64)) as void | Promise<void>;
      if (maybePromise && typeof (maybePromise as Promise<void>).then === "function") {
        await maybePromise;
      }
    } catch {
      await writeAsStringAsync(dest.uri, b64, { encoding: EncodingType.Base64 });
    }
  }
  await assertMaterializedPdf(dest);
}

/** True when a stored file/content URI cannot be opened (missing or zero length). */
export function localViewerUriMissing(uri: string): boolean {
  if (!uri.startsWith("file:")) return false;
  try {
    const file = new File(uri);
    return !file.exists || file.size <= 0;
  } catch {
    return true;
  }
}

/** Write data-URI PDFs to a local file so native PDF views can open them offline. */
export async function viewerUriForAttachment(uri: string, mime: string, cacheKey: string): Promise<string> {
  if (!uri.startsWith("data:")) return uri;
  if (!attachmentNeedsViewerMaterialize(uri, mime)) return uri;
  const dir = ensurePaperViewDir();
  const safe = cacheKey.replace(/[^a-zA-Z0-9_-]/g, "_");
  const dest = new File(dir, `${safe}.pdf`);
  const comma = uri.indexOf(",");
  const b64 = comma >= 0 ? uri.slice(comma + 1) : "";
  await writePdfToFile(dest, b64);
  return dest.uri;
}
