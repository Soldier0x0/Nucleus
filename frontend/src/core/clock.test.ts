import assert from "node:assert/strict";
import test from "node:test";
import { clockOk } from "./clock.ts";

test("M10: valid HH:MM times are accepted", () => {
  for (const t of ["00:00", "09:30", "7:05", "23:59", " 18:15 "]) assert.equal(clockOk(t), true, t);
});

test("M10: an empty or malformed time is rejected instead of reading as 00:00", () => {
  for (const t of ["", " ", "9", "09:", ":30", "24:00", "12:60", "9:5", "ab:cd", "09:30:00", "-1:30"]) assert.equal(clockOk(t), false, t);
});
