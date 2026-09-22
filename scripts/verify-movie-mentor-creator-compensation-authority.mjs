import assert from "node:assert/strict";
import { createMovieMentorInferenceSettlementReconciliationAuthority } from "../ai/MovieMentorInferenceSettlementReconciliationAuthority.js";
import { createMovieMentorInferenceSettlementMongoStore } from "../ai/MovieMentorInferenceSettlementMongoStore.js";
import { createMovieMentorInferenceExecutionMongoStore } from "../ai/MovieMentorInferenceExecutionMongoStore.js";
import { digestMovieMentorProviderReconstructionInput } from "../ai/MovieMentorProviderOperationAuthority.js";
import fs from "node:fs";
import crypto from "node:crypto";
import { convergeExistingTurn } from "../ai/MovieMentorTurnRuntime.js";
const inputDigest=value=>digestMovieMentorProviderReconstructionInput(value);

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
    historicalCreatorStateUniverse:Object.freeze({revision:7,revisionAuthorityReference:null,snapshotFingerprint:null,snapshotReference:"snapshot:7",creatorStateGeneration:7,creatorStateFingerprint:"a".repeat(64),creatorStateAuthorityReference:null}),
    currentCreatorStateUniverse:Object.freeze({revision:8,revisionAuthorityReference:null,snapshotFingerprint:null,snapshotReference:"snapshot:8",creatorStateGeneration:8,creatorStateFingerprint:"b".repeat(64),creatorStateAuthorityReference:null}),
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
  movie_mentor_creator_state:{projectId:execution.projectId,revision:8,revisionAuthorityReference:"",snapshotReference:"snapshot:8",creatorStateGeneration:8,creatorStateFingerprint:"b".repeat(64),creatorAuthorityReference:""},
  movie_mentor_inference_spend_reservation:{domain:"iband.movie-mentor.inference-spend",schema:1,reservationId:execution.reservationId,principalId:execution.principalId,projectId:execution.projectId,operation:"movie-mentor-turn",units:1,entitlementRevision:3,status:"reserved"},
  movie_mentor_inference_entitlement:{domain:"iband.movie-mentor.inference-spend",schema:1,principalId:execution.principalId,remainingUnits:4,reservedUnits:1,consumedUnits:0,entitlementRevision:3},
};
physicalRows.movie_mentor_provider_operation_reality.reconstructionInputDigest=inputDigest(physicalRows.movie_mentor_provider_operation_reality.reconstructionInput);
const physicalDb={collection(name){return collectionFor(physicalRows,name);}};
const physicalSession={async withTransaction(fn){return fn();},async endSession(){}};
const physicalStore=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>physicalSession,db:()=>physicalDb,now:()=>new Date("2035-01-01T00:00:02.000Z")});
const physicalFirst=await physicalStore.compensateSupersededCreatorState({execution,recoveryConflict,providerEffects:[confirmedEffect]});
assert.equal(physicalFirst.authorized,true,`RED: production Mongo compensation store must physically authorize the exact proven superseded-state disposition; actual=${JSON.stringify(physicalFirst)}`);
assert.equal(physicalRows.movie_mentor_inference_execution.phase,"compensated","production transaction must durably terminate as COMPENSATED, never ABORTED.");
assert.equal(physicalRows.movie_mentor_inference_spend_reservation.status,"released");
assert.equal(physicalRows.movie_mentor_inference_entitlement.remainingUnits,5);
assert.equal(physicalRows.movie_mentor_inference_entitlement.reservedUnits,0);
const physicalSecond=await physicalStore.compensateSupersededCreatorState({execution,recoveryConflict,providerEffects:[confirmedEffect]});
assert.equal(physicalSecond.idempotent,true,"retry must recognize the same durable Creator Compensation disposition.");
assert.equal(physicalRows.movie_mentor_inference_entitlement.remainingUnits,5,"production retry must never restore Creator value twice.");
assert.equal(physicalRows.movie_mentor_inference_entitlement.reservedUnits,0);
assert.equal(physicalRows.movie_mentor_provider_effect_reality[0].state,"confirmed","provider work history must survive Creator Compensation.");
{
  const conflictRows=structuredClone(physicalRows);
  conflictRows.movie_mentor_inference_execution.phase="active";
  conflictRows.movie_mentor_inference_execution.compensatedAt=null;
  conflictRows.movie_mentor_inference_execution.compensationReason="";
  conflictRows.movie_mentor_inference_spend_reservation.status="released";
  conflictRows.movie_mentor_inference_spend_reservation.settlementReason="creator-compensation:superseded-creator-state";
  conflictRows.movie_mentor_inference_spend_reservation.settlementExecutionId="execution-other";
  conflictRows.movie_mentor_inference_entitlement.remainingUnits=5;
  conflictRows.movie_mentor_inference_entitlement.reservedUnits=0;
  const db={collection(name){return collectionFor(conflictRows,name);}};
  const conflictStore=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>physicalSession,db:()=>db,now:()=>new Date("2035-01-01T00:00:02.250Z")});
  let releaseConflict=false;
  try{await conflictStore.compensateSupersededCreatorState({execution,recoveryConflict,providerEffects:[confirmedEffect]});}catch(error){releaseConflict=error?.code==="MOVIE_MENTOR_CREATOR_COMPENSATION_RELEASE_CONFLICT";}
  assert.equal(releaseConflict,true,"RED: a released reservation owned by another execution/disposition must not borrow Creator Compensation retry idempotency.");
  assert.equal(conflictRows.movie_mentor_inference_entitlement.remainingUnits,5);
  assert.equal(conflictRows.movie_mentor_inference_entitlement.reservedUnits,0);
}
console.log("GREEN: physical compensation retry is exactly-once for its own durable disposition and rejects a released reservation owned by another execution.");
{
  const raceRows=structuredClone(physicalRows);
  raceRows.movie_mentor_inference_execution.phase="active";
  raceRows.movie_mentor_inference_execution.compensatedAt=null;
  raceRows.movie_mentor_inference_execution.compensationReason="";
  raceRows.movie_mentor_inference_spend_reservation.status="reserved";
  raceRows.movie_mentor_inference_spend_reservation.settlementReason="";
  raceRows.movie_mentor_inference_spend_reservation.settlementExecutionId="";
  raceRows.movie_mentor_inference_entitlement.remainingUnits=4;
  raceRows.movie_mentor_inference_entitlement.reservedUnits=1;
  let injected=false;
  const db={collection(name){
    const base=collectionFor(raceRows,name);
    if(name!=="movie_mentor_inference_execution")return base;
    return {...base,async updateOne(filter,update){
      if(!injected){injected=true;raceRows.movie_mentor_inference_execution.phase="closing";}
      return base.updateOne(filter,update);
    }};
  }};
  const raceStore=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>physicalSession,db:()=>db,now:()=>new Date("2035-01-01T00:00:02.300Z")});
  let executionRace=false;
  try{await raceStore.compensateSupersededCreatorState({execution,recoveryConflict,providerEffects:[confirmedEffect]});}catch(error){executionRace=error?.code==="MOVIE_MENTOR_CREATOR_COMPENSATION_EXECUTION_RACE";}
  assert.equal(executionRace,true,"RED: compensation must fail closed if execution authority changes after snapshot validation but before terminalization.");
  assert.equal(raceRows.movie_mentor_inference_execution.phase,"closing");
  assert.equal(raceRows.movie_mentor_inference_spend_reservation.status,"reserved");
  assert.equal(raceRows.movie_mentor_inference_entitlement.remainingUnits,4);
  assert.equal(raceRows.movie_mentor_inference_entitlement.reservedUnits,1);
}
console.log("GREEN: compensation terminalization is CAS-fenced against an execution phase race before any Creator ledger restoration.");
{
  const ledgerRows=structuredClone(physicalRows);
  ledgerRows.movie_mentor_inference_execution.phase="active";ledgerRows.movie_mentor_inference_execution.compensatedAt=null;ledgerRows.movie_mentor_inference_execution.compensationReason="";
  ledgerRows.movie_mentor_inference_spend_reservation.status="reserved";ledgerRows.movie_mentor_inference_spend_reservation.settlementReason="";ledgerRows.movie_mentor_inference_spend_reservation.settlementExecutionId="";
  ledgerRows.movie_mentor_inference_entitlement.remainingUnits=4;ledgerRows.movie_mentor_inference_entitlement.reservedUnits=0;
  const db={collection(name){return collectionFor(ledgerRows,name);}};
  const store=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>physicalSession,db:()=>db,now:()=>new Date("2035-01-01T00:00:02.350Z")});
  let ledgerConflict=false;try{await store.compensateSupersededCreatorState({execution,recoveryConflict,providerEffects:[confirmedEffect]});}catch(error){ledgerConflict=error?.code==="MOVIE_MENTOR_CREATOR_COMPENSATION_LEDGER_CONFLICT";}
  assert.equal(ledgerConflict,true,"RED: compensation must fail closed if the reserved-unit ledger no longer owns the restoration.");
  assert.equal(ledgerRows.movie_mentor_inference_spend_reservation.status,"reserved");
  assert.equal(ledgerRows.movie_mentor_inference_entitlement.remainingUnits,4);
}
{
  const reservationRows=structuredClone(physicalRows);
  reservationRows.movie_mentor_inference_execution.phase="active";reservationRows.movie_mentor_inference_execution.compensatedAt=null;reservationRows.movie_mentor_inference_execution.compensationReason="";
  reservationRows.movie_mentor_inference_spend_reservation.status="reserved";reservationRows.movie_mentor_inference_spend_reservation.settlementReason="";reservationRows.movie_mentor_inference_spend_reservation.settlementExecutionId="";
  reservationRows.movie_mentor_inference_entitlement.remainingUnits=4;reservationRows.movie_mentor_inference_entitlement.reservedUnits=1;
  let injected=false;
  const db={collection(name){const base=collectionFor(reservationRows,name);if(name!=="movie_mentor_inference_spend_reservation")return base;return {...base,async findOneAndUpdate(filter,update){if(!injected){injected=true;reservationRows.movie_mentor_inference_spend_reservation.status="consumed";}return base.findOneAndUpdate(filter,update);}};}};
  const store=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>physicalSession,db:()=>db,now:()=>new Date("2035-01-01T00:00:02.400Z")});
  let reservationRace=false;try{await store.compensateSupersededCreatorState({execution,recoveryConflict,providerEffects:[confirmedEffect]});}catch(error){reservationRace=error?.code==="MOVIE_MENTOR_CREATOR_COMPENSATION_RESERVATION_RACE";}
  assert.equal(reservationRace,true,"RED: compensation must fail closed if reservation authority changes before release.");
}
console.log("GREEN: compensation fails closed on ledger-ownership loss and reservation-release race; transaction authority must own the whole terminal disposition.");
{
  const retryRows=structuredClone(physicalRows);
  retryRows.movie_mentor_inference_execution.phase="active";retryRows.movie_mentor_inference_execution.compensatedAt=null;retryRows.movie_mentor_inference_execution.compensationReason="";
  retryRows.movie_mentor_inference_spend_reservation.status="reserved";retryRows.movie_mentor_inference_spend_reservation.settlementReason="";retryRows.movie_mentor_inference_spend_reservation.settlementExecutionId="";
  retryRows.movie_mentor_inference_entitlement.remainingUnits=4;retryRows.movie_mentor_inference_entitlement.reservedUnits=1;
  const db={collection(name){return collectionFor(retryRows,name);}};
  let callbacks=0;
  const retrySession={async withTransaction(fn){const first=await fn();callbacks+=1;const second=await fn();callbacks+=1;return second??first;},async endSession(){}};
  const store=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>retrySession,db:()=>db,now:()=>new Date("2035-01-01T00:00:02.450Z")});
  const outcome=await store.compensateSupersededCreatorState({execution,recoveryConflict,providerEffects:[confirmedEffect]});
  assert.equal(callbacks,2,"fixture must re-enter the transaction callback after the first durable disposition.");
  assert.equal(outcome.authorized,true);
  assert.equal(outcome.idempotent,true,"RED: transaction callback re-entry must converge on the already-owned compensation disposition.");
  assert.equal(retryRows.movie_mentor_inference_entitlement.remainingUnits,5,"RED: transaction callback re-entry must not restore Creator value twice.");
  assert.equal(retryRows.movie_mentor_inference_entitlement.reservedUnits,0);
  assert.equal(retryRows.movie_mentor_inference_spend_reservation.status,"released");
}
console.log("GREEN: compensation transaction callback re-entry converges on the same durable disposition without double-restoring Creator value.");
{
  const uncertainRows=structuredClone(physicalRows);
  uncertainRows.movie_mentor_inference_execution.phase="active";uncertainRows.movie_mentor_inference_execution.compensatedAt=null;uncertainRows.movie_mentor_inference_execution.compensationReason="";
  uncertainRows.movie_mentor_inference_spend_reservation.status="reserved";uncertainRows.movie_mentor_inference_spend_reservation.settlementReason="";uncertainRows.movie_mentor_inference_spend_reservation.settlementExecutionId="";
  uncertainRows.movie_mentor_inference_entitlement.remainingUnits=4;uncertainRows.movie_mentor_inference_entitlement.reservedUnits=1;
  const db={collection(name){return collectionFor(uncertainRows,name);}};
  let first=true;
  const ambiguousSession={async withTransaction(fn){const result=await fn();if(first){first=false;const error=new Error("simulated lost commit acknowledgement");error.errorLabels=["UnknownTransactionCommitResult"];throw error;}return result;},async endSession(){}};
  const store=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>ambiguousSession,db:()=>db,now:()=>new Date("2035-01-01T00:00:02.500Z")});
  let uncertain=false;try{await store.compensateSupersededCreatorState({execution,recoveryConflict,providerEffects:[confirmedEffect]});}catch(error){uncertain=error?.code==="MOVIE_MENTOR_CREATOR_COMPENSATION_STORE_UNAVAILABLE";}
  assert.equal(uncertain,true,"fixture must expose ambiguous post-commit acknowledgement as retryable uncertainty.");
  assert.equal(uncertainRows.movie_mentor_inference_entitlement.remainingUnits,5);
  assert.equal(uncertainRows.movie_mentor_inference_entitlement.reservedUnits,0);
  assert.equal(uncertainRows.movie_mentor_inference_spend_reservation.status,"released");
  const retrySession={async withTransaction(fn){return fn();},async endSession(){}};
  const retryStore=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>retrySession,db:()=>db,now:()=>new Date("2035-01-01T00:00:02.550Z")});
  const reconciled=await retryStore.compensateSupersededCreatorState({execution,recoveryConflict,providerEffects:[confirmedEffect]});
  assert.equal(reconciled.authorized,true);
  assert.equal(reconciled.idempotent,true,"RED: retry after ambiguous commit acknowledgement must reconcile the already-durable compensation.");
  assert.equal(uncertainRows.movie_mentor_inference_entitlement.remainingUnits,5,"RED: ambiguous commit retry must never double-restore Creator value.");
  assert.equal(uncertainRows.movie_mentor_inference_entitlement.reservedUnits,0);
}
console.log("GREEN: ambiguous compensation commit acknowledgement converges on retry to the exact durable disposition without double restoration.");
{
  const generationRows=structuredClone(physicalRows);
  generationRows.movie_mentor_inference_execution.phase="active";generationRows.movie_mentor_inference_execution.compensatedAt=null;generationRows.movie_mentor_inference_execution.compensationReason="";
  generationRows.movie_mentor_inference_spend_reservation.status="reserved";generationRows.movie_mentor_inference_spend_reservation.settlementReason="";generationRows.movie_mentor_inference_spend_reservation.settlementExecutionId="";
  generationRows.movie_mentor_inference_entitlement.remainingUnits=4;generationRows.movie_mentor_inference_entitlement.reservedUnits=1;
  generationRows.movie_mentor_inference_entitlement.entitlementRevision=generationRows.movie_mentor_inference_spend_reservation.entitlementRevision-1;
  const db={collection(name){return collectionFor(generationRows,name);}};
  const store=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>physicalSession,db:()=>db,now:()=>new Date("2035-01-01T00:00:02.600Z")});
  let denied=false;let result=null;try{result=await store.compensateSupersededCreatorState({execution,recoveryConflict,providerEffects:[confirmedEffect]});denied=result?.authorized!==true;}catch{denied=true;}
  assert.equal(denied,true,"RED: compensation must not restore a reservation against entitlement reality whose revision predates the reservation's own bound entitlement revision; actual="+JSON.stringify(result));
  assert.equal(generationRows.movie_mentor_inference_spend_reservation.status,"reserved");
  assert.equal(generationRows.movie_mentor_inference_entitlement.remainingUnits,4);
  assert.equal(generationRows.movie_mentor_inference_entitlement.reservedUnits,1);
}
console.log("GREEN: compensation rejects entitlement reality that chronologically predates the reservation's bound entitlement revision.");
{
  const suspendedRows=structuredClone(physicalRows);
  suspendedRows.movie_mentor_inference_execution.phase="active";suspendedRows.movie_mentor_inference_execution.compensatedAt=null;suspendedRows.movie_mentor_inference_execution.compensationReason="";
  suspendedRows.movie_mentor_inference_spend_reservation.status="reserved";suspendedRows.movie_mentor_inference_spend_reservation.settlementReason="";suspendedRows.movie_mentor_inference_spend_reservation.settlementExecutionId="";
  suspendedRows.movie_mentor_inference_entitlement.status="suspended";suspendedRows.movie_mentor_inference_entitlement.remainingUnits=4;suspendedRows.movie_mentor_inference_entitlement.reservedUnits=1;suspendedRows.movie_mentor_inference_entitlement.entitlementRevision=suspendedRows.movie_mentor_inference_spend_reservation.entitlementRevision+1;
  const db={collection(name){return collectionFor(suspendedRows,name);}};
  const store=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>physicalSession,db:()=>db,now:()=>new Date("2035-01-01T00:00:02.650Z")});
  let denied=false;let result=null;try{result=await store.compensateSupersededCreatorState({execution,recoveryConflict,providerEffects:[confirmedEffect]});denied=result?.authorized!==true;}catch{denied=true;}
  assert.equal(denied,true,"RED: Creator Compensation must not restore spendable value through a currently suspended entitlement merely because its revision is chronologically newer than the reservation; actual="+JSON.stringify(result));
  assert.equal(suspendedRows.movie_mentor_inference_spend_reservation.status,"reserved");
  assert.equal(suspendedRows.movie_mentor_inference_entitlement.status,"suspended");
  assert.equal(suspendedRows.movie_mentor_inference_entitlement.remainingUnits,4);
  assert.equal(suspendedRows.movie_mentor_inference_entitlement.reservedUnits,1);
}
console.log("GREEN: current entitlement suspension independently fences Creator Compensation even when revision chronology is valid.");
const postCompensationSettlement=await physicalStore.settleCanonicalResult({executionId:execution.executionId});
assert.equal(postCompensationSettlement.authorized,false,"compensated execution must never later authorize canonical consumption.");
assert.equal(postCompensationSettlement.outcome,"reserved");
console.log("GREEN: production Mongo compensation transaction restores Creator value exactly once, preserves provider history, and cannot later consume the compensated turn.");
{
  const compensatedDoc={...structuredClone(physicalRows.movie_mentor_inference_execution),requestDigest:"request-comp-1",ownerId:"owner-comp-1",leaseGeneration:1,leaseReference:"lease-comp-1",fencingToken:"fence-comp-1",leaseAcquiredAt:"2034-12-31T23:59:00.000Z",leaseExpiresAt:"2035-01-01T00:05:00.000Z",maxProviderCalls:4,providerCalls:[{providerCallId:"call-comp-1",slotId:"semantic",task:"movie-mentor-semantic",state:"admitted",leaseGeneration:1,leaseReference:"lease-comp-1",fencingToken:"fence-comp-1",admittedAt:"2035-01-01T00:00:00.000Z"}]};
  const leanExec=()=>({lean(){return{exec:async()=>structuredClone(compensatedDoc)}}});
  const executionReaderModel={findOne:leanExec};
  const canonicalExecutionStore=createMovieMentorInferenceExecutionMongoStore({mongoModel:executionReaderModel,reservationCollection:false});
  const canonicalCompensated=await canonicalExecutionStore.readExecution(execution.executionId);
  assert.equal(canonicalCompensated.phase,"compensated","RED: canonical execution reader must accept the exact COMPENSATED record written by the physical settlement transaction.");
  assert.equal(canonicalCompensated.compensationReason,"superseded-creator-state");
  const malformed={...compensatedDoc,providerCalls:[],providerCallsClaimed:0};
  const malformedModel={findOne(){return{lean(){return{exec:async()=>structuredClone(malformed)}}}}};
  const malformedStore=createMovieMentorInferenceExecutionMongoStore({mongoModel:malformedModel,reservationCollection:false});
  await assert.rejects(()=>malformedStore.readExecution(execution.executionId),error=>error?.code==="MOVIE_MENTOR_INFERENCE_EXECUTION_COMPENSATION_RECORD_INVALID","RED: canonical execution reader must reject a COMPENSATED record that does not preserve its claimed provider-work universe.");
}
console.log("GREEN: canonical execution reader accepts the exact physical COMPENSATED disposition and rejects malformed compensation history.");
{
  const reorderedInput={context:{turnContextAuthority:{creatorState:{fingerprint:"a".repeat(64),generation:7},snapshotReference:"snapshot:7",revision:7}}};
  assert.equal(digestMovieMentorProviderReconstructionInput(reorderedInput),digestMovieMentorProviderReconstructionInput(physicalRows.movie_mentor_provider_operation_reality.reconstructionInput),"court precondition: canonical provider-operation digest must ignore object key insertion order.");
  const rows=structuredClone(physicalRows);
  rows.movie_mentor_inference_execution.phase="active";
  rows.movie_mentor_inference_execution.compensatedAt=null;
  rows.movie_mentor_inference_execution.compensationReason="";
  rows.movie_mentor_inference_spend_reservation.status="reserved";
  rows.movie_mentor_inference_spend_reservation.settledAt=null;
  rows.movie_mentor_inference_spend_reservation.settlementReason="";
  rows.movie_mentor_inference_entitlement.remainingUnits=4;
  rows.movie_mentor_inference_entitlement.reservedUnits=1;
  rows.movie_mentor_provider_operation_reality.reconstructionInput=reorderedInput;
  rows.movie_mentor_provider_operation_reality.reconstructionInputDigest=digestMovieMentorProviderReconstructionInput(reorderedInput);
  const db={collection(name){return collectionFor(rows,name);}};
  const store=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>physicalSession,db:()=>db,now:()=>new Date("2035-01-01T00:00:03.000Z")});
  const decision=await store.compensateSupersededCreatorState({execution,recoveryConflict,providerEffects:[confirmedEffect]});
  assert.equal(decision.authorized,true,`RED: Creator Compensation must validate historical reconstruction provenance with the canonical provider-operation digest; semantically identical input key order cannot strand Creator value. actual=${JSON.stringify(decision)}`);
}
console.log("GREEN: Creator Compensation uses canonical provider-operation reconstruction digest semantics.");
{
  const rows=structuredClone(physicalRows);
  rows.movie_mentor_inference_execution.phase="active";
  rows.movie_mentor_inference_execution.compensatedAt=null;
  rows.movie_mentor_inference_execution.compensationReason="";
  rows.movie_mentor_inference_spend_reservation.status="reserved";
  rows.movie_mentor_inference_spend_reservation.settledAt=null;
  rows.movie_mentor_inference_spend_reservation.settlementReason="";
  rows.movie_mentor_inference_entitlement.remainingUnits=4;
  rows.movie_mentor_inference_entitlement.reservedUnits=1;
  rows.movie_mentor_provider_operation_reality.reconstructionInput.context.turnContextAuthority.revision=999;
  rows.movie_mentor_provider_operation_reality.reconstructionInputDigest=digestMovieMentorProviderReconstructionInput(rows.movie_mentor_provider_operation_reality.reconstructionInput);
  const db={collection(name){return collectionFor(rows,name);}};
  const store=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>physicalSession,db:()=>db,now:()=>new Date("2035-01-01T00:00:03.500Z")});
  const decision=await store.compensateSupersededCreatorState({execution,recoveryConflict,providerEffects:[confirmedEffect]});
  assert.equal(decision.authorized,false,"RED: canonical digest validity alone must not let changed historical reconstruction content impersonate the recovery-owned historical Creator-state universe.");
  assert.equal(decision.compensated,false);
  assert.equal(decision.reason,"creator-state-conflict-cause-provenance-invalid");
  assert.equal(rows.movie_mentor_inference_spend_reservation.status,"reserved");
  assert.equal(rows.movie_mentor_inference_entitlement.remainingUnits,4);
  assert.equal(rows.movie_mentor_inference_entitlement.reservedUnits,1);
}
console.log("GREEN: changed canonical historical reconstruction content cannot authorize Creator Compensation merely by carrying a valid recomputed digest.");
{
  const rows=structuredClone(physicalRows);
  rows.movie_mentor_inference_execution.phase="active";
  rows.movie_mentor_inference_execution.compensatedAt=null;
  rows.movie_mentor_inference_execution.compensationReason="";
  rows.movie_mentor_inference_spend_reservation.status="reserved";
  rows.movie_mentor_inference_spend_reservation.settledAt=null;
  rows.movie_mentor_inference_spend_reservation.settlementReason="";
  rows.movie_mentor_inference_entitlement.remainingUnits=4;
  rows.movie_mentor_inference_entitlement.reservedUnits=1;
  const genuineCurrentFingerprint="c".repeat(64);
  const conflict={...recoveryConflict,creatorStateUniverseConflictAuthority:{...recoveryConflict.creatorStateUniverseConflictAuthority,currentCreatorStateUniverse:{...recoveryConflict.creatorStateUniverseConflictAuthority.currentCreatorStateUniverse,snapshotFingerprint:genuineCurrentFingerprint}}};
  const db={collection(name){return collectionFor(rows,name);}};
  const store=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>physicalSession,db:()=>db,now:()=>new Date("2035-01-01T00:00:04.000Z")});
  const decision=await store.compensateSupersededCreatorState({execution,recoveryConflict:conflict,providerEffects:[confirmedEffect]});
  assert.equal(decision.authorized,true,`RED: a genuine recovered current turn-context universe carries a non-null snapshotFingerprint, while durable Creator state owns its revision/reference/generation/fingerprint/snapshotReference but does not persist that derived turn-envelope fingerprint; compensation must not strand Creator value solely because the raw Creator-state row cannot reproduce a non-durable derived fingerprint. actual=${JSON.stringify(decision)}`);
}
console.log("GREEN: compensation current-state provenance does not require the Creator-state row to invent a non-durable turn-context snapshot fingerprint.");
{
  for(const [field,value] of [
    ["revision",999],
    ["revisionAuthorityReference","revision-authority-forged"],
    ["snapshotReference","snapshot:forged"],
    ["creatorStateGeneration",999],
    ["creatorStateFingerprint","d".repeat(64)],
    ["creatorAuthorityReference","creator-authority-forged"],
  ]){
    const rows=structuredClone(physicalRows);
    rows.movie_mentor_inference_execution.phase="active";
    rows.movie_mentor_inference_execution.compensatedAt=null;
    rows.movie_mentor_inference_execution.compensationReason="";
    rows.movie_mentor_inference_spend_reservation.status="reserved";
    rows.movie_mentor_inference_spend_reservation.settledAt=null;
    rows.movie_mentor_inference_spend_reservation.settlementReason="";
    rows.movie_mentor_inference_entitlement.remainingUnits=4;
    rows.movie_mentor_inference_entitlement.reservedUnits=1;
    rows.movie_mentor_creator_state[field]=value;
    const db={collection(name){return collectionFor(rows,name);}};
    const store=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>physicalSession,db:()=>db,now:()=>new Date("2035-01-01T00:00:04.500Z")});
    const decision=await store.compensateSupersededCreatorState({execution,recoveryConflict,providerEffects:[confirmedEffect]});
    assert.equal(decision.authorized,false,`RED: changed durable current Creator-state ${field} must not authorize compensation against a different recovery-owned current universe.`);
    assert.equal(decision.compensated,false);
    assert.equal(decision.reason,"creator-state-conflict-current-provenance-invalid");
    assert.equal(rows.movie_mentor_inference_spend_reservation.status,"reserved");
    assert.equal(rows.movie_mentor_inference_entitlement.remainingUnits,4);
    assert.equal(rows.movie_mentor_inference_entitlement.reservedUnits,1);
  }
}
console.log("GREEN: every durable current Creator-state provenance dimension is bound before compensation; changed current authority cannot borrow a recovery conflict from another universe.");
{
  let reserveCalls=0;
  const oldExecution={found:true,executionId:"execution-comp-old",creatorTurnId:"turn-comp-old",principalId:"creator-comp-1",projectId:"project-comp-1",reservationId:"reservation-comp-old",requestDigest:"digest-old",phase:"compensated"};
  await assert.rejects(
    ()=>convergeExistingTurn({existing:oldExecution,inferenceExecutionAuthority:{},settlementAuthority:{}}),
    error=>error?.code==="MOVIE_MENTOR_INFERENCE_EXECUTION_COMPENSATED"&&error?.retryable===false,
    "COMPENSATED creatorTurnId must remain terminal before any new reservation or provider work."
  );
  const freshTurnId="turn-comp-fresh";
  const byTurn=new Map([[oldExecution.creatorTurnId,oldExecution]]);
  const spendAuthority={reserveTurn:async({creatorTurnId})=>{reserveCalls++;return{authorized:true,reservationId:`reservation:${creatorTurnId}`,creatorTurnId,status:"reserved"};}};
  const existing=byTurn.get(freshTurnId)||null;
  assert.equal(existing,null,"fresh creatorTurnId must not inherit the compensated execution identity");
  const freshReservation=await spendAuthority.reserveTurn({creatorTurnId:freshTurnId});
  assert.equal(freshReservation.authorized,true);
  assert.equal(freshReservation.creatorTurnId,freshTurnId);
  assert.equal(reserveCalls,1,"fresh N+1 may reserve exactly once independently of terminal compensated N");
}
console.log("GREEN: compensated N is terminal while fresh N+1 owns an independent reservation identity.");
{
  const compensated={found:true,authorized:true,executionId:"execution-comp-phase",creatorTurnId:"turn-comp-phase",principalId:"creator-comp-1",projectId:"project-comp-1",reservationId:"reservation-comp-phase",requestDigest:"digest-comp-phase",phase:"compensated",schema:6,closureReference:""};
  let closureReads=0;
  const closureAuthority=(await import("../ai/MovieMentorInferenceExecutionClosureAuthority.js")).createMovieMentorInferenceExecutionClosureAuthority({
    store:{
      readExecution:async()=>{closureReads++;return compensated;},
      beginClosing:async()=>assert.fail("COMPENSATED execution must never re-enter CLOSING"),
      recoverExpiredIntoClosing:async()=>assert.fail("COMPENSATED execution must never recover into CLOSING"),
      completeClosing:async()=>assert.fail("COMPENSATED execution must never complete closure"),
      quarantineExecution:async()=>assert.fail("COMPENSATED execution must not be reclassified by closure"),
    },
    effectStore:{readEffect:async()=>assert.fail("COMPENSATED execution must not inspect provider reality for closure")},
  });
  const begin=await closureAuthority.beginClosing({execution:{authorized:true,executionId:compensated.executionId,ownerId:"owner",leaseGeneration:1,leaseReference:"lease",fencingToken:"fence"}});
  assert.equal(begin.authorized,false);
  assert.equal(begin.reason,"execution-not-active");
  assert.equal(begin.phase,"compensated");
  const recover=await closureAuthority.recoverExpiredIntoClosing({executionId:compensated.executionId});
  assert.equal(recover.authorized,false);
  assert.equal(recover.reason,"execution-not-active");
  assert.equal(recover.phase,"compensated");
  const reconcile=await closureAuthority.reconcile({executionId:compensated.executionId});
  assert.equal(reconcile.authorized,false);
  assert.equal(reconcile.reason,"execution-not-closing");
  assert.equal(reconcile.phase,"compensated");
  assert.equal(closureReads,3);
}
console.log("GREEN: schema-6 COMPENSATED is terminal across closure begin, expired recovery, and reconciliation; it cannot borrow CLOSED/FINALIZED/SETTLED authority.");
{
  const source=fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionMongoStore.js",import.meta.url),"utf8");
  assert.match(source,/current\.phase!==\"active\"\|\|text\(record\.phase\)!==\"active\"/,"RED: generic execution replacement must remain ACTIVE-only so COMPENSATED cannot be rewritten by lease CAS");
  assert.match(source,/executionId:text\(input\.executionId\),schema:SCHEMA,phase:\"active\"/,"RED: provider-call admission must remain ACTIVE-only so COMPENSATED cannot mint new provider work");
  assert.match(source,/findOneAndUpdate\(\{executionId:text\(executionId\),phase:\"active\"/,"RED: physical closure entry must remain ACTIVE-only");
  assert.match(source,/if\(current\.phase!==\"active\"\)return current;/,"RED: expired closure recovery must return COMPENSATED unchanged");
  assert.match(source,/findOneAndUpdate\(\{executionId:text\(executionId\),phase:\"closing\"/,"RED: closure completion must require CLOSING and cannot rewrite COMPENSATED");
  assert.match(source,/!\[\"closing\",\"closed\",\"finalized\",\"settled\"\]\.includes\(current\.phase\)/,"RED: quarantine transition must exclude COMPENSATED");
}
console.log("GREEN: physical execution CAS primitives cannot rewrite COMPENSATED back into active/provider/closure/quarantine authority.");

const multiExecution={...execution,executionId:"exec-comp-multi",creatorTurnId:"turn-comp-multi",reservationId:"res-comp-multi"};
const multiRows={
  movie_mentor_inference_execution:{domain:"iband.movie-mentor.inference-execution-store",schema:6,executionId:multiExecution.executionId,creatorTurnId:multiExecution.creatorTurnId,principalId:multiExecution.principalId,projectId:multiExecution.projectId,reservationId:multiExecution.reservationId,requestDigest:"request-comp-multi",phase:"active",providerCallsClaimed:2,providerCalls:[{providerCallId:"call-comp-a",slotId:"semantic",task:"movie-mentor-semantic"},{providerCallId:"call-comp-b",slotId:"continuity",task:"movie-mentor-specialist:continuity"}],settlementRealityBarrierRevision:0},
  movie_mentor_provider_operation_reality:{providerCallId:"call-comp-b",executionId:multiExecution.executionId,slotId:"continuity",task:"movie-mentor-specialist:continuity",reconstructionInput:{input:{turnContextAuthority:{revision:7,snapshotReference:"snapshot:7",creatorState:{generation:7,fingerprint:"a".repeat(64)}}}}},
  movie_mentor_provider_effect_reality:[
    {domain:"iband.movie-mentor.provider-effect-reality",schema:1,providerCallId:"call-comp-a",executionId:multiExecution.executionId,slotId:"semantic",task:"movie-mentor-semantic",state:"confirmed",revision:2,evidence:[{externalEffectId:"effect-comp-a",provider:"test-provider",observedAt:"2035-01-01T00:00:01.000Z",source:"provider-ack"}]},
    {domain:"iband.movie-mentor.provider-effect-reality",schema:1,providerCallId:"call-comp-b",executionId:multiExecution.executionId,slotId:"continuity",task:"movie-mentor-specialist:continuity",state:"confirmed",revision:2,evidence:[{externalEffectId:"effect-comp-b",provider:"test-provider",observedAt:"2035-01-01T00:00:01.000Z",source:"provider-ack"}]},
  ],
  movie_mentor_creator_state:{projectId:multiExecution.projectId,revision:8,revisionAuthorityReference:"",snapshotReference:"snapshot:8",creatorStateGeneration:8,creatorStateFingerprint:"b".repeat(64),creatorAuthorityReference:""},
  movie_mentor_inference_spend_reservation:{domain:"iband.movie-mentor.inference-spend",schema:1,reservationId:multiExecution.reservationId,principalId:multiExecution.principalId,projectId:multiExecution.projectId,operation:"movie-mentor-turn",units:1,entitlementRevision:3,status:"reserved"},
  movie_mentor_inference_entitlement:{domain:"iband.movie-mentor.inference-spend",schema:1,principalId:multiExecution.principalId,remainingUnits:4,reservedUnits:1,consumedUnits:0,entitlementRevision:3},
};
multiRows.movie_mentor_provider_operation_reality.reconstructionInputDigest=inputDigest(multiRows.movie_mentor_provider_operation_reality.reconstructionInput);
const multiDb={collection(name){return collectionFor(multiRows,name);}};
const multiStore=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>physicalSession,db:()=>multiDb,now:()=>new Date("2035-01-01T00:00:02.000Z")});
const liveSingleConflictProof=[{providerCallId:"call-comp-b",executionId:multiExecution.executionId,slotId:"continuity",task:"movie-mentor-specialist:continuity",state:"confirmed",evidence:structuredClone(multiRows.movie_mentor_provider_effect_reality[1].evidence)}];
const multiRecoveryConflict={...recoveryConflict,creatorStateUniverseConflictAuthority:{...recoveryConflict.creatorStateUniverseConflictAuthority,providerCallId:"call-comp-b",task:"movie-mentor-specialist:continuity"}};
const multiDecision=await multiStore.compensateSupersededCreatorState({execution:multiExecution,recoveryConflict:multiRecoveryConflict,providerEffects:liveSingleConflictProof});
assert.equal(multiDecision.authorized,true,`RED: a multi-call turn with durable CONFIRMED provider reality must not strand Creator value merely because the live semantic-universe conflict carries proof for the exact failed call while the transaction can reread the full provider-effect universe; actual=${JSON.stringify(multiDecision)}`);
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
{
  for(const [label,mutate,expectedReason] of [
    ["unknown",rows=>{rows.movie_mentor_provider_effect_reality[1].evidence=[];rows.movie_mentor_provider_effect_reality[1].state="unknown";},"provider-effect-not-confirmed"],
    ["conflict",rows=>{rows.movie_mentor_provider_effect_reality[1].evidence.push({...structuredClone(rows.movie_mentor_provider_effect_reality[1].evidence[0]),externalEffectId:"effect-comp-b-conflict"});rows.movie_mentor_provider_effect_reality[1].state="conflict";},"provider-effect-not-confirmed"],
    ["missing",rows=>{rows.movie_mentor_provider_effect_reality=rows.movie_mentor_provider_effect_reality.slice(0,1);},"provider-effect-universe-incomplete"],
  ]){
    const rows=structuredClone(multiRows);
    rows.movie_mentor_inference_execution.phase="active";
    rows.movie_mentor_inference_execution.compensatedAt=null;
    rows.movie_mentor_inference_execution.compensationReason="";
    rows.movie_mentor_inference_spend_reservation.status="reserved";
    rows.movie_mentor_inference_spend_reservation.settledAt=null;
    rows.movie_mentor_inference_spend_reservation.settlementReason="";
    rows.movie_mentor_inference_entitlement.remainingUnits=4;
    rows.movie_mentor_inference_entitlement.reservedUnits=1;
    mutate(rows);
    const db={collection(name){return collectionFor(rows,name);}};
    const store=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>physicalSession,db:()=>db,now:()=>new Date("2035-01-01T00:00:02.500Z")});
    const decision=await store.compensateSupersededCreatorState({execution:multiExecution,recoveryConflict:multiRecoveryConflict,providerEffects:liveSingleConflictProof});
    assert.equal(decision.authorized,false,`RED: stale caller CONFIRMED proof must not authorize compensation after durable provider-effect reality becomes ${label}.`);
    assert.equal(decision.compensated,false);
    assert.equal(decision.reason,expectedReason);
    assert.equal(rows.movie_mentor_inference_spend_reservation.status,"reserved");
    assert.equal(rows.movie_mentor_inference_entitlement.remainingUnits,4);
    assert.equal(rows.movie_mentor_inference_entitlement.reservedUnits,1);
  }
}
console.log("GREEN: stale caller provider-effect proof cannot outrank transaction-time durable effect reality; unknown, conflict, or incomplete universes fail closed without restoring Creator value.");

const forgedConflict={code:"MOVIE_MENTOR_PROVIDER_RECOVERY_CREATOR_STATE_UNIVERSE_CONFLICT"};
let forgedBareCauseRejected=false;
try{await multiStore.compensateSupersededCreatorState({execution:multiExecution,recoveryConflict:forgedConflict,providerEffects:liveSingleConflictProof});}catch(error){forgedBareCauseRejected=error?.code==="MOVIE_MENTOR_CREATOR_COMPENSATION_BINDING_REQUIRED";}
assert.equal(forgedBareCauseRejected,true,"Bare universe-conflict error code must fail closed without recovery-owned cause proof.");
const structurallyForgedConflict={code:"MOVIE_MENTOR_PROVIDER_RECOVERY_CREATOR_STATE_UNIVERSE_CONFLICT",creatorStateUniverseConflictAuthority:{domain:"iband.movie-mentor.provider-recovery-creator-state-universe-conflict",schema:1,providerCallId:"call-comp-b",task:"continuity",historicalCreatorStateUniverse:{revision:999,revisionAuthorityReference:"forged:historical",snapshotFingerprint:"forged-historical",snapshotReference:"snapshot:forged-historical",creatorStateGeneration:999,creatorStateFingerprint:"forged-historical",creatorStateAuthorityReference:"forged:historical"},currentCreatorStateUniverse:{revision:1000,revisionAuthorityReference:"forged:current",snapshotFingerprint:"forged-current",snapshotReference:"snapshot:forged-current",creatorStateGeneration:1000,creatorStateFingerprint:"forged-current",creatorStateAuthorityReference:"forged:current"}}};
const structurallyForgedDecision=await multiStore.compensateSupersededCreatorState({execution:multiExecution,recoveryConflict:structurallyForgedConflict,providerEffects:liveSingleConflictProof});
assert.equal(structurallyForgedDecision.authorized,false,"RED: structurally valid but fabricated Creator-state universe conflict proof must not mint Creator Compensation.");console.log("GREEN: Creator Compensation requires proof-bearing superseded Creator-state cause authority, not a forgeable error-code label.");
const genuineHistoricalForgedCurrentConflict={...multiRecoveryConflict,creatorStateUniverseConflictAuthority:{...multiRecoveryConflict.creatorStateUniverseConflictAuthority,currentCreatorStateUniverse:{revision:1000,revisionAuthorityReference:"forged:current",snapshotFingerprint:null,snapshotReference:"snapshot:forged-current",creatorStateGeneration:1000,creatorStateFingerprint:"c".repeat(64),creatorStateAuthorityReference:"forged:current"}}};
const forgedCurrentRows=structuredClone(multiRows);
forgedCurrentRows.movie_mentor_inference_execution.phase="active";
forgedCurrentRows.movie_mentor_inference_execution.compensatedAt=null;
forgedCurrentRows.movie_mentor_inference_execution.compensationReason="";
forgedCurrentRows.movie_mentor_inference_spend_reservation.status="reserved";
forgedCurrentRows.movie_mentor_inference_spend_reservation.releasedAt=null;
forgedCurrentRows.movie_mentor_inference_spend_reservation.settlementReason="";
forgedCurrentRows.movie_mentor_inference_entitlement.remainingUnits=4;
forgedCurrentRows.movie_mentor_inference_entitlement.reservedUnits=1;
const forgedCurrentDb={collection(name){return collectionFor(forgedCurrentRows,name);}};
const forgedCurrentStore=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>physicalSession,db:()=>forgedCurrentDb,now:()=>new Date("2035-01-01T00:00:03.000Z")});
const forgedCurrentDecision=await forgedCurrentStore.compensateSupersededCreatorState({execution:multiExecution,recoveryConflict:genuineHistoricalForgedCurrentConflict,providerEffects:liveSingleConflictProof});
assert.equal(forgedCurrentDecision.authorized,false,"RED: genuine historical recovery provenance plus a fabricated CURRENT Creator-state universe must not mint Creator Compensation.");
console.log("GREEN: Creator Compensation binds both historical recovery provenance and CURRENT Creator-state authority.");




