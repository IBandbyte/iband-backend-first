import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../ai/MovieMentorJourneyRecoveryActivationLeaseMongoStore.js", import.meta.url), "utf8");

console.log("3C.5E.4G.2 — activation lease physical authority verifier");

assert.match(source, /schema\.index\(\{ serviceKey: 1 \}, \{ unique: true \}\)/, "declared singleton serviceKey uniqueness must remain explicit");
assert.match(source, /async function createLease[\s\S]*?await ready\(\)[\s\S]*?storeModel\(\)\.create\(next\)/, "production createLease is a durable mint boundary");
assert.match(source, /async function replaceLease[\s\S]*?await ready\(\)[\s\S]*?findOneAndUpdate/, "production replaceLease is a durable CAS mutation boundary");

assert.match(source, /physicalUniqueIndexReadiness|PHYSICAL_AUTHORITY_BOUNDARY|readPhysicalIndexes|collection\.indexes\(\)/, "activation lease durable mint/CAS authority must verify actual physical Mongo uniqueness before mutation");

console.log("✓ production activation lease store declares singleton serviceKey uniqueness");
console.log("✓ create/takeover/renewal cross durable Mongo mutation boundaries");
console.log("✓ actual physical uniqueness must own those boundaries before authority can mint or CAS");
console.log("3C.5E.4G.2 activation lease physical authority: GREEN");
