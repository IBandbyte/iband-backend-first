import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor post-suspension Creator Compensation disposition court");

const settlement=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
const spend=fs.readFileSync(new URL("../ai/MovieMentorInferenceSpendMongoStore.js",import.meta.url),"utf8");
const start=settlement.indexOf("async function compensateSupersededCreatorState");
assert.ok(start>=0);
const compensation=settlement.slice(start);

assert.match(compensation,/status:\{\$in:\["active","suspended"\]\}/,"compensation must discharge reserved value against the same current entitlement even after forward authority is suspended");
assert.match(compensation,/MOVIE_MENTOR_CREATOR_COMPENSATION_LEDGER_CONFLICT/,"missing, contradictory, or insufficient entitlement reality must still fail closed");
assert.match(spend,/status:\{type:String,enum:\["active","suspended"\]/,"durable entitlement supports suspension");
assert.match(spend,/reservedUnits:\{type:Number,min:0,required:true\}/,"suspension can coexist with durable reserved value");

// The safety property is already owned by the preceding court. This court asks the
// independent disposition question: after suspension, is there a production path that
// can discharge an already-reserved compensation obligation without reactivating
// forward spend authority?
const settlementTail=compensation;
const suspendedCompensationDisposition = /status:\{\$in:\["active","suspended"\]\}[\s\S]{0,500}reservedUnits:\{\$gte:reservation\.units\}[\s\S]{0,500}remainingUnits:reservation\.units/.test(settlementTail);

assert.equal(
 suspendedCompensationDisposition,
 true,
 "RED: production has no owned post-suspension disposition for an already-reserved Creator Compensation obligation; fail-closed safety can strand reserved Creator value indefinitely."
);

console.log("GREEN: suspended entitlement has an owned terminal Creator Compensation disposition without restoring forward spend authority.");
console.log("LAW: SUSPENSION MAY REVOKE FORWARD SPEND AUTHORITY, BUT IT MUST NOT ORPHAN A PRE-EXISTING RESERVED CREATOR-COMPENSATION OBLIGATION.");
