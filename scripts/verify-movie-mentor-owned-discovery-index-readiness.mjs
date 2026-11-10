import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../ai/MovieMentorOwnedProjectsReadAuthority.js",import.meta.url),"utf8");
assert.match(source,/\.indexes\(/,"RED: discovery must inspect physical Mongo index readiness before reading");
assert.match(source,/ownerPrincipalId/,"RED: discovery must bind authenticated owner");
assert.match(source,/projectId/,"RED: discovery must bind durable project identity");
assert.match(source,/unique\s*===\s*true|unique\s*:\s*true/,"RED: discovery must require physically unique project ownership index");
assert.match(source,/throw new Error/,"RED: missing physical index must fail closed");
console.log("GREEN: owner discovery requires physical unique-index readiness before enumerating");
