import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createMovieMentorInferenceSettlementMongoStore } from "../ai/MovieMentorInferenceSettlementMongoStore.js";

console.log("Movie Mentor FINALIZED suspension terminal-authority court");

const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==="object"?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
const stableDigest=value=>crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
const digest=value=>crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const frozenDigest=digest([]);
const execution={
 domain:"iband.movie-mentor.inference-execution-store",schema:6,phase:"finalized",
 executionId:"execution-finalized-suspension",creatorTurnId:"turn-finalized-suspension",
 principalId:"creator-finalized-suspension",projectId:"project-finalized-suspension",
 reservationId:"reservation-finalized-suspension",requestDigest:"request-finalized-suspension",
 leaseGeneration:1,leaseReference:"lease-finalized-suspension",fencingToken:"fence-finalized-suspension",
 providerCallsClaimed:0,providerCalls:[],providerEffectRealityRevision:0,settlementRealityBarrierRevision:0,
 closureReference:"closure-finalized-suspension",closurePolicyVersion:"policy-finalized-suspension",
 frozenProviderCallCount:0,frozenProviderCallSetDigest:frozenDigest,
 finalizedResultReference:"result-finalized-suspension",finalizedCandidateReference:"candidate-finalized-suspension",
 resultFinalizedAt:new Date("2036-01-01T00:00:02.000Z")
};
const certificate={executionId:execution.executionId,creatorTurnId:execution.creatorTurnId,principalId:execution.principalId,projectId:execution.projectId,reservationId:execution.reservationId,requestDigest:execution.requestDigest,closureReference:execution.closureReference,frozenProviderCallSetDigest:frozenDigest,closurePolicyVersion:execution.closurePolicyVersion,realities:[]};
execution.closureCertificateDigest=digest(certificate);
const payload={success:true,mentorResponse:{text:"Already-finalized Creator result."}};
const resultDigest=stableDigest(payload);execution.finalizedResultDigest=resultDigest;
const result={domain:"iband.movie-mentor.canonical-result-store",schema:2,executionId:execution.executionId,creatorTurnId:execution.creatorTurnId,principalId:execution.principalId,projectId:execution.projectId,reservationId:execution.reservationId,requestDigest:execution.requestDigest,closureReference:execution.closureReference,closureCertificateDigest:execution.closureCertificateDigest,resultReference:execution.finalizedResultReference,candidateReference:execution.finalizedCandidateReference,resultDigest,resultPayload:payload};
const candidate={domain:"iband.movie-mentor.result-candidate-store",schema:2,candidateReference:execution.finalizedCandidateReference,executionId:execution.executionId,creatorTurnId:execution.creatorTurnId,principalId:execution.principalId,projectId:execution.projectId,reservationId:execution.reservationId,requestDigest:execution.requestDigest,resultDigest,resultPayload:payload,stagedFromLeaseGeneration:1,stagedFromLeaseReference:execution.leaseReference,stagedFromFencingToken:execution.fencingToken,creatorStateRevision:1,creatorStateGeneration:1,creatorStateFingerprint:"creator-state-finalized-suspension",creatorStateOwnershipRef:"creator-state-owner-finalized-suspension",creatorStateOwnershipRevision:1,stagedAt:new Date("2036-01-01T00:00:01.000Z")};
const reservation={domain:"iband.movie-mentor.inference-spend",schema:1,reservationId:execution.reservationId,principalId:execution.principalId,projectId:execution.projectId,operation:"movie-mentor-turn",units:1,entitlementRevision:7,status:"reserved"};
const entitlement={domain:"iband.movie-mentor.inference-spend",schema:1,principalId:execution.principalId,status:"suspended",remainingUnits:4,reservedUnits:1,consumedUnits:0,entitlementRevision:8};

const rows={movie_mentor_inference_execution:execution,movie_mentor_canonical_result:result,movie_mentor_result_candidate:candidate,movie_mentor_inference_spend_reservation:reservation,movie_mentor_inference_entitlement:entitlement,movie_mentor_provider_effect_reality:[]};
function matches(row,filter={}){return Object.entries(filter).every(([k,v])=>{const a=row?.[k];if(v&&typeof v==="object"&&!Array.isArray(v)){if("$gte" in v)return a>=v.$gte;if("$exists" in v)return (a!==undefined)===v.$exists;return true;}return a===v;});}
function collection(name){return{
 async findOne(filter){const row=rows[name];return row&&!Array.isArray(row)&&matches(row,filter)?structuredClone(row):null;},
 find(filter){const list=Array.isArray(rows[name])?rows[name]:[];return{toArray:async()=>structuredClone(list.filter(r=>matches(r,filter)))};},
 async updateOne(filter,update){const row=rows[name];if(!row||Array.isArray(row)||!matches(row,filter))return{matchedCount:0,modifiedCount:0};Object.assign(row,structuredClone(update.$set||{}));for(const[k,v]of Object.entries(update.$inc||{}))row[k]=(row[k]||0)+v;return{matchedCount:1,modifiedCount:1};},
 async findOneAndUpdate(filter,update){const row=rows[name];if(!row||Array.isArray(row)||!matches(row,filter))return null;Object.assign(row,structuredClone(update.$set||{}));for(const[k,v]of Object.entries(update.$inc||{}))row[k]=(row[k]||0)+v;return structuredClone(row);}
};}
const db={collection};
const session={async withTransaction(fn){const snapshot=structuredClone(rows);try{return await fn();}catch(error){for(const k of Object.keys(rows))rows[k]=structuredClone(snapshot[k]);throw error;}},async endSession(){}};
const store=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>session,db:()=>db,now:()=>new Date("2036-01-01T00:00:03.000Z")});

let settlementError=null;
try{await store.settleCanonicalResult({executionId:execution.executionId});}catch(error){settlementError=error;}
assert.equal(settlementError,null,"a legitimately FINALIZED canonical result must retain terminal debit authority after later suspension");
assert.equal(rows.movie_mentor_inference_execution.phase,"settled");
assert.equal(rows.movie_mentor_inference_spend_reservation.status,"consumed");

const recoveryConflict={code:"MOVIE_MENTOR_PROVIDER_RECOVERY_CREATOR_STATE_UNIVERSE_CONFLICT",creatorStateUniverseConflictAuthority:{domain:"iband.movie-mentor.provider-recovery-creator-state-universe-conflict",schema:1,providerCallId:"historical-call",task:"movie-mentor-semantic",historicalCreatorStateUniverse:{revision:1},currentCreatorStateUniverse:{revision:2}}};
const compensation=await store.compensateSupersededCreatorState({execution:structuredClone(rows.movie_mentor_inference_execution),recoveryConflict,providerEffects:[]});
assert.equal(compensation.authorized,false);
assert.equal(compensation.reason,"canonical-result-authority-exists","existing Creator Compensation deliberately refuses an already-FINALIZED canonical result");

assert.equal(rows.movie_mentor_inference_entitlement.status,"suspended");
assert.equal(rows.movie_mentor_inference_entitlement.reservedUnits,1);
console.log("GREEN: FINALIZED canonical authority owns the terminal debit even if current entitlement was subsequently suspended; no new provider/spend authority is granted.");
console.log("LAW: SUSPENSION REVOKES FORWARD COMMERCIAL AUTHORITY, BUT IT DOES NOT ERASE A DEBIT ALREADY OWNED BY A LEGITIMATELY FINALIZED CANONICAL RESULT.");
