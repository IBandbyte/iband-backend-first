import assert from "node:assert/strict";
import { createMovieMentorInferenceSettlementReconciliationAuthority } from "../ai/MovieMentorInferenceSettlementReconciliationAuthority.js";
import { createMovieMentorInferenceSettlementMongoStore } from "../ai/MovieMentorInferenceSettlementMongoStore.js";
import fs from "node:fs";
import crypto from "node:crypto";
const inputDigest=value=>crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

console.log("Movie Mentor Creator Compensation authority court");

const execution = Object.freeze({
  executionId:"execution-comp-1", creatorTurnId:"turn-comp-1", principalId:"creator-comp-1",
  projectId:"project-comp-1", reservationId:"reservation-comp-1", phase:"active",
  providerCallsClaimed:1, providerCalls:[Object.freeze({providerCallId:"call-comp-1",slotId:"semantic",task:"movie-mentor-semantic"})],
});
const confirmedEffect = Object.freeze({
  providerCallId:"call-comp-1", executionId:"execution-comp-1", slotId:"semantic", task:"movie-mentor-semantic",
  state:"confirmed", revision:2,
  evidence:[Object.freeze({externalEffectId:"provider-effect-comp-1",provider:"test-provider",observedAt:"2035-01-01T00:00:01.000Z",source:"provider-ack"})],
});
const reservation = {reservationId:"reservation-comp-1",principalId:"creator-comp-1",projectId:"project-comp-1",status:"reserved",units:1};
const entitlement = {remainingUnits:4,reservedUnits:1,consumedUnits:0};
const recoveryConflict = Object.freeze({
  code:"MOVIE_MENTOR_PROVIDER_RECOVERY_CREATOR_STATE_UNIVERSE_CONFLICT",
  historicalCreatorState:Object.freeze({revision:7,generation:7,fingerprint:"a".repeat(64),snapshotReference:"snapshot:7"}),
  currentCreatorState:Object.freeze({revision:8,generation:8,fingerprint:"b".repeat(64),snapshotReference:"snapshot:8"}),
  creatorStateUniverseConflictAuthority:Object.freeze({
    domain:"iband.movie-mentor.provider-recovery-creator-state-universe-conflict",schema:1,
    providerCallId:"call-comp-1",task:"movie-mentor-semantic",
    historicalCreatorStateUniverse:Object.freeze({revision:7,snapshotReference:"snapshot:7",creatorStateGeneration:7,creatorStateFingerprint:"a".repeat(64)}),
    currentCreatorStateUniverse:Object.freeze({revision:8,snapshotReference:"snapshot:8",creatorStateGeneration:8,creatorStateFingerprint:"b".repeat(64)}),
  }),
});

let compensationWrites=0;
const store={
  settleCanonicalResult:async()=>({authorized:false,settled:false,outcome:"reserved",reason:"execution-not-finalized",executionId:execution.executionId,reservationId:reservation.reservationId}),
  releaseUnclaimedReservation:async()=>({authorized:false,released:false,outcome:"reserved",reason:"provider-call-claims-exist",executionId:execution.executionId,reservationId:reservation.reservationId,providerCallsClaimed:1}),
  releaseUnboundReservation:async()=>({authorized:false,released:false,outcome:"reserved",reason:"reservation-already-bound-to-execution",executionId:execution.executionId,reservationId:reservation.reservationId}),
  compensateSupersededCreatorState:async({execution:current,recoveryConflict:conflict,providerEffects})=>{
    assert.equal(current.executionId,execution.executionId);
    assert.equal(conflict.code,recoveryConflict.code);
    assert.equal(providerEffects[0].state,"confirmed");
    if(reservation.status==="released"){
      return {authorized:true,compensated:true,outcome:"creator-compensated",executionId:execution.executionId,reservationId:reservation.reservationId,principalId:reservation.principalId,projectId:reservation.projectId,providerCostAbsorbedBy:"iband",creatorUnitsRestored:reservation.units,idempotent:true};
    }
    assert.equal(reservation.status,"reserved");
    compensationWrites++;
    entitlement.reservedUnits-=reservation.units;
    entitlement.remainingUnits+=reservation.units;
    reservation.status="released";
    return {authorized:true,compensated:true,outcome:"creator-compensated",executionId:execution.executionId,reservationId:reservation.reservationId,principalId:reservation.principalId,projectId:reservation.projectId,providerCostAbsorbedBy:"iband",creatorUnitsRestored:reservation.units,idempotent:false};
  },
};

