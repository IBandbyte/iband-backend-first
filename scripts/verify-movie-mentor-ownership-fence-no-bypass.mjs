import assert from "node:assert/strict";
import fs from "node:fs";
const adapter=fs.readFileSync(new URL("../ai/MovieMentorCreatorStateMongoOperationAdapter.js",import.meta.url),"utf8");
const readiness=fs.readFileSync(new URL("../ai/MovieMentorCreatorStateAtomicReadiness.js",import.meta.url),"utf8");
// RED-first: a production-shaped transaction must never silently omit the
// ownership participant, even when legacy isolated tests omit that argument.
// This is a source-level gate only, not physical transaction certification.
assert.match(readiness,/createMongoCreatorStateAtomicAccept\(\{client,states,operations,ownerships\}\)/,"Canonical readiness must forward ownership collection.");
assert.match(adapter,/if\s*\(!ownerships\)/,"RED: adapter must fail closed if ownership storage is absent.");
assert.match(adapter,/ownerships\.updateOne\(/,"Ownership document must participate in transaction.");
console.log("GREEN: adapter requires ownership participant and canonical readiness forwards it.");
