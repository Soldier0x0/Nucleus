import { File, Paths } from "expo-file-system";
import { EncodingType, writeAsStringAsync } from "expo-file-system/legacy";

/** Write data-URI PDFs to a local file so native PDF views can open them offline. */
export async function viewerUriForAttachment(uri: string, mime: string, cacheKey: string): Promise<string> {
  if (!uri.startsWith("data:")) return uri;
  const dir = new File(Paths.cache, "paper-view");
  if (!dir.exists) dir.create();
  const ext = mime === "application/pdf" ? "pdf" : "jpg";
  const dest = new File(dir, `${cacheKey.replace(/[^a-zA-Z0-9_-]/g, "_")}.${ext}`);
  if (dest.exists) dest.delete();
  dest.create();
  const comma = uri.indexOf(",");
  const b64 = comma >= 0 ? uri.slice(comma + 1) : "";
  if (!b64) return uri;
  await writeAsStringAsync(dest.uri, b64, { encoding: EncodingType.Base64 });
  return dest.uri;
}