const authority=createMovieMentorInferenceSettlementReconciliationAuthority({store});
const held=await authority.releaseUnclaimed({executionId:execution.executionId});
assert.equal(held.authorized,false);
assert.equal(held.reason,"provider-call-claims-exist");
assert.equal(reservation.status,"reserved");
assert.deepEqual(entitlement,{remainingUnits:4,reservedUnits:1,consumedUnits:0});

assert.equal(typeof authority.compensateSupersededCreatorState,"function",
  "Creator Compensation authority must exist for CONFIRMED provider work made unusable solely by a superseded Creator-state universe");

const first=await authority.compensateSupersededCreatorState({execution,recoveryConflict,providerEffects:[confirmedEffect]});
assert.equal(first.authorized,true);
assert.equal(first.compensated,true);
assert.equal(first.outcome,"creator-compensated");
assert.equal(first.providerCostAbsorbedBy,"iband");
assert.equal(first.creatorUnitsRestored,1);
assert.equal(reservation.status,"released");
assert.equal(entitlement.remainingUnits,5);
assert.equal(entitlement.reservedUnits,0);
assert.equal(entitlement.consumedUnits,0);
assert.equal(compensationWrites,1);

const second=await authority.compensateSupersededCreatorState({execution,recoveryConflict,providerEffects:[confirmedEffect]});
assert.equal(second.authorized,true);
assert.equal(second.compensated,true);
assert.equal(second.idempotent,true);
assert.equal(entitlement.remainingUnits,5,"retry must not restore the Creator unit twice");
assert.equal(compensationWrites,1,"retry must not create a second compensation disposition");

console.log("GREEN: confirmed provider cost remains historical while the undelivered superseded Creator-state turn restores exactly one Creator unit exactly once.");
console.log("LAW: PROVIDER COST MAY SURVIVE; AN UNDELIVERED SUPERSEDED CREATOR-STATE TURN MUST NOT STRAND OR DOUBLE-CHARGE CREATOR VALUE. COMPENSATION IS DURABLE AND EXACTLY ONCE.");

const noCapability=createMovieMentorInferenceSettlementReconciliationAuthority({store:{
  settleCanonicalResult:store.settleCanonicalResult,
  releaseUnclaimedReservation:store.releaseUnclaimedReservation,
  releaseUnboundReservation:store.releaseUnboundReservation,
}});
const refused=await noCapability.compensateSupersededCreatorState({execution,recoveryConflict,providerEffects:[confirmedEffect]});
assert.equal(refused.authorized,false);
assert.equal(refused.reason,"creator-compensation-store-capability-unavailable");

await assert.rejects(()=>authority.compensateSupersededCreatorState({
  execution,
  recoveryConflict:{code:"SOME_OTHER_FAILURE"},
  providerEffects:[confirmedEffect],
}),e=>e.code==="MOVIE_MENTOR_CREATOR_COMPENSATION_BINDING_REQUIRED");

await assert.rejects(()=>authority.compensateSupersededCreatorState({
  execution,
  recoveryConflict,
  providerEffects:[{...confirmedEffect,state:"unknown",evidence:[]}],
}),e=>e.code==="MOVIE_MENTOR_CREATOR_COMPENSATION_PROVIDER_EFFECT_REQUIRED");

console.log("GREEN: Creator Compensation refuses missing capability, wrong cause, and non-confirmed provider reality.");

