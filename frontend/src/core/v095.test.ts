import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PDF_VIEWER_FAIL_BODY, PREPARE_FILE_FAIL_BODY } from "./documentViewerCopy.ts";
import {
  dataUriBase64Payload,
  looksLikeJpegMagicFromBase64,
  looksLikePdfMagicFromBase64,
  mistaggedJpegDataUri,
} from "./paperNormalize.ts";
import { base64DecodedByteLength, pdfSourceUsesCache, toPdfSourcePath, validateMaterializedPdfBytes } from "./paperViewerPath.ts";

const readBin = (name: string) => readFileSync(new URL(`../../fixtures/${name}`, import.meta.url));

test("distinct fail bodies for prepare vs viewer", () => {
  assert.equal(PREPARE_FILE_FAIL_BODY, "Could not prepare the file.");
  assert.equal(PDF_VIEWER_FAIL_BODY, "The viewer could not read this PDF.");
  assert.notEqual(PREPARE_FILE_FAIL_BODY, PDF_VIEWER_FAIL_BODY);
});

test("toPdfSourcePath strips file:/// and file:/ prefixes", () => {
  assert.equal(toPdfSourcePath("file:///data/user/0/cache/x.pdf"), "/data/user/0/cache/x.pdf");
  assert.equal(toPdfSourcePath("file:/data/user/0/cache/x.pdf"), "/data/user/0/cache/x.pdf");
  assert.equal(toPdfSourcePath("/data/user/0/cache/x.pdf"), "/data/user/0/cache/x.pdf");
  assert.equal(toPdfSourcePath("data:application/pdf;base64,abc"), "data:application/pdf;base64,abc");
});

test("pdfSourceUsesCache: disposable cache path vs vault file and data URI", () => {
  assert.equal(pdfSourceUsesCache("/data/user/0/cache/paper-view/p1.pdf"), false);
  assert.equal(pdfSourceUsesCache("file:///data/user/0/Documents/papers/p1.pdf"), true);
  assert.equal(pdfSourceUsesCache("data:application/pdf;base64,abc"), true);
});

test("base64 write round-trip size head and tail on insurance sample A", () => {
  const bytes = readBin("nucleus-sample-insurance-a.pdf");
  const b64 = bytes.toString("base64");
  const expected = base64DecodedByteLength(b64);
  assert.equal(expected, bytes.length);
  assert.equal(looksLikePdfMagicFromBase64(b64), true);
  const head = bytes.subarray(0, 4).toString("utf8");
  const tail = bytes.subarray(bytes.length - 32).toString("utf8");
  validateMaterializedPdfBytes(bytes.length, head, tail, expected);
  assert.match(tail, /%%EOF/);
});

test("base64 write round-trip size head and tail on insurance sample B", () => {
  const bytes = readBin("nucleus-sample-insurance-b.pdf");
  const b64 = bytes.toString("base64");
  const expected = base64DecodedByteLength(b64);
  assert.equal(expected, bytes.length);
  const head = bytes.subarray(0, 4).toString("utf8");
  const tail = bytes.subarray(bytes.length - 32).toString("utf8");
  validateMaterializedPdfBytes(bytes.length, head, tail, expected);
});

test("mistagged JPEG labeled PDF sniffs to image fallback", () => {
  const jpegHead = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString("base64");
  assert.equal(looksLikeJpegMagicFromBase64(jpegHead), true);
  assert.equal(looksLikePdfMagicFromBase64(jpegHead), false);
  const uri = `data:application/pdf;base64,${jpegHead}`;
  assert.equal(mistaggedJpegDataUri(uri, "application/pdf"), true);
  assert.equal(dataUriBase64Payload(uri), jpegHead);
  assert.equal(mistaggedJpegDataUri(uri, "image/jpeg"), false);
});
