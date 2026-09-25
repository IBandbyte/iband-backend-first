import assert from "node:assert/strict";
import { createMovieMentorInferenceSettlementMongoStore } from "../ai/MovieMentorInferenceSettlementMongoStore.js";
import { digestMovieMentorProviderReconstructionInput } from "../ai/MovieMentorProviderOperationAuthority.js";

console.log("5A.43 — Creator Compensation current-state serialization authority");

const execution={executionId:"execution-342",creatorTurnId:"turn-342",principalId:"creator-342",projectId:"project-342",reservationId:"reservation-342",providerCallsClaimed:1,providerCalls:[{providerCallId:"call-342",slotId:"semantic",task:"movie-mentor-semantic"}]};
const historical={revision:7,revisionAuthorityReference:null,snapshotFingerprint:null,snapshotReference:"snapshot:7",creatorStateGeneration:7,creatorStateFingerprint:"a".repeat(64),creatorStateAuthorityReference:null};
const current={revision:8,revisionAuthorityReference:null,snapshotReference:"snapshot:8",creatorStateGeneration:8,creatorStateFingerprint:"b".repeat(64),creatorStateAuthorityReference:null};
const conflict={code:"MOVIE_MENTOR_PROVIDER_RECOVERY_CREATOR_STATE_UNIVERSE_CONFLICT",creatorStateUniverseConflictAuthority:{domain:"iband.movie-mentor.provider-recovery-creator-state-universe-conflict",schema:1,providerCallId:"call-342",task:"movie-mentor-semantic",historicalCreatorStateUniverse:historical,currentCreatorStateUniverse:current}};
const effect={domain:"iband.movie-mentor.provider-effect-reality",schema:2,providerCallId:"call-342",executionId:"execution-342",slotId:"semantic",task:"movie-mentor-semantic",state:"confirmed",revision:1,evidence:[{externalEffectId:"effect-342",provider:"test",observedAt:"2035-01-01T00:00:01.000Z",source:"provider-ack"}]};
const reconstructionInput={context:{turnContextAuthority:{revision:7,revisionAuthorityReference:null,snapshotFingerprint:null,snapshotReference:"snapshot:7",creatorState:{generation:7,fingerprint:"a".repeat(64),authorityReference:null}}}};
const rows={
 movie_mentor_inference_execution:{domain:"iband.movie-mentor.inference-execution-store",schema:6,...execution,phase:"active",providerEffectRealityRevision:1,resultCandidateBarrierRevision:0,settlementRealityBarrierRevision:0},
 movie_mentor_provider_operation_reality:{providerCallId:"call-342",executionId:"execution-342",slotId:"semantic",task:"movie-mentor-semantic",reconstructionInput,reconstructionInputDigest:digestMovieMentorProviderReconstructionInput(reconstructionInput)},
 movie_mentor_provider_effect_reality:[structuredClone(effect)],
 movie_mentor_creator_state:{projectId:"project-342",revision:8,revisionAuthorityReference:"",snapshotReference:"snapshot:8",creatorStateGeneration:8,creatorStateFingerprint:"b".repeat(64),creatorAuthorityReference:""},
 movie_mentor_inference_spend_reservation:{domain:"iband.movie-mentor.inference-spend",schema:1,reservationId:"reservation-342",principalId:"creator-342",projectId:"project-342",operation:"movie-mentor-turn",units:1,entitlementRevision:3,status:"reserved"},
 movie_mentor_inference_entitlement:{domain:"iband.movie-mentor.inference-spend",schema:1,principalId:"creator-342",status:"active",remainingUnits:4,reservedUnits:1,consumedUnits:0,entitlementRevision:3},
};
const clone=v=>structuredClone(v);
const matches=(row,filter={})=>Object.entries(filter).every(([k,v])=>{const a=row?.[k];if(v&&typeof v==="object"&&!Array.isArray(v)){if("$gte" in v)return a>=v.$gte;return true;}return a===v;});
let stateRead=false,stateBarrierWrites=0;
const collection=name=>({
 async findOne(filter){const row=rows[name];if(name==="movie_mentor_creator_state")stateRead=true;return row&&!Array.isArray(row)&&matches(row,filter)?clone(row):null;},
 find(filter){const list=Array.isArray(rows[name])?rows[name]:[];return{toArray:async()=>clone(list.filter(r=>matches(r,filter)))};},
 async updateOne(filter,update){if(name==="movie_mentor_inference_execution"&&stateRead&&stateBarrierWrites===0){rows.movie_mentor_creator_state={...rows.movie_mentor_creator_state,revision:9,snapshotReference:"snapshot:9",creatorStateGeneration:9,creatorStateFingerprint:"c".repeat(64)};}
  if(name==="movie_mentor_creator_state")stateBarrierWrites++;
  const row=rows[name];if(!row||Array.isArray(row)||!matches(row,filter))return{matchedCount:0};Object.assign(row,clone(update.$set||{}));for(const[k,v]of Object.entries(update.$inc||{}))row[k]=(row[k]||0)+v;return{matchedCount:1};},
 async findOneAndUpdate(filter,update){const row=rows[name];if(!row||Array.isArray(row)||!matches(row,filter))return null;Object.assign(row,clone(update.$set||{}));for(const[k,v]of Object.entries(update.$inc||{}))row[k]=(row[k]||0)+v;return clone(row);}
});
const session={async withTransaction(fn){return fn();},async endSession(){}};
const store=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>session,db:()=>({collection}),now:()=>new Date("2035-01-01T00:00:02.000Z")});
const result=await store.compensateSupersededCreatorState({execution,recoveryConflict:conflict,providerEffects:[effect]});
assert.equal(stateBarrierWrites,1,"compensation must physically touch the exact current Creator-state row inside its transaction");
assert.equal(result.authorized,true,"unchanged exact Creator-state row must permit compensation after owning the transactional barrier");
assert.equal(rows.movie_mentor_inference_entitlement.remainingUnits,5,"serialized current Creator-state proof may restore exactly one unit");
assert.equal(rows.movie_mentor_inference_spend_reservation.status,"released","serialized compensation must release the reservation exactly once");
console.log("LAW: CREATOR COMPENSATION MUST SERIALIZE ITS CURRENT CREATOR-STATE PROOF AT THE SAME TRANSACTIONAL WRITE BOUNDARY AS TERMINAL COMPENSATION AND ENTITLEMENT RESTORATION.");
