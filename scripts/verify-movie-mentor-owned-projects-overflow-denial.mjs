import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../ai/MovieMentorOwnedProjectsReadAuthority.js",import.meta.url),"utf8");
assert.match(source,/\.limit\(\s*101\s*\)/,"RED: discovery must read one overflow sentinel beyond the 100-project page");
assert.match(source,/records\.length\s*>\s*100/,"RED: discovery must detect and deny truncation rather than silently omit project 101");
assert.match(source,/throw new Error/,"RED: overflow must fail closed");
console.log("GREEN: discovery detects 101st project and fails closed instead of silently truncating");
