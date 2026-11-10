import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../ai/MovieMentorOwnedProjectsReadAuthority.js",import.meta.url),"utf8");
assert.match(source,/ownerPrincipalId/, "RED: discovery must filter by authenticated owner");
assert.match(source,/\.limit\(\s*\d+\s*\)/, "RED: discovery must bound Mongo results to avoid unbounded owner enumeration");
assert.match(source,/\.sort\(/, "RED: bounded discovery must have deterministic ordering");
assert.doesNotMatch(source,/\.insertOne\(|\.updateOne\(|\.deleteOne\(/, "RED: discovery must remain read-only");
console.log("GREEN: owner discovery is bounded, deterministic and read-only");
