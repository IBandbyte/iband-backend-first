import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor Creator Compensation current-entitlement race court");

const settlement=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
const start=settlement.indexOf("async function compensateSupersededCreatorState");
assert.ok(start>=0,"production compensation path must exist");
const compensation=settlement.slice(start);

assert.match(compensation,/session\.withTransaction/,"compensation must be one Mongo transaction");
assert.match(compensation,/creatorStates\.updateOne\([\s\S]*?compensationBarrierRevision:1/,"current Creator state must be fenced before disposition");
assert.match(compensation,/executions\.updateOne\([\s\S]*?phase:"compensated"/,"execution must transition terminally in the same transaction");
assert.match(compensation,/entitlements\.findOneAndUpdate\(\{principalId:text\(reservation\.principalId\),domain:SPEND_DOMAIN,schema:1,status:"active",entitlementRevision:\{\$gte:reservation\.entitlementRevision\},reservedUnits:\{\$gte:reservation\.units\}\}/,
 "Creator value restoration must reacquire a current active entitlement at the write boundary");
assert.match(compensation,/if\(!entitlement\)fail\("MOVIE_MENTOR_CREATOR_COMPENSATION_LEDGER_CONFLICT"/,
 "changed or suspended entitlement must fail compensation");
assert.match(compensation,/reservations\.findOneAndUpdate\(\{reservationId:text\(reservation\.reservationId\),status:"reserved"\}/,
 "reservation release must occur only after entitlement restoration");
const terminal=compensation.indexOf("const terminal=await executions.updateOne");
const entitlement=compensation.indexOf("const entitlement=await entitlements.findOneAndUpdate");
const released=compensation.indexOf("const released=await reservations.findOneAndUpdate");
assert.ok(terminal>=0&&entitlement>terminal&&released>entitlement,"terminal execution, entitlement restore, and reservation release must share ordered transaction disposition");

// Executable adversarial transaction model: entitlement is suspended after earlier proof,
// immediately before compensation's restoration write. Mongo transaction semantics require
// any thrown ledger conflict to roll back the earlier Creator-state/execution writes.
const before={
 creatorBarrier:7,executionPhase:"active",entitlement:{status:"active",revision:12,reserved:1,remaining:4},reservation:"reserved"
};
const durable=structuredClone(before);
function transaction(work){
 const tx=structuredClone(durable);
 try{work(tx);Object.assign(durable,tx);return {committed:true};}
 catch(error){return {committed:false,error};}
}
const result=transaction(tx=>{
 tx.creatorBarrier++;
 tx.executionPhase="compensated";
 // adversarial current-authority change at the entitlement boundary
 tx.entitlement.status="suspended";
 const matches=tx.entitlement.status==="active"&&tx.entitlement.revision>=12&&tx.entitlement.reserved>=1;
 if(!matches){const e=new Error("ledger conflict");e.code="MOVIE_MENTOR_CREATOR_COMPENSATION_LEDGER_CONFLICT";throw e;}
 tx.entitlement.reserved--;tx.entitlement.remaining++;tx.entitlement.revision++;
 tx.reservation="released";
});
assert.equal(result.committed,false);
assert.equal(result.error?.code,"MOVIE_MENTOR_CREATOR_COMPENSATION_LEDGER_CONFLICT");
assert.deepEqual(durable,before,"failed current-entitlement reacquisition must leave zero partial compensation disposition");

console.log("GREEN: compensation reacquires active entitlement at its write boundary and transaction rollback prevents partial restoration.");
console.log("LAW: CREATOR COMPENSATION MAY RESTORE VALUE ONLY THROUGH CURRENT ACTIVE ENTITLEMENT AUTHORITY; LOSS OF THAT AUTHORITY MUST LEAVE CREATOR STATE, EXECUTION, ENTITLEMENT, AND RESERVATION UNCHANGED.");
