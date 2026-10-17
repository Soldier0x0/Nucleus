/** Shared sniffing for dropped and attached files (v0.14). */

const IMAGE_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
};

const OTHER_MIME: Record<string, string> = {
  pdf: "application/pdf",
};

export function mimeFromExt(ext: string): string | null {
  const key = ext.toLowerCase();
  return OTHER_MIME[key] ?? IMAGE_MIME[key] ?? null;
}

/** True when the file type can attach as a page (PDF or image). */
export function isAttachableMime(mime: string): boolean {
  return mime === "application/pdf" || mime.startsWith("image/");
}