const runtimeSource=fs.readFileSync(new URL("../ai/MovieMentorTurnRuntime.js",import.meta.url),"utf8");
const settlementStoreSource=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
const executionStoreSource=fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionMongoStore.js",import.meta.url),"utf8");
assert.match(runtimeSource,/compensateSupersededCreatorState/,"RED: Creator Compensation is durable but not reachable from the live failed-orchestration path that owns superseded Creator-state recovery conflict.");
assert.match(runtimeSource,/MOVIE_MENTOR_PROVIDER_RECOVERY_CREATOR_STATE_UNIVERSE_CONFLICT/,"live runtime must select compensation only for the exact superseded Creator-state recovery conflict.");
assert.match(runtimeSource,/recoverProviderOutcome\(\{ providerCallId:[^\n]+recoveryAuthority: execution \}\)/,"RED: compensation handoff must freshly reread durable provider-effect reality after the semantic-universe conflict.");
assert.match(runtimeSource,/recovery\?\.outcome !== "CONFIRMED_EFFECT"/,"RED: compensation handoff must require CONFIRMED provider effect, never inferred work.");
assert.match(runtimeSource,/error\.providerEffects = \[Object\.freeze/,"RED: live conflict must carry proof-bearing provider-effect evidence into compensation.");

assert.doesNotMatch(settlementStoreSource,/phase:"aborted",abortedAt:at,abortReason:"creator-compensated-superseded-creator-state"/,"RED: current Creator Compensation physically reuses ABORTED for an execution with confirmed provider work; compensation needs its own durable terminal disposition.");
assert.match(executionStoreSource,/phase==="aborted"&&\(calls\.length!==0\|\|v\.providerCallsClaimed!==0/,"ABORTED must remain canonically defined as zero-provider-claim; claimed-work compensation cannot weaken abort semantics.");
console.log("GREEN: live runtime owns the exact compensation handoff instead of leaving the new durable capability orphaned.");

function queryResult(value){return {toArray:async()=>structuredClone(value),then(resolve,reject){return Promise.resolve(structuredClone(value)).then(resolve,reject);}};}
function matches(row,filter={}){return Object.entries(filter).every(([k,v])=>{const actual=row?.[k];if(v&&typeof v==="object"&&!Array.isArray(v)){if("$gte" in v)return actual>=v.$gte;return true;}return actual===v;});}
function collectionFor(rows,name){
  return {
    async findOne(filter){const row=rows[name];return row&&matches(row,filter)?structuredClone(row):null;},
    find(filter){const list=Array.isArray(rows[name])?rows[name]:[];return queryResult(list.filter(row=>matches(row,filter)));},
    async updateOne(filter,update){const row=rows[name];if(!row||!matches(row,filter))return {matchedCount:0,modifiedCount:0};Object.assign(row,structuredClone(update.$set||{}));for(const [k,v] of Object.entries(update.$inc||{}))row[k]=(row[k]||0)+v;return {matchedCount:1,modifiedCount:1};},
    async findOneAndUpdate(filter,update){const row=rows[name];if(!row||!matches(row,filter))return null;Object.assign(row,structuredClone(update.$set||{}));for(const [k,v] of Object.entries(update.$inc||{}))row[k]=(row[k]||0)+v;return structuredClone(row);}
  };
}
const physicalRows={
  movie_mentor_inference_execution:{domain:"iband.movie-mentor.inference-execution-store",schema:6,executionId:execution.executionId,creatorTurnId:execution.creatorTurnId,principalId:execution.principalId,projectId:execution.projectId,reservationId:execution.reservationId,requestDigest:"request-comp-1",phase:"active",providerCallsClaimed:1,providerCalls:[{providerCallId:"call-comp-1",slotId:"semantic",task:"movie-mentor-semantic"}],settlementRealityBarrierRevision:0},
  movie_mentor_provider_operation_reality:{providerCallId:"call-comp-1",executionId:execution.executionId,slotId:"semantic",task:"movie-mentor-semantic",reconstructionInput:{context:{turnContextAuthority:{revision:7,snapshotReference:"snapshot:7",creatorState:{generation:7,fingerprint:"a".repeat(64)}}}}},
  movie_mentor_provider_effect_reality:[{domain:"iband.movie-mentor.provider-effect-reality",schema:1,providerCallId:"call-comp-1",executionId:execution.executionId,slotId:"semantic",task:"movie-mentor-semantic",state:"confirmed",revision:2,evidence:[{externalEffectId:"provider-effect-comp-1",provider:"test-provider",observedAt:"2035-01-01T00:00:01.000Z",source:"provider-ack"}]}],
  movie_mentor_inference_spend_reservation:{domain:"iband.movie-mentor.inference-spend",schema:1,reservationId:execution.reservationId,principalId:execution.principalId,projectId:execution.projectId,operation:"movie-mentor-turn",units:1,status:"reserved"},
  movie_mentor_inference_entitlement:{domain:"iband.movie-mentor.inference-spend",schema:1,principalId:execution.principalId,remainingUnits:4,reservedUnits:1,consumedUnits:0,entitlementRevision:3},
};
physicalRows.movie_mentor_provider_operation_reality.reconstructionInputDigest=inputDigest(physicalRows.movie_mentor_provider_operation_reality.reconstructionInput);
const physicalDb={collection(name){return collectionFor(physicalRows,name);}};
const physicalSession={async withTransaction(fn){return fn();},async endSession(){}};
const physicalStore=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>physicalSession,db:()=>physicalDb,now:()=>new Date("2035-01-01T00:00:02.000Z")});
const physicalFirst=await physicalStore.compensateSupersededCreatorState({execution,recoveryConflict,providerEffects:[confirmedEffect]});
assert.equal(physicalFirst.authorized,true,"RED: production Mongo compensation store must physically authorize the exact proven superseded-state disposition.");
assert.equal(physicalRows.movie_mentor_inference_execution.phase,"compensated","production transaction must durably terminate as COMPENSATED, never ABORTED.");
assert.equal(physicalRows.movie_mentor_inference_spend_reservation.status,"released");
assert.equal(physicalRows.movie_mentor_inference_entitlement.remainingUnits,5);
assert.equal(physicalRows.movie_mentor_inference_entitlement.reservedUnits,0);
const physicalSecond=await physicalStore.compensateSupersededCreatorState({execution,recoveryConflict,providerEffects:[confirmedEffect]});
assert.equal(physicalSecond.idempotent,true,"retry must recognize the same durable Creator Compensation disposition.");
assert.equal(physicalRows.movie_mentor_inference_entitlement.remainingUnits,5,"production retry must never restore Creator value twice.");
assert.equal(physicalRows.movie_mentor_inference_entitlement.reservedUnits,0);
assert.equal(physicalRows.movie_mentor_provider_effect_reality[0].state,"confirmed","provider work history must survive Creator Compensation.");
const postCompensationSettlement=await physicalStore.settleCanonicalResult({executionId:execution.executionId});
assert.equal(postCompensationSettlement.authorized,false,"compensated execution must never later authorize canonical consumption.");
assert.equal(postCompensationSettlement.outcome,"reserved");
console.log("GREEN: production Mongo compensation transaction restores Creator value exactly once, preserves provider history, and cannot later consume the compensated turn.");

