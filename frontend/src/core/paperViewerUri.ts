import { File } from "expo-file-system";
import { EncodingType, readAsStringAsync } from "expo-file-system/legacy";
import ReactNativeBlobUtil from "react-native-blob-util";
import { attachmentNeedsViewerMaterialize, looksLikeJpegMagicFromBase64, looksLikePdfMagicFromBase64, stripDataUriBase64 } from "./paperNormalize";
import { base64DecodedByteLength, toPdfSourcePath, validateMaterializedPdfBytes } from "./paperViewerPath";

export { attachmentNeedsViewerMaterialize } from "./paperNormalize";
export { toPdfSourcePath, pdfSourceUsesCache } from "./paperViewerPath";

export class MistaggedJpegError extends Error {
  constructor() {
    super("mistagged jpeg");
    this.name = "MistaggedJpegError";
  }
}

const PAPER_VIEW_SUBDIR = "paper-view";

function fileUriForPath(path: string): string {
  const bare = toPdfSourcePath(path);
  if (bare.startsWith("/")) return `file://${bare}`;
  return path.startsWith("file:") ? path : `file://${bare}`;
}

async function assertMaterializedPdfAtPath(path: string, expectedBytes: number): Promise<void> {
  const uri = fileUriForPath(path);
  const stat = await ReactNativeBlobUtil.fs.stat(path);
  const size = typeof stat.size === "number" ? stat.size : Number(stat.size);
  const headB64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64, length: 4, position: 0 });
  const head = atob(headB64);
  const tailLen = Math.min(32, size);
  const tailPos = Math.max(0, size - tailLen);
  const tailB64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64, length: tailLen, position: tailPos });
  const tail = atob(tailB64);
  validateMaterializedPdfBytes(size, head, tail, expectedBytes);
}

async function ensurePaperViewDir(): Promise<string> {
  const dir = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${PAPER_VIEW_SUBDIR}`;
  const exists = await ReactNativeBlobUtil.fs.exists(dir);
  if (!exists) await ReactNativeBlobUtil.fs.mkdir(dir);
  return dir;
}

async function writePdfToCachePath(cacheKey: string, rawB64: string): Promise<string> {
  const b64 = stripDataUriBase64(rawB64);
  if (!b64) throw new Error("empty data URI");
  if (!looksLikePdfMagicFromBase64(b64)) {
    if (looksLikeJpegMagicFromBase64(b64)) throw new MistaggedJpegError();
    throw new Error("data is not a PDF");
  }

  const dir = await ensurePaperViewDir();
  const safe = cacheKey.replace(/[^a-zA-Z0-9_-]/g, "_");
  const path = `${dir}/${safe}.pdf`;
  const expectedBytes = base64DecodedByteLength(b64);

  if (await ReactNativeBlobUtil.fs.exists(path)) {
    await ReactNativeBlobUtil.fs.unlink(path);
  }
  await ReactNativeBlobUtil.fs.writeFile(path, b64, "base64");
  await assertMaterializedPdfAtPath(path, expectedBytes);
  return path;
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
  if (!uri.startsWith("data:")) return toPdfSourcePath(uri);
  if (!attachmentNeedsViewerMaterialize(uri, mime)) return uri;
  const comma = uri.indexOf(",");
  const b64 = comma >= 0 ? uri.slice(comma + 1) : "";
  return writePdfToCachePath(cacheKey, b64);
}
