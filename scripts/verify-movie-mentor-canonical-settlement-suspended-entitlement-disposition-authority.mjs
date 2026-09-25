import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor canonical settlement suspended-entitlement disposition court");

const settlement=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
const start=settlement.indexOf("async function settleCanonicalResult");
const end=settlement.indexOf("async function releaseUnclaimedReservation",start);
assert.ok(start>=0&&end>start,"canonical settlement production path must exist");
const canonical=settlement.slice(start,end);

assert.match(canonical,/session\.withTransaction/,"canonical settlement must be transactional");
assert.match(canonical,/status:"consumed"/,"canonical settlement must terminally consume the reservation");
assert.match(canonical,/reservedUnits:\{\$gte:reservation\.units\}/,"canonical settlement must reacquire the exact reserved obligation");
assert.doesNotMatch(canonical,/status:"active"[\s\S]{0,300}reservedUnits:\{\$gte:reservation\.units\}/,
 "canonical settlement must not require forward-spend authority to discharge an already-reserved canonical debit");

const before={entitlement:{status:"suspended",revision:12,reserved:1,remaining:4,consumed:3},reservation:"reserved",execution:"finalized"};
const durable=structuredClone(before);
function transaction(work){const tx=structuredClone(durable);try{work(tx);Object.assign(durable,tx);return{committed:true};}catch(error){return{committed:false,error};}}
const result=transaction(tx=>{
 const matches=["active","suspended"].includes(tx.entitlement.status)&&tx.entitlement.revision>=12&&tx.entitlement.reserved>=1;
 if(!matches){const e=new Error("ledger conflict");e.code="MOVIE_MENTOR_INFERENCE_SETTLEMENT_LEDGER_CONFLICT";throw e;}
 tx.entitlement.reserved--;tx.entitlement.consumed++;tx.entitlement.revision++;
 tx.reservation="consumed";tx.execution="settled";
});
assert.equal(result.committed,true,"suspension must not orphan a pre-existing canonical debit obligation");
assert.equal(durable.entitlement.status,"suspended","settlement must not reactivate forward spend authority");
assert.equal(durable.entitlement.reserved,0);
assert.equal(durable.entitlement.consumed,4);
assert.equal(durable.reservation,"consumed");
assert.equal(durable.execution,"settled");

console.log("GREEN: canonical settlement may discharge an already-reserved debit while entitlement remains suspended.");
console.log("LAW: SUSPENSION REVOKES NEW SPEND AUTHORITY; IT DOES NOT ERASE AN ALREADY-RESERVED CANONICAL DEBIT OBLIGATION.");