const multiExecution={...execution,executionId:"exec-comp-multi",creatorTurnId:"turn-comp-multi",reservationId:"res-comp-multi"};
const multiRows={
  movie_mentor_inference_execution:{domain:"iband.movie-mentor.inference-execution-store",schema:6,executionId:multiExecution.executionId,creatorTurnId:multiExecution.creatorTurnId,principalId:multiExecution.principalId,projectId:multiExecution.projectId,reservationId:multiExecution.reservationId,requestDigest:"request-comp-multi",phase:"active",providerCallsClaimed:2,providerCalls:[{providerCallId:"call-comp-a",slotId:"semantic",task:"semantic"},{providerCallId:"call-comp-b",slotId:"continuity",task:"continuity"}],settlementRealityBarrierRevision:0},
  movie_mentor_provider_operation_reality:{providerCallId:"call-comp-b",executionId:multiExecution.executionId,slotId:"continuity",task:"continuity",reconstructionInput:{input:{turnContextAuthority:{revision:7,snapshotReference:"snapshot:7",creatorState:{generation:7,fingerprint:"a".repeat(64)}}}}},
  movie_mentor_provider_effect_reality:[
    {domain:"iband.movie-mentor.provider-effect-reality",schema:1,providerCallId:"call-comp-a",executionId:multiExecution.executionId,slotId:"semantic",task:"semantic",state:"confirmed",revision:2,evidence:[{externalEffectId:"effect-comp-a",provider:"test-provider",observedAt:"2035-01-01T00:00:01.000Z",source:"provider-ack"}]},
    {domain:"iband.movie-mentor.provider-effect-reality",schema:1,providerCallId:"call-comp-b",executionId:multiExecution.executionId,slotId:"continuity",task:"continuity",state:"confirmed",revision:2,evidence:[{externalEffectId:"effect-comp-b",provider:"test-provider",observedAt:"2035-01-01T00:00:01.000Z",source:"provider-ack"}]},
  ],
  movie_mentor_inference_spend_reservation:{domain:"iband.movie-mentor.inference-spend",schema:1,reservationId:multiExecution.reservationId,principalId:multiExecution.principalId,projectId:multiExecution.projectId,operation:"movie-mentor-turn",units:1,status:"reserved"},
  movie_mentor_inference_entitlement:{domain:"iband.movie-mentor.inference-spend",schema:1,principalId:multiExecution.principalId,remainingUnits:4,reservedUnits:1,consumedUnits:0,entitlementRevision:3},
};
multiRows.movie_mentor_provider_operation_reality.reconstructionInputDigest=inputDigest(multiRows.movie_mentor_provider_operation_reality.reconstructionInput);
const multiDb={collection(name){return collectionFor(multiRows,name);}};
const multiStore=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>physicalSession,db:()=>multiDb,now:()=>new Date("2035-01-01T00:00:02.000Z")});
const liveSingleConflictProof=[{providerCallId:"call-comp-b",executionId:multiExecution.executionId,slotId:"continuity",task:"continuity",state:"confirmed",evidence:structuredClone(multiRows.movie_mentor_provider_effect_reality[1].evidence)}];
const multiRecoveryConflict={...recoveryConflict,creatorStateUniverseConflictAuthority:{...recoveryConflict.creatorStateUniverseConflictAuthority,providerCallId:"call-comp-b",task:"continuity"}};
const multiDecision=await multiStore.compensateSupersededCreatorState({execution:multiExecution,recoveryConflict:multiRecoveryConflict,providerEffects:liveSingleConflictProof});
assert.equal(multiDecision.authorized,true,"RED: a multi-call turn with durable CONFIRMED provider reality must not strand Creator value merely because the live semantic-universe conflict carries proof for the exact failed call while the transaction can reread the full provider-effect universe.");
assert.equal(multiDecision.compensated,true);
assert.equal(multiRows.movie_mentor_inference_execution.phase,"compensated");
assert.equal(multiRows.movie_mentor_inference_entitlement.remainingUnits,5);
console.log("GREEN: multi-call Creator Compensation derives the complete confirmed provider-effect universe durably while binding the live conflict to its exact failed provider call.");

