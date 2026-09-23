import assert from "node:assert/strict";
import fs from "node:fs";

const settlement=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
const start=settlement.indexOf("async function releaseUnboundReservation");
const end=settlement.indexOf("async function compensateSupersededCreatorState",start);
assert.ok(start>=0&&end>start,"releaseUnboundReservation production path must remain statically auditable");
const unbound=settlement.slice(start,end);

assert.match(unbound,/reservationIdentityValid\(reservation,\{reservationId:id,principalId:principal,projectId:project\}\)/,
  "unbound release must bind the exact durable reservation identity");
assert.match(unbound,/if\(execution\)\{outcome=Object\.freeze\(\{released:false,authorized:false,outcome:"reserved",reason:"reservation-already-bound-to-execution"/,
  "unbound release must refuse any reservation already bound to an execution");
assert.match(unbound,/findOneAndUpdate\(\{principalId:principal,domain:SPEND_DOMAIN,schema:1,entitlementRevision:\{\$gte:reservation\.entitlementRevision\},reservedUnits:\{\$gte:reservation\.units\}\}/,
  "RED: unbound release must bind ledger restitution to the reservation's durable entitlement chronology before restoring Creator units");

console.log("unbound release entitlement chronology authority: GREEN");
console.log("LAW: AN UNBOUND RESERVATION MAY RESTORE VALUE ONLY THROUGH ENTITLEMENT CHRONOLOGY THAT IS AT LEAST AS CURRENT AS THE RESERVATION THAT LOCKED THOSE UNITS.");
