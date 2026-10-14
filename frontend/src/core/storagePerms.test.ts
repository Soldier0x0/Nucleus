import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("storage permissions are blocked, so the Expo max-SDK override has nothing to fix", () => {
  const blocked: string[] = JSON.parse(read("../../app.json")).expo.android.blockedPermissions;
  assert.ok(blocked.includes("android.permission.READ_EXTERNAL_STORAGE"));
  assert.ok(blocked.includes("android.permission.WRITE_EXTERNAL_STORAGE"));
});

test("photo pickers skip the media-library permission ask on Android", () => {
  for (const file of ["../components/PhotoPick.tsx", "./paperFiles.ts"]) {
    assert.match(read(file), /Platform\.OS === "android" \? \{ granted: true \} : await ImagePicker\.requestMediaLibraryPermissionsAsync\(\)/, file);
  }
});
