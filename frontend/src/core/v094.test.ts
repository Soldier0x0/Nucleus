import assert from "node:assert/strict";
import test from "node:test";
import {
  allowScreenSharing,
  attachmentNeedsViewerMaterialize,
  looksLikePdfMagicFromBase64,
  stripDataUriBase64,
} from "./paperNormalize.ts";

test("stripDataUriBase64 removes wraps and spaces", () => {
  assert.equal(stripDataUriBase64("YWJj\nZGVm"), "YWJjZGVm");
  assert.equal(stripDataUriBase64("  YQ==  "), "YQ==");
});

test("looksLikePdfMagicFromBase64 checks %PDF header", () => {
  const pdfHead = Buffer.from("%PDF-1.4").toString("base64");
  assert.equal(looksLikePdfMagicFromBase64(pdfHead), true);
  assert.equal(looksLikePdfMagicFromBase64("notpdf"), false);
});

test("images skip viewer materialize; PDF data URIs do not", () => {
  assert.equal(attachmentNeedsViewerMaterialize("data:image/jpeg;base64,abc", "image/jpeg"), false);
  assert.equal(attachmentNeedsViewerMaterialize("data:application/pdf;base64,abc", "application/pdf"), true);
});

test("allow screen sharing is the inverse of blockScreenshots", () => {
  assert.equal(allowScreenSharing(true), false);
  assert.equal(allowScreenSharing(false), true);
});
