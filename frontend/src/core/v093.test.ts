import assert from "node:assert/strict";
import test from "node:test";
import { attachmentNeedsViewerMaterialize } from "./paperNormalize.ts";

test("images skip viewer materialize; PDF data URIs do not", () => {
  assert.equal(attachmentNeedsViewerMaterialize("data:image/jpeg;base64,abc", "image/jpeg"), false);
  assert.equal(attachmentNeedsViewerMaterialize("data:application/pdf;base64,abc", "application/pdf"), true);
  assert.equal(attachmentNeedsViewerMaterialize("file:///papers/x.pdf", "application/pdf"), false);
});

test("failed materialize predicate leaves non-data file URIs alone", () => {
  assert.equal(attachmentNeedsViewerMaterialize("file:///cache/paper-view/x.pdf", "application/pdf"), false);
});
