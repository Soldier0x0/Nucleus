import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Directory, File, Paths } from "expo-file-system";
import { readAsStringAsync, EncodingType } from "expo-file-system/legacy";
import type { Paper } from "./types";
export const MAX_IMAGE_B64 = 500_000;
export const MAX_PDF_BYTES = 2_400_000;

export function paperAttachSizeHint(): string {
  const pdfMb = (MAX_PDF_BYTES / 1_000_000).toFixed(1);
  const photoKb = Math.round((MAX_IMAGE_B64 * 0.75) / 1000);
  return `PDFs up to ${pdfMb} MB, photos up to about ${photoKb} KB when saved on this phone.`;
}

export function paperTooBigToast(): string {
  return `That file is too large for on-phone storage. ${paperAttachSizeHint()}`;
}

export type PaperPick = { uri: string; mime: string };

export { normalizePaper, paperAttachmentUri, paperBadge, paperIsPdf, paperMime } from "./paperNormalize";

async function readFileBase64(uri: string): Promise<string | null> {
  try {
    return await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
  } catch {
    return null;
  }
}

function ensurePapersDocumentDir(): Directory {
  const dir = new Directory(Paths.document, "papers");
  if (!dir.exists) dir.create();
  return dir;
}

/** Best-effort delete of on-disk paper overflow files (not data: vault blobs). */
export function bestEffortDeletePaperFiles(paper: Paper): void {
  for (const uri of [paper.file, paper.photo]) {
    if (!uri?.startsWith("file:")) continue;
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch {
      /* missing file is fine */
    }
  }
}

export async function storePaperFile(paperId: string, uri: string, mime: string): Promise<string> {
  if (uri.startsWith("data:")) return uri;
  if (mime === "application/pdf") {
    const b64 = await readFileBase64(uri);
    if (!b64) return uri;
    if (b64.length * 0.75 > MAX_PDF_BYTES) {
      const dir = ensurePapersDocumentDir();
      const dest = new File(dir, `${paperId}.pdf`);
      if (dest.exists) dest.delete();
      dest.create();
      const src = new File(uri);
      src.copySync(dest);
      return dest.uri;
    }
    return `data:application/pdf;base64,${b64}`;
  }
  const b64 = await readFileBase64(uri);
  if (b64 && b64.length <= MAX_IMAGE_B64) return `data:image/jpeg;base64,${b64}`;
  return uri;
}

/** Gallery only — no document picker fallback. */
export async function pickPaperPhoto(): Promise<PaperPick | null | "too-big" | "denied"> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return "denied";
  const image = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6, base64: true, allowsEditing: true });
  if (image.canceled || !image.assets[0]?.base64) return null;
  if (image.assets[0].base64.length > MAX_IMAGE_B64) return "too-big";
  return { uri: `data:image/jpeg;base64,${image.assets[0].base64}`, mime: "image/jpeg" };
}

/** Files picker only — PDF and images. */
export async function pickPaperDocument(): Promise<PaperPick | null | "too-big" | "denied"> {
  const doc = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/*"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (doc.canceled || !doc.assets[0]?.uri) return null;
  const asset = doc.assets[0];
  const mime = asset.mimeType ?? (asset.name?.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
  if (mime === "application/pdf") {
    const b64 = await readFileBase64(asset.uri);
    if (!b64) return null;
    if (b64.length * 0.75 > MAX_PDF_BYTES) return "too-big";
    return { uri: `data:application/pdf;base64,${b64}`, mime: "application/pdf" };
  }
  const b64 = await readFileBase64(asset.uri);
  if (!b64) return null;
  if (b64.length > MAX_IMAGE_B64) return "too-big";
  return { uri: `data:${mime};base64,${b64}`, mime };
}

/** @deprecated Use pickPaperPhoto or pickPaperDocument. */
export async function pickPaperAttachment(): Promise<PaperPick | null | "too-big" | "denied"> {
  return pickPaperPhoto();
}
