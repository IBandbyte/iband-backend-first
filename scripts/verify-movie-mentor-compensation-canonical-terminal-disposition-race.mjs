import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor Creator Compensation ↔ canonical terminal disposition race court");

const source=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
const settleStart=source.indexOf("async function settleCanonicalResult");
const releaseStart=source.indexOf("async function releaseUnclaimedReservation",settleStart);
const compensationStart=source.indexOf("async function compensateSupersededCreatorState",releaseStart);
assert.ok(settleStart>=0&&releaseStart>settleStart&&compensationStart>releaseStart);
const settle=source.slice(settleStart,releaseStart);
const compensation=source.slice(compensationStart);

assert.match(settle,/\["finalized","settled"\]\.includes\(text\(execution\.phase\)\)/,"canonical settlement only owns finalized/settled execution");
assert.match(compensation,/\["finalized","settled"\]\.includes\(text\(execution\.phase\)\)/,"compensation refuses canonical execution authority");
assert.match(compensation,/if\(canonical\|\|candidate\)/,"compensation refuses durable result lineage");
assert.match(settle,/findOneAndUpdate\(\{reservationId:text\(reservation\.reservationId\),status:"reserved"\}/,"canonical disposition CASes reserved→consumed");
assert.match(compensation,/findOneAndUpdate\(\{reservationId:text\(reservation\.reservationId\),status:"reserved"\}/,"compensation disposition CASes reserved→released");
assert.match(settle,/phase:"finalized"[\s\S]*?\$set:\{phase:"settled"/,"canonical terminal execution mutation requires finalized authority");
assert.match(compensation,/executionId:id,phase:text\(execution\.phase\)[\s\S]*?\$set:\{phase:"compensated"/,"compensation terminal mutation CASes the observed execution phase");

function canonical(tx){
 if(tx.execution!=="finalized") return "denied";
 if(tx.reservation!=="reserved") throw new Error("reservation-state-invalid");
 tx.execution="settled";tx.reservation="consumed";tx.reserved--;tx.consumed++;return "consumed";
}
function compensation(tx){
 if(["finalized","settled"].includes(tx.execution)||tx.canonical||tx.candidate) return "denied";
 if(tx.reservation==="consumed") throw new Error("consumed-conflict");
 if(tx.reservation!=="reserved") return "denied";
 tx.execution="compensated";tx.reservation="released";tx.reserved--;tx.remaining++;return "released";
}

const canonicalOwned={execution:"finalized",reservation:"reserved",canonical:true,candidate:true,reserved:1,remaining:4,consumed:3};
assert.equal(compensation(canonicalOwned),"denied");
assert.equal(canonical(canonicalOwned),"consumed");
assert.deepEqual({execution:canonicalOwned.execution,reservation:canonicalOwned.reservation,reserved:canonicalOwned.reserved,remaining:canonicalOwned.remaining,consumed:canonicalOwned.consumed},{execution:"settled",reservation:"consumed",reserved:0,remaining:4,consumed:4});

const compensationOwned={execution:"active",reservation:"reserved",canonical:false,candidate:false,reserved:1,remaining:4,consumed:3};
assert.equal(compensation(compensationOwned),"released");
assert.equal(canonical(compensationOwned),"denied");
assert.deepEqual({execution:compensationOwned.execution,reservation:compensationOwned.reservation,reserved:compensationOwned.reserved,remaining:compensationOwned.remaining,consumed:compensationOwned.consumed},{execution:"compensated",reservation:"released",reserved:0,remaining:5,consumed:3});

console.log("GREEN: canonical consumption and Creator Compensation cannot both terminally dispose the same reservation.");
console.log("LAW: ONE RESERVATION HAS ONE TERMINAL ECONOMIC FATE — CANONICAL CONSUMPTION OR CREATOR COMPENSATION, NEVER BOTH.");
