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

test("v0.12: media permissions are blocked and backups of the app data are refused", () => {
  const app = JSON.parse(read("../../app.json"));
  const blocked: string[] = app.expo.android.blockedPermissions;
  for (const perm of ["android.permission.READ_MEDIA_IMAGES", "android.permission.READ_MEDIA_VIDEO", "android.permission.READ_MEDIA_VISUAL_USER_SELECTED"]) {
    assert.ok(blocked.includes(perm), perm);
  }
  const props = app.expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === "expo-build-properties") as [string, { android: Record<string, unknown> }] | undefined;
  assert.ok(props, "expo-build-properties plugin");
  assert.equal(props[1].android.allowBackup, false);
});

