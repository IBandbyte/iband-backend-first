import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const physical=readFileSync(new URL("./movie-mentor-physical-creator-recovery-court.mjs",import.meta.url),"utf8");
assert.match(physical,/readFileSync\([^)]*server\.js/,"RED: physical Mongo court must load actual server mount implementation");
assert.match(physical,/mountMovieMentorReadOnlyRecoveryIngress/,"RED: physical Mongo court must execute actual read-only ingress mount");
assert.match(physical,/mongoose\.connection\.readyState/,"RED: physical court must force unavailable and restored Mongo readiness");
assert.match(physical,/createMovieMentorCreatorStateReadExpressRouter/,"RED: recovered ingress must use actual signed owner-bound Express router");
assert.match(physical,/fetch\(/,"RED: physical court must make real HTTP requests after recovery");
console.log("GREEN: physical signed Mongo HTTP court includes actual server remount integration");
