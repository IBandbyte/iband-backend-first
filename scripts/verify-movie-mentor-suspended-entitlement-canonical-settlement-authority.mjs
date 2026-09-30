import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor suspended-entitlement canonical-settlement authority court");

const source=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
const freshStart=source.indexOf("const settledAt=settlementInstant(now());const barrier=");
assert.ok(freshStart>0,"court requires fresh canonical settlement branch");
const entitlementWrite=source.indexOf("const entitlement=await entitlements.findOneAndUpdate",freshStart);
const reservationWrite=source.indexOf("const settled=await reservations.findOneAndUpdate",entitlementWrite);
assert.ok(entitlementWrite>freshStart&&reservationWrite>entitlementWrite,"court requires SETTLED barrier -> entitlement consume -> reservation consume ordering");

const consumeBoundary=source.slice(entitlementWrite,reservationWrite);
assert.match(consumeBoundary,/reservedUnits:\{\$gte:reservation\.units\}/,"court requires exact reserved-unit economic backing");
assert.match(consumeBoundary,/\$inc:\{reservedUnits:-reservation\.units,consumedUnits:reservation\.units,entitlementRevision:1\}/,"court requires additive exact-reservation consume");
assert.match(
  consumeBoundary,
  /status:"active"/,
  "RED: a durable commercial suspension after reservation/provider work must not itself authorize a new creator consumedUnits transition; canonical consume must re-earn ACTIVE current entitlement authority"
);

const compensationStart=source.indexOf("async function compensateSupersededCreatorState");
assert.ok(compensationStart>0,"court requires Creator Compensation boundary");
const compensationEntitlement=source.indexOf("const entitlement=await entitlements.findOneAndUpdate",compensationStart);
const compensationReservation=source.indexOf("const released=await reservations.findOneAndUpdate",compensationEntitlement);
const compensationBoundary=source.slice(compensationEntitlement,compensationReservation);
assert.match(
  compensationBoundary,
  /status:\{\$in:\["active","suspended"\]\}/,
  "Creator Compensation must remain able to restore already-reserved Creator value while entitlement is suspended"
);
assert.match(compensationBoundary,/remainingUnits:reservation\.units/,"compensation must restore rather than consume Creator value");

console.log("GREEN: suspended current entitlement cannot mint fresh canonical consume authority while Creator Compensation remains restoration-capable.");
console.log("LAW: SUSPENSION MAY PRESERVE/RESTORE HISTORICAL RESERVED VALUE; IT MAY NOT ITSELF AUTHORIZE A NEW CONSUMED-UNITS TRANSITION.");