const wrongCallDecision=await multiStore.compensateSupersededCreatorState({execution:multiExecution,recoveryConflict:multiRecoveryConflict,providerEffects:[{...liveSingleConflictProof[0],providerCallId:"call-not-admitted"}]});
assert.equal(wrongCallDecision.authorized,false,"caller proof for a non-admitted call must fail closed.");
assert.equal(wrongCallDecision.reason,"provider-effect-proof-binding-invalid");
const wrongExecutionDecision=await multiStore.compensateSupersededCreatorState({execution:multiExecution,recoveryConflict:multiRecoveryConflict,providerEffects:[{...liveSingleConflictProof[0],executionId:"exec-other"}]});
assert.equal(wrongExecutionDecision.authorized,false,"caller proof from another execution must fail closed.");
assert.equal(wrongExecutionDecision.reason,"provider-effect-proof-binding-invalid");
console.log("GREEN: multi-call proof relaxation remains fenced to a confirmed call admitted by this exact execution.");

const forgedConflict={code:"MOVIE_MENTOR_PROVIDER_RECOVERY_CREATOR_STATE_UNIVERSE_CONFLICT"};
let forgedBareCauseRejected=false;
try{await multiStore.compensateSupersededCreatorState({execution:multiExecution,recoveryConflict:forgedConflict,providerEffects:liveSingleConflictProof});}catch(error){forgedBareCauseRejected=error?.code==="MOVIE_MENTOR_CREATOR_COMPENSATION_BINDING_REQUIRED";}
assert.equal(forgedBareCauseRejected,true,"Bare universe-conflict error code must fail closed without recovery-owned cause proof.");
const structurallyForgedConflict={code:"MOVIE_MENTOR_PROVIDER_RECOVERY_CREATOR_STATE_UNIVERSE_CONFLICT",creatorStateUniverseConflictAuthority:{domain:"iband.movie-mentor.provider-recovery-creator-state-universe-conflict",schema:1,providerCallId:"call-comp-b",task:"continuity",historicalCreatorStateUniverse:{revision:999,revisionAuthorityReference:"forged:historical",snapshotFingerprint:"forged-historical",snapshotReference:"snapshot:forged-historical",creatorStateGeneration:999,creatorStateFingerprint:"forged-historical",creatorStateAuthorityReference:"forged:historical"},currentCreatorStateUniverse:{revision:1000,revisionAuthorityReference:"forged:current",snapshotFingerprint:"forged-current",snapshotReference:"snapshot:forged-current",creatorStateGeneration:1000,creatorStateFingerprint:"forged-current",creatorStateAuthorityReference:"forged:current"}}};
const structurallyForgedDecision=await multiStore.compensateSupersededCreatorState({execution:multiExecution,recoveryConflict:structurallyForgedConflict,providerEffects:liveSingleConflictProof});
assert.equal(structurallyForgedDecision.authorized,false,"RED: structurally valid but fabricated Creator-state universe conflict proof must not mint Creator Compensation.");console.log("GREEN: Creator Compensation requires proof-bearing superseded Creator-state cause authority, not a forgeable error-code label.");




