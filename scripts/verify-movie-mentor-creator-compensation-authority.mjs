import assert from "node:assert/strict";
import { createMovieMentorInferenceSettlementReconciliationAuthority } from "../ai/MovieMentorInferenceSettlementReconciliationAuthority.js";

console.log("Movie Mentor Creator Compensation authority court");

const execution = Object.freeze({
  executionId:"execution-comp-1", creatorTurnId:"turn-comp-1", principalId:"creator-comp-1",
  projectId:"project-comp-1", reservationId:"reservation-comp-1", phase:"active",
  providerCallsClaimed:1, providerCalls:[Object.freeze({providerCallId:"call-comp-1",slotId:"semantic",task:"semantic"})],
});
const confirmedEffect = Object.freeze({
  providerCallId:"call-comp-1", executionId:"execution-comp-1", slotId:"semantic", task:"semantic",
  state:"confirmed", revision:2,
  evidence:[Object.freeze({externalEffectId:"provider-effect-comp-1",provider:"test-provider",observedAt:"2035-01-01T00:00:01.000Z",source:"provider-ack"})],
});
const reservation = {reservationId:"reservation-comp-1",principalId:"creator-comp-1",projectId:"project-comp-1",status:"reserved",units:1};
const entitlement = {remainingUnits:4,reservedUnits:1,consumedUnits:0};
const recoveryConflict = Object.freeze({
  code:"MOVIE_MENTOR_PROVIDER_RECOVERY_CREATOR_STATE_UNIVERSE_CONFLICT",
  historicalCreatorState:Object.freeze({revision:7,generation:7,fingerprint:"a".repeat(64),snapshotReference:"snapshot:7"}),
  currentCreatorState:Object.freeze({revision:8,generation:8,fingerprint:"b".repeat(64),snapshotReference:"snapshot:8"}),
});

let compensationWrites=0;
const store={
  settleCanonicalResult:async()=>({authorized:false,settled:false,outcome:"reserved",reason:"execution-not-finalized",executionId:execution.executionId,reservationId:reservation.reservationId}),
  releaseUnclaimedReservation:async()=>({authorized:false,released:false,outcome:"reserved",reason:"provider-call-claims-exist",executionId:execution.executionId,reservationId:reservation.reservationId,providerCallsClaimed:1}),
  releaseUnboundReservation:async()=>({authorized:false,released:false,outcome:"reserved",reason:"reservation-already-bound-to-execution",executionId:execution.executionId,reservationId:reservation.reservationId}),
};

const authority=createMovieMentorInferenceSettlementReconciliationAuthority({store});
const held=await authority.releaseUnclaimed({executionId:execution.executionId});
assert.equal(held.authorized,false);
assert.equal(held.reason,"provider-call-claims-exist");
assert.equal(reservation.status,"reserved");
assert.deepEqual(entitlement,{remainingUnits:4,reservedUnits:1,consumedUnits:0});

assert.equal(typeof authority.compensateSupersededCreatorState,"function",
  "RED: current settlement authority has no exact-once Creator Compensation disposition for CONFIRMED provider work made unusable solely by a superseded Creator-state universe");

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
