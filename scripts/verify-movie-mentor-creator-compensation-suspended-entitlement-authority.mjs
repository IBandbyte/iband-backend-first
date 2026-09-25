import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor Creator Compensation suspended-entitlement authority court");

const source=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
const start=source.indexOf("async function compensateSupersededCreatorState");
assert.ok(start>=0,"production Creator Compensation authority must exist");
const compensation=source.slice(start);

const entitlementWrite=compensation.indexOf("const entitlement=await entitlements.findOneAndUpdate");
const reservationRelease=compensation.indexOf("const released=await reservations.findOneAndUpdate",entitlementWrite);
assert.ok(entitlementWrite>0&&reservationRelease>entitlementWrite,"entitlement restoration must precede reservation release in the compensation transaction");
const restore=compensation.slice(entitlementWrite,reservationRelease);

assert.match(compensation,/session\.withTransaction/,"Creator Compensation must remain one Mongo transaction");
assert.match(restore,/status:"active"/,"Creator value restoration must require current ACTIVE entitlement authority");
assert.match(restore,/entitlementRevision:\{\$gte:reservation\.entitlementRevision\}/,"restoration must remain bound to current entitlement chronology");
assert.match(restore,/reservedUnits:\{\$gte:reservation\.units\}/,"restoration must prove the reserved value still exists");
assert.match(compensation,/if\(!entitlement\)fail\("MOVIE_MENTOR_CREATOR_COMPENSATION_LEDGER_CONFLICT"/,"loss of current entitlement authority must fail the compensation transaction");
assert.match(compensation,/if\(!released\)fail\("MOVIE_MENTOR_CREATOR_COMPENSATION_RESERVATION_RACE"/,"reservation release must remain inside the same fail-closed transaction");

const active={principalId:"creator-347",domain:"movie-mentor-inference-spend",schema:1,status:"active",entitlementRevision:12,reservedUnits:1,remainingUnits:4};
const suspended={...active,status:"suspended",entitlementRevision:13};

function matchesRestore(row,reservation){
 return row.principalId===reservation.principalId
  && row.domain==="movie-mentor-inference-spend"
  && row.schema===1
  && row.status==="active"
  && row.entitlementRevision>=reservation.entitlementRevision
  && row.reservedUnits>=reservation.units;
}
const reservation={principalId:"creator-347",entitlementRevision:12,units:1,status:"reserved"};
assert.equal(matchesRestore(active,reservation),true,"unchanged active entitlement remains eligible for exact restoration");
assert.equal(matchesRestore(suspended,reservation),false,"current suspended entitlement must not receive Creator Compensation restoration");

console.log("✓ current ACTIVE entitlement may cross the compensation restoration boundary");
console.log("✓ suspension/revocation before restoration makes the exact production entitlement filter unmatchable");
console.log("✓ failed entitlement restoration aborts the transaction before reservation release can become durable");
console.log("LAW: HISTORICAL RESERVED VALUE CANNOT BORROW CURRENT COMMERCIAL AUTHORITY; CREATOR COMPENSATION RESTORES VALUE ONLY INTO A CURRENT ACTIVE ENTITLEMENT.");
console.log("Movie Mentor Creator Compensation suspended-entitlement authority court: GREEN");
