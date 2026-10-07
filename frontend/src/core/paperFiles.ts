import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { File, Paths } from "expo-file-system";
import { readAsStringAsync, EncodingType } from "expo-file-system/legacy";
const MAX_IMAGE_B64 = 180_000;
const MAX_PDF_BYTES = 2_400_000;

export type PaperPick = { uri: string; mime: string };

export { normalizePaper, paperAttachmentUri, paperBadge, paperIsPdf, paperMime } from "./paperNormalize";

async function readFileBase64(uri: string): Promise<string | null> {
  try {
    return await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
  } catch {
    return null;
  }
}

export async function storePaperFile(paperId: string, uri: string, mime: string): Promise<string> {
  if (uri.startsWith("data:")) return uri;
  if (mime === "application/pdf") {
    const b64 = await readFileBase64(uri);
    if (!b64) return uri;
    if (b64.length * 0.75 > MAX_PDF_BYTES) {
      const dir = new File(Paths.document, "papers");
      if (!dir.exists) dir.create();
      const dest = new File(dir, `${paperId}.pdf`);
      if (dest.exists) dest.delete();
      dest.create();
      const src = new File(uri);
      dest.write(src);
      return dest.uri;
    }
    return `data:application/pdf;base64,${b64}`;
  }
  const b64 = await readFileBase64(uri);
  if (b64 && b64.length <= MAX_IMAGE_B64) return `data:image/jpeg;base64,${b64}`;
  return uri;
}

export async function pickPaperAttachment(): Promise<PaperPick | null | "too-big" | "denied"> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return "denied";
  const image = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.25, base64: true, allowsEditing: true });
  if (!image.canceled && image.assets[0]?.base64) {
    if (image.assets[0].base64.length > MAX_IMAGE_B64) return "too-big";
    return { uri: `data:image/jpeg;base64,${image.assets[0].base64}`, mime: "image/jpeg" };
  }
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
