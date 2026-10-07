import { Directory, File, Paths } from "expo-file-system";
import { attachmentNeedsViewerMaterialize } from "./paperNormalize";

export { attachmentNeedsViewerMaterialize } from "./paperNormalize";

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

/** Write data-URI PDFs to a local file so native PDF views can open them offline. */
export async function viewerUriForAttachment(uri: string, mime: string, cacheKey: string): Promise<string> {
  if (!uri.startsWith("data:")) return uri;
  if (!attachmentNeedsViewerMaterialize(uri, mime)) return uri;
  const dir = ensurePaperViewDir();
  const safe = cacheKey.replace(/[^a-zA-Z0-9_-]/g, "_");
  const dest = new File(dir, `${safe}.pdf`);
  if (dest.exists) dest.delete();
  dest.create();
  const comma = uri.indexOf(",");
  const b64 = comma >= 0 ? uri.slice(comma + 1) : "";
  if (!b64) throw new Error("empty data URI");
  dest.write(decodeBase64(b64));
  return dest.uri;
}
