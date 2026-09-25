import assert from "node:assert/strict";
import { createMovieMentorInferenceSettlementMongoStore } from "../ai/MovieMentorInferenceSettlementMongoStore.js";
import { digestMovieMentorProviderReconstructionInput } from "../ai/MovieMentorProviderOperationAuthority.js";

console.log("Movie Mentor compensated provider-reality drift authority court");

const execution={executionId:"execution-307",creatorTurnId:"turn-307",principalId:"creator-307",projectId:"project-307",reservationId:"reservation-307",providerCallsClaimed:1,providerCalls:[{providerCallId:"call-307",slotId:"semantic",task:"movie-mentor-semantic"}]};
const historical={revision:7,revisionAuthorityReference:null,snapshotFingerprint:null,snapshotReference:"snapshot:7",creatorStateGeneration:7,creatorStateFingerprint:"a".repeat(64),creatorStateAuthorityReference:null};
const current={revision:8,revisionAuthorityReference:null,snapshotReference:"snapshot:8",creatorStateGeneration:8,creatorStateFingerprint:"b".repeat(64),creatorStateAuthorityReference:null};
const recoveryConflict={code:"MOVIE_MENTOR_PROVIDER_RECOVERY_CREATOR_STATE_UNIVERSE_CONFLICT",creatorStateUniverseConflictAuthority:{domain:"iband.movie-mentor.provider-recovery-creator-state-universe-conflict",schema:1,providerCallId:"call-307",task:"movie-mentor-semantic",historicalCreatorStateUniverse:historical,currentCreatorStateUniverse:current}};
const effect={domain:"iband.movie-mentor.provider-effect-reality",schema:2,providerCallId:"call-307",executionId:"execution-307",slotId:"semantic",task:"movie-mentor-semantic",state:"confirmed",revision:1,evidence:[{externalEffectId:"effect-A",provider:"test",observedAt:"2035-01-01T00:00:01.000Z",source:"provider-ack"}]};
const reconstructionInput={context:{turnContextAuthority:{revision:7,revisionAuthorityReference:null,snapshotFingerprint:null,snapshotReference:"snapshot:7",creatorState:{generation:7,fingerprint:"a".repeat(64),authorityReference:null}}}};
const rows={
 movie_mentor_inference_execution:{domain:"iband.movie-mentor.inference-execution-store",schema:6,...execution,requestDigest:"request-307",phase:"active",providerEffectRealityRevision:1,resultCandidateBarrierRevision:0,settlementRealityBarrierRevision:0},
 movie_mentor_provider_operation_reality:{providerCallId:"call-307",executionId:"execution-307",slotId:"semantic",task:"movie-mentor-semantic",reconstructionInput,reconstructionInputDigest:digestMovieMentorProviderReconstructionInput(reconstructionInput)},
 movie_mentor_provider_effect_reality:[structuredClone(effect)],
 movie_mentor_creator_state:{projectId:"project-307",revision:8,revisionAuthorityReference:"",snapshotReference:"snapshot:8",creatorStateGeneration:8,creatorStateFingerprint:"b".repeat(64),creatorAuthorityReference:""},
 movie_mentor_inference_spend_reservation:{domain:"iband.movie-mentor.inference-spend",schema:1,reservationId:"reservation-307",principalId:"creator-307",projectId:"project-307",operation:"movie-mentor-turn",units:1,entitlementRevision:3,status:"reserved"},
 movie_mentor_inference_entitlement:{domain:"iband.movie-mentor.inference-spend",schema:1,principalId:"creator-307",status:"active",remainingUnits:4,reservedUnits:1,consumedUnits:0,entitlementRevision:3},
};
const clone=v=>structuredClone(v);
const matches=(row,filter={})=>Object.entries(filter).every(([k,v])=>{const a=row?.[k];if(v&&typeof v==="object"&&!Array.isArray(v)){if("$gte" in v)return a>=v.$gte;return true;}return a===v;});
const query=value=>({toArray:async()=>clone(value)});
const collection=name=>({
 async findOne(filter){const row=rows[name];return row&&!Array.isArray(row)&&matches(row,filter)?clone(row):null;},
 find(filter){const list=Array.isArray(rows[name])?rows[name]:[];return query(list.filter(r=>matches(r,filter)));},
 async updateOne(filter,update){const row=rows[name];if(!row||Array.isArray(row)||!matches(row,filter))return{matchedCount:0};Object.assign(row,clone(update.$set||{}));for(const[k,v]of Object.entries(update.$inc||{}))row[k]=(row[k]||0)+v;return{matchedCount:1};},
 async findOneAndUpdate(filter,update){const row=rows[name];if(!row||Array.isArray(row)||!matches(row,filter))return null;Object.assign(row,clone(update.$set||{}));for(const[k,v]of Object.entries(update.$inc||{}))row[k]=(row[k]||0)+v;return clone(row);}
});
const db={collection};
const session={async withTransaction(fn){return fn();},async endSession(){}};
const store=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>session,db:()=>db,now:()=>new Date("2035-01-01T00:00:02.000Z")});

const first=await store.compensateSupersededCreatorState({execution,recoveryConflict,providerEffects:[effect]});
assert.equal(first.authorized,true);
assert.equal(rows.movie_mentor_inference_execution.phase,"compensated");
assert.equal(rows.movie_mentor_inference_entitlement.remainingUnits,5);
assert.equal(rows.movie_mentor_inference_spend_reservation.status,"released");

// A second external effect is discovered only after compensation became terminal.
rows.movie_mentor_provider_effect_reality[0]={...rows.movie_mentor_provider_effect_reality[0],state:"conflict",revision:2,evidence:[...rows.movie_mentor_provider_effect_reality[0].evidence,{externalEffectId:"effect-B",provider:"test",observedAt:"2035-01-01T00:00:03.000Z",source:"provider-reconciliation"}]};
rows.movie_mentor_inference_execution.providerEffectRealityRevision+=1;

const second=await store.compensateSupersededCreatorState({execution,recoveryConflict,providerEffects:[effect]});
assert.equal(second.authorized,false,"RED: COMPENSATED idempotency must not ignore later provider-reality conflict.");
assert.equal(second.compensated,false);
assert.equal(second.outcome,"reserved");
assert.equal(second.reason,"provider-effect-not-confirmed");
assert.equal(rows.movie_mentor_inference_entitlement.remainingUnits,5,"late provider conflict must never restore Creator value twice");
assert.equal(rows.movie_mentor_inference_spend_reservation.status,"released","late provider conflict must preserve the already-owned compensation ledger disposition");

console.log("GREEN: later provider-reality drift cannot borrow historical COMPENSATED idempotency.");
console.log("LAW: COMPENSATION MAY BE IDEMPOTENT ONLY WHILE ITS PROVEN PROVIDER REALITY REMAINS AUTHORITATIVE; LATER CONTRADICTION MUST FAIL CLOSED WITHOUT REWRITING CREATOR VALUE.");
