import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor unclaimed-release suspended-entitlement authority court");
const source=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
const start=source.indexOf("async function releaseUnclaimedReservation");
const end=source.indexOf("async function releaseUnboundReservation",start);
assert.ok(start>=0&&end>start);
const release=source.slice(start,end);

assert.match(release,/providerCallsClaimed!==0/,"release remains zero-provider-claim only");
assert.match(release,/entitlementRevision:\{\$gte:reservation\.entitlementRevision\}/,"restitution remains fenced to reservation chronology");
assert.match(release,/reservedUnits:\{\$gte:reservation\.units\}/,"restitution remains fenced to already-reserved value");
assert.doesNotMatch(
  release,
  /entitlements\.findOneAndUpdate\(\{[^}]*status:"active"/,
  "Suspension revokes new/forward authority; it must not confiscate already-reserved Creator value during zero-claim restitution."
);
assert.match(release,/\$inc:\{reservedUnits:-reservation\.units,remainingUnits:reservation\.units,entitlementRevision:1\}/);

console.log("GREEN: zero-claim release is restitution of already-reserved Creator value and remains chronology/capacity fenced without borrowing new active spend authority.");
console.log("LAW: SUSPENSION REVOKES NEW/FORWARD SPEND AUTHORITY; IT DOES NOT CONFISCATE ALREADY-RESERVED CREATOR VALUE WHEN A ZERO-CLAIM EXECUTION IS ATOMICALLY UNWOUND.");

// Court retrigger: same verifier law; no production change.
