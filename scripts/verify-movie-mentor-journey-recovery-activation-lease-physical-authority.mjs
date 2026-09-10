import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../ai/MovieMentorJourneyRecoveryActivationLeaseMongoStore.js", import.meta.url), "utf8");
console.log("3C.5E.4G.2 — activation lease physical authority verifier");
assert.match(source, /schema\.index\(\{ serviceKey: 1 \}, \{ unique: true \}\)/, "declared singleton serviceKey uniqueness must remain explicit");
assert.match(source, /async function createLease[\s\S]*?await physicalReadyBoundary\(\)[\s\S]*?storeModel\(\)\.create\(next\)/, "production createLease must cross physical readiness before durable mint");
assert.match(source, /async function replaceLease[\s\S]*?await physicalReadyBoundary\(\)[\s\S]*?findOneAndUpdate/, "production replaceLease must cross physical readiness before durable CAS mutation");
assert.match(source, /collection\.indexes\(\)/, "physical authority must inspect actual Mongo index reality");
assert.match(source, /index\?\.unique === true[\s\S]*key\.serviceKey === 1/, "physical authority must require exact unique serviceKey identity");
assert.match(source, /MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_PHYSICAL_AUTHORITY_UNAVAILABLE/, "missing physical authority must fail closed");
console.log("✓ declared singleton identity remains explicit");
console.log("✓ create/takeover/renewal cross physical readiness before Mongo mutation");
console.log("✓ actual Mongo index reality must contain exact unique serviceKey identity");
console.log("3C.5E.4G.2 activation lease physical authority: GREEN");
