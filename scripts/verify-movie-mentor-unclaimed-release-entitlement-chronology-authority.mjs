import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor unclaimed-release entitlement chronology authority court");
const source=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
const start=source.indexOf("async function releaseUnclaimedReservation");
const end=source.indexOf("async function releaseUnboundReservation",start);
assert.ok(start>=0&&end>start,"releaseUnclaimedReservation production path must exist");
const release=source.slice(start,end);

assert.match(release,/session\.withTransaction/,"release must be atomic");
assert.match(release,/providerCallsClaimed!==0/,"release must require zero provider claims");
assert.match(release,/phase:\"aborted\"/,"release must durably abort execution");
assert.match(release,/status:\"released\"/,"release must durably settle reservation as released");
assert.match(
  release,
  /entitlementRevision:\{\$gte:reservation\.entitlementRevision\}/,
  "RED: zero-claim refund must bind the current entitlement ledger to chronology at least as new as the reservation being released."
);
assert.match(release,/reservedUnits:\{\$gte:reservation\.units\}/,"release must prove reserved capacity");
assert.ok(
  release.indexOf("entitlementRevision:{$gte:reservation.entitlementRevision}") < release.indexOf('status:"released"'),
  "RED: entitlement chronology must be proven before reservation release is committed."
);

console.log("GREEN: zero-claim execution release restores Creator value only through entitlement chronology at least as current as the reservation authority.");
console.log("LAW: A ZERO-CLAIM ABORT MAY RESTORE RESERVED CREATOR VALUE ONLY INTO AN ENTITLEMENT LEDGER WHOSE CHRONOLOGY HAS NOT FALLEN BEHIND THE RESERVATION BEING RELEASED.");
