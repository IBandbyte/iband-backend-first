import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor unclaimed-release suspended-entitlement authority court");
const source=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
const start=source.indexOf("async function releaseUnclaimedReservation");
const end=source.indexOf("async function releaseUnboundReservation",start);
assert.ok(start>=0&&end>start);
const release=source.slice(start,end);

assert.match(release,/providerCallsClaimed!==0/);
assert.match(release,/entitlementRevision:\{\$gte:reservation\.entitlementRevision\}/);
assert.match(
  release,
  /principalId:text\(reservation\.principalId\),domain:SPEND_DOMAIN,schema:1,status:"active",entitlementRevision:\{\$gte:reservation\.entitlementRevision\}/,
  "RED: zero-claim refund must not restore spendable Creator value into a currently suspended entitlement."
);
assert.match(release,/remainingUnits:reservation\.units/);
console.log("GREEN: zero-claim refund restores Creator value only while current entitlement remains active.");
console.log("LAW: RELEASE MAY UNWIND AN UNUSED RESERVATION; IT MAY NOT TURN A CURRENTLY SUSPENDED ENTITLEMENT BACK INTO SPENDABLE CREATOR AUTHORITY.");
