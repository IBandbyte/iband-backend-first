import assert from "node:assert/strict";
import fs from "node:fs";
import {createMovieMentorInferenceSettlementPhysicalAuthority,MOVIE_MENTOR_INFERENCE_SETTLEMENT_REQUIRED_UNIQUE_INDEXES} from "../ai/MovieMentorInferenceSettlementPhysicalAuthority.js";

let delegated=0;
const delegate={
 async settleCanonicalResult(){delegated+=1;return{settled:true};},
 async releaseUnclaimedReservation(){delegated+=1;return{released:true};},
 async releaseUnboundReservation(){delegated+=1;return{released:true};}
};
const completeIndexes=new Map();
for(const requirement of MOVIE_MENTOR_INFERENCE_SETTLEMENT_REQUIRED_UNIQUE_INDEXES){const list=completeIndexes.get(requirement.collection)||[];list.push({key:{...requirement.key},unique:true});completeIndexes.set(requirement.collection,list);}
const reads=[];
const authority=createMovieMentorInferenceSettlementPhysicalAuthority({store:delegate,readIndexes:async collection=>{reads.push(collection);return completeIndexes.get(collection)||[];}});
const status=authority.getStatus();
assert.equal(status.uniquenessReadinessRequired,true);
assert.equal(status.physicalUniqueIndexReadiness,true);
assert.equal(status.readinessBoundary,"before-settlement-or-release-delegation");
await authority.settleCanonicalResult({executionId:"execution-1"});
assert.equal(delegated,1,"settlement may delegate only after physical readiness succeeds");
assert.ok(reads.length>=6,"court must inspect every durable settlement collection carrying identity authority");
const readsAfterFirst=reads.length;
await authority.releaseUnclaimedReservation({executionId:"execution-1"});
assert.equal(delegated,2);
assert.equal(reads.length,readsAfterFirst,"successful physical readiness may be cached for this composed production authority");

const brokenIndexes=new Map(completeIndexes);
const reservationIndexes=(brokenIndexes.get("movie_mentor_inference_spend_reservation")||[]).filter(index=>index.key?.reservationId!==1);
brokenIndexes.set("movie_mentor_inference_spend_reservation",reservationIndexes);
let blockedDelegation=0;
const blocked=createMovieMentorInferenceSettlementPhysicalAuthority({store:{settleCanonicalResult:async()=>{blockedDelegation+=1;},releaseUnclaimedReservation:async()=>{blockedDelegation+=1;},releaseUnboundReservation:async()=>{blockedDelegation+=1;}},readIndexes:async collection=>brokenIndexes.get(collection)||[]});
await assert.rejects(()=>blocked.settleCanonicalResult({executionId:"execution-2"}),error=>error?.code==="MOVIE_MENTOR_INFERENCE_SETTLEMENT_PHYSICAL_AUTHORITY_UNAVAILABLE"&&error?.retryable===true);
assert.equal(blockedDelegation,0,"missing physical identity authority must fail closed before irreversible settlement mutation");

const composition=fs.readFileSync(new URL("../ai/MovieMentorProductionInferenceSettlementComposition.js",import.meta.url),"utf8");
const storeSource=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
assert.match(storeSource,/session\.withTransaction/);
assert.match(composition,/createMovieMentorInferenceSettlementPhysicalAuthority\(\{store:durableStore,readIndexes:readPhysicalIndexes\}\)/,"production composition must own the physical readiness gate before settlement authority is exposed");
assert.match(composition,/database\.collection\(collectionName\)\.indexes\(\)/,"production physical proof must inspect actual Mongo index reality, not schema declarations");
assert.match(composition,/physicalUniqueIndexReadiness:!injected/);

console.log("PASS inference settlement physical authority — physical unique-index reality is proven before irreversible settlement/release delegation.");
console.log("LAW: SETTLEMENT MAY NOT CONSUME OR RELEASE ECONOMIC REALITY UNTIL THE PHYSICAL DURABLE AUTHORITIES IT RELIES ON ARE PROVEN READY.");
