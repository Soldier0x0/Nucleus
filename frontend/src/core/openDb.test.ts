import assert from "node:assert/strict";
import test from "node:test";
import { deviceKeyAction, planOpen, resolveOpen, writeReplacement } from "./openDb.ts";

test("a corrupt current snapshot is unreadable and does not drop the legacy copy", async () => {
  const plan = planOpen("not-json", `{"ok":true}`);
  assert.equal(plan.status, "read");
  assert.equal(plan.status === "read" && plan.dropLegacyNow, true);
  const outcome = await resolveOpen(plan, async () => {
    throw new Error("auth failed");
  });
  assert.deepEqual(outcome, { status: "unreadable" });
});

test("plaintext that is not JSON is unreadable", async () => {
  const outcome = await resolveOpen(planOpen("{", null), async (raw) => raw);
  assert.equal(outcome.status, "unreadable");
});

test("a readable legacy snapshot is kept until the new copy is saved", async () => {
  const outcome = await resolveOpen(planOpen(null, `{"version":1}`), async (raw) => raw);
  assert.deepEqual(outcome, {
    status: "opened",
    json: `{"version":1}`,
    dropLegacyNow: false,
    dropLegacyAfterSave: true,
  });
});

test("a readable current snapshot may drop legacy only because the current copy is already stored", async () => {
  const outcome = await resolveOpen(planOpen(`{"version":1}`, `{"version":0}`), async (raw) => raw);
  assert.equal(outcome.status, "opened");
  if (outcome.status !== "opened") return;
  assert.equal(outcome.dropLegacyNow, true);
  assert.equal(outcome.dropLegacyAfterSave, false);
  assert.equal(outcome.json, `{"version":1}`);
});

test("decrypt never mints or replaces a device key", () => {
  assert.equal(deviceKeyAction(null, "decrypt"), "refuse");
  assert.equal(deviceKeyAction(new Uint8Array(16), "decrypt"), "refuse");
  assert.equal(deviceKeyAction(new Uint8Array(32), "decrypt"), "use");
  assert.equal(deviceKeyAction(null, "encrypt"), "create");
  assert.equal(deviceKeyAction(new Uint8Array(16), "encrypt"), "refuse");
  assert.equal(deviceKeyAction(new Uint8Array(32), "encrypt"), "use");
});

test("a failed replacement write does not rotate the key or delete legacy", async () => {
  const calls: string[] = [];
  await assert.rejects(
    writeReplacement("{}", {
      inspect: async () => "ok",
      currentKey: async () => new Uint8Array(32),
      newKey: () => new Uint8Array(32),
      seal: async () => "sealed",
      putDocument: async () => {
        calls.push("putDocument");
        throw new Error("disk full");
      },
      putKey: async () => {
        calls.push("putKey");
      },
      removeLegacy: async () => {
        calls.push("removeLegacy");
      },
    }),
    /disk full/,
  );
  assert.deepEqual(calls, ["putDocument"]);
});

test("replacing data stores a new key only after the document write, and only when the slot is unusable", async () => {
  const calls: string[] = [];
  await writeReplacement("{}", {
    inspect: async () => "missing",
    currentKey: async () => {
      throw new Error("no key");
    },
    newKey: () => new Uint8Array(32),
    seal: async (_plain, key) => {
      calls.push(`seal:${key.length}`);
      return "sealed";
    },
    putDocument: async () => {
      calls.push("putDocument");
    },
    putKey: async () => {
      calls.push("putKey");
    },
    removeLegacy: async () => {
      calls.push("removeLegacy");
    },
  });
  assert.deepEqual(calls, ["seal:32", "putDocument", "putKey", "removeLegacy"]);
});

test("an existing good key is left in place when replacing the document", async () => {
  let keyWrites = 0;
  await writeReplacement("{}", {
    inspect: async () => "ok",
    currentKey: async () => new Uint8Array(32),
    newKey: () => {
      throw new Error("should not mint");
    },
    seal: async () => "sealed",
    putDocument: async () => {},
    putKey: async () => {
      keyWrites += 1;
    },
    removeLegacy: async () => {},
  });
  assert.equal(keyWrites, 0);
});
