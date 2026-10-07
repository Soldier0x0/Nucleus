import { stripDataUriBase64 } from "./paperNormalize";

/** Decoded byte length for a base64 payload (no data-URI prefix). */
export function base64DecodedByteLength(b64: string): number {
  const stripped = stripDataUriBase64(b64);
  if (!stripped) return 0;
  let padding = 0;
  if (stripped.endsWith("==")) padding = 2;
  else if (stripped.endsWith("=")) padding = 1;
  return Math.floor((stripped.length * 3) / 4) - padding;
}

export function validateMaterializedPdfBytes(size: number, headText: string, tailText: string, expectedBytes: number): void {
  if (size !== expectedBytes) throw new Error(`materialized size ${size} != ${expectedBytes}`);
  if (!headText.startsWith("%PDF")) throw new Error("materialized file is not a PDF");
  if (!tailText.includes("%%EOF")) throw new Error("materialized PDF missing %%EOF");
}

/** react-native-pdf wants a bare absolute path, not Expo `File.uri` (`file://…`). */
export function toPdfSourcePath(uri: string): string {
  if (uri.startsWith("file:///")) return uri.slice(7);
  if (uri.startsWith("file:/")) return uri.slice(5);
  return uri;
}

/**
 * `cache: false` only on disposable cache copies (bare paths).
 * Never unlink vault `file://` paths under Documents/papers.
 */
export function pdfSourceUsesCache(uri: string): boolean {
  if (uri.startsWith("data:")) return true;
  if (uri.startsWith("file:")) return true;
  return false;
}
