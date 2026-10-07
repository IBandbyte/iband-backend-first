import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import {createMovieMentorInferenceSettlementMongoStore} from "../ai/MovieMentorInferenceSettlementMongoStore.js";

const EXECUTION_DOMAIN="iband.movie-mentor.inference-execution-store";
const RESULT_DOMAIN="iband.movie-mentor.canonical-result-store";
const CANDIDATE_DOMAIN="iband.movie-mentor.result-candidate-store";
const SPEND_DOMAIN="iband.movie-mentor.inference-spend";
const EFFECT_DOMAIN="iband.movie-mentor.provider-effect-reality";
const digest=value=>crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==="object"?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
const stableDigest=value=>crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
const iso=v=>new Date(v).toISOString();

const uri=process.env.MONGO_URI;
assert.ok(uri,"MONGO_URI required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
const db=mongoose.connection.db;
const names=["movie_mentor_inference_execution","movie_mentor_canonical_result","movie_mentor_result_candidate","movie_mentor_inference_spend_reservation","movie_mentor_inference_entitlement","movie_mentor_provider_effect_reality"];
for(const name of names)await db.collection(name).deleteMany({});

function callRecord(id){
 return {providerCallId:`call-${id}`,slotId:`slot-${id}`,task:"mentor-generation",leaseGeneration:1,leaseReference:`lease-${id}`,fencingToken:`fence-${id}`,admittedAt:iso("2032-01-01T00:01:00.000Z")};
}
function frozenUniverse(calls){return [...calls].map(c=>({providerCallId:c.providerCallId,slotId:c.slotId,task:c.task,leaseGeneration:c.leaseGeneration,leaseReference:c.leaseReference,fencingToken:c.fencingToken,admittedAt:iso(c.admittedAt)})).sort((a,b)=>a.slotId.localeCompare(b.slotId)||a.providerCallId.localeCompare(b.providerCallId));}
function effectEvidence(id){return [{externalEffectId:`effect-${id}`,provider:"provider-test",observedAt:iso("2032-01-01T00:02:00.000Z"),source:"provider-webhook"}];}
function certificateFor({id,calls,effectRows}){
 const byCall=new Map(effectRows.map(r=>[r.providerCallId,r]));
 const realities=calls.map(call=>{
   const row=byCall.get(call.providerCallId);
   if(!row)return {providerCallId:call.providerCallId,slotId:call.slotId,reality:"no-dispatch-authority-established",effectRevision:null,effectDigest:""};
   return {providerCallId:call.providerCallId,slotId:call.slotId,reality:"effect-confirmed",effectRevision:row.revision,effectDigest:digest(row.evidence)};
 });
 return {executionId:`execution-${id}`,creatorTurnId:`turn-${id}`,principalId:`creator-${id}`,projectId:`project-${id}`,reservationId:`reservation-${id}`,requestDigest:`request-${id}`,closureReference:`closure-${id}`,frozenProviderCallSetDigest:digest(frozenUniverse(calls)),closurePolicyVersion:"policy-416",realities};
}
async function seed({id,confirmedEffect}){
 const calls=confirmedEffect?[callRecord(id)]:[];
 const effectRows=confirmedEffect?[{domain:EFFECT_DOMAIN,schema:2,providerCallId:`call-${id}`,executionId:`execution-${id}`,slotId:`slot-${id}`,task:"mentor-generation",state:"confirmed",revision:1,evidence:effectEvidence(id)}]:[];
 const certificate=certificateFor({id,calls,effectRows});
 const certificateDigest=digest(certificate);
 const payload={success:true,text:`canonical-${id}`};
 const resultDigest=stableDigest(payload);
 const candidateReference=`candidate-${id}`,resultReference=`result-${id}`;
 const execution={domain:EXECUTION_DOMAIN,schema:6,executionId:`execution-${id}`,creatorTurnId:`turn-${id}`,principalId:`creator-${id}`,projectId:`project-${id}`,reservationId:`reservation-${id}`,requestDigest:`request-${id}`,phase:"finalized",ownerId:`owner-${id}`,leaseGeneration:1,leaseReference:`lease-${id}`,fencingToken:`fence-${id}`,providerCallsClaimed:calls.length,providerCalls:calls,providerEffectRealityRevision:confirmedEffect?1:0,settlementRealityBarrierRevision:0,resultFinalizationBarrierRevision:1,closureReference:`closure-${id}`,frozenProviderCallCount:calls.length,frozenProviderCallSetDigest:digest(frozenUniverse(calls)),closurePolicyVersion:"policy-416",closureCertificateDigest:certificateDigest,finalizedResultReference:resultReference,finalizedCandidateReference:candidateReference,finalizedResultDigest:resultDigest,resultFinalizedAt:new Date("2032-01-01T00:04:00.000Z")};
 const candidate={domain:CANDIDATE_DOMAIN,schema:2,candidateReference,executionId:execution.executionId,creatorTurnId:execution.creatorTurnId,principalId:execution.principalId,projectId:execution.projectId,reservationId:execution.reservationId,requestDigest:execution.requestDigest,resultDigest,resultPayload:payload,stagedFromLeaseReference:execution.leaseReference,stagedFromFencingToken:execution.fencingToken,stagedFromLeaseGeneration:1,creatorStateFingerprint:`state-${id}`,creatorStateOwnershipRef:`ownership-${id}`,creatorStateRevision:1,creatorStateGeneration:1,creatorStateOwnershipRevision:1,stagedAt:new Date("2032-01-01T00:03:00.000Z")};
 const result={domain:RESULT_DOMAIN,schema:2,resultReference,executionId:execution.executionId,creatorTurnId:execution.creatorTurnId,principalId:execution.principalId,projectId:execution.projectId,reservationId:execution.reservationId,requestDigest:execution.requestDigest,closureReference:execution.closureReference,closureCertificateDigest:certificateDigest,candidateReference,resultDigest,resultPayload:payload,committedAt:new Date("2032-01-01T00:04:00.000Z")};
 const reservation={domain:SPEND_DOMAIN,schema:1,reservationId:execution.reservationId,principalId:execution.principalId,projectId:execution.projectId,operation:"movie-mentor-turn",units:2,status:"reserved",entitlementRevision:9};
 const entitlement={domain:SPEND_DOMAIN,schema:1,principalId:execution.principalId,status:"suspended",remainingUnits:5,reservedUnits:2,consumedUnits:3,entitlementRevision:10};
 await db.collection("movie_mentor_inference_execution").insertOne(execution);
 await db.collection("movie_mentor_canonical_result").insertOne(result);
 await db.collection("movie_mentor_result_candidate").insertOne(candidate);
 await db.collection("movie_mentor_inference_spend_reservation").insertOne(reservation);
 await db.collection("movie_mentor_inference_entitlement").insertOne(entitlement);
 if(effectRows.length)await db.collection("movie_mentor_provider_effect_reality").insertMany(effectRows);
 return {execution,reservation,entitlement};
}

const real=await seed({id:"real-effect",confirmedEffect:true});
const none=await seed({id:"no-real-effect",confirmedEffect:false});
const store=createMovieMentorInferenceSettlementMongoStore({now:()=>new Date("2032-01-01T00:05:00.000Z")});

const realOutcome=await store.settleCanonicalResult({executionId:real.execution.executionId});
assert.equal(realOutcome.authorized,true,"already-real provider effect must remain reconcilable after suspension");
assert.equal(realOutcome.outcome,"consumed");
let realEntitlement=await db.collection("movie_mentor_inference_entitlement").findOne({principalId:real.execution.principalId});
assert.equal(realEntitlement.status,"suspended","settlement must not reactivate current entitlement");
assert.equal(realEntitlement.reservedUnits,0);
assert.equal(realEntitlement.consumedUnits,5);

const noEffectOutcome=await store.settleCanonicalResult({executionId:none.execution.executionId});
assert.equal(noEffectOutcome.authorized,false,"suspended historical reservation without established provider effect must not authorize fresh consumption");
assert.equal(noEffectOutcome.outcome,"reserved");
const noEffectEntitlement=await db.collection("movie_mentor_inference_entitlement").findOne({principalId:none.execution.principalId});
const noEffectReservation=await db.collection("movie_mentor_inference_spend_reservation").findOne({reservationId:none.execution.reservationId});
assert.equal(noEffectEntitlement.status,"suspended");
assert.equal(noEffectEntitlement.reservedUnits,2);
assert.equal(noEffectEntitlement.consumedUnits,3);
assert.equal(noEffectReservation.status,"reserved");

console.log("PR #416 post-dispatch suspension settlement authority: GREEN");
console.log("✓ confirmed already-real provider effect can reconcile exactly once after suspension without reactivating entitlement");
console.log("✓ suspended reservation with no established provider effect remains reserved and cannot manufacture consumption");
console.log("LAW: SUSPENSION REVOKES FORWARD AUTHORITY, NOT REALITY. POST-SUSPENSION SETTLEMENT MAY ACCOUNT FOR AN ALREADY-REAL EFFECT, BUT HISTORY WITHOUT REAL EFFECT MAY NOT MINT A CUSTOMER DEBIT.");
await mongoose.disconnect();
