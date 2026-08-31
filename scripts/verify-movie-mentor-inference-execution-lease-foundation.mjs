import assert from "node:assert/strict";
import { createMovieMentorInferenceExecutionLeaseAuthority } from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";

let clock = new Date("2030-01-01T00:00:00.000Z");
let durable = null;
let id = 0;
let loseCreateAck = false;
let loseReplaceAck = false;
const clone = (value) => value ? structuredClone(value) : null;

const store = {
  async readExecution(executionId) { return durable && durable.executionId === executionId ? clone(durable) : null; },
  async readExecutionByCreatorTurn({ principalId, projectId, creatorTurnId } = {}) {
    return durable && durable.principalId === principalId && durable.projectId === projectId && durable.creatorTurnId === creatorTurnId ? clone(durable) : null;
  },
  async createExecution(next) {
    if (durable) return null;
    durable = clone(next);
    if (loseCreateAck) { loseCreateAck = false; throw Object.assign(new Error("create ACK lost"), { code: "ACK_LOST" }); }
    return clone(durable);
  },
  async replaceExecution(next, expected = {}) {
    if (!durable || durable.executionId !== next.executionId || durable.phase !== expected.expectedPhase || durable.leaseGeneration !== expected.expectedLeaseGeneration || durable.leaseReference !== expected.expectedLeaseReference) return null;
    if (expected.expectedLeaseExpiresAt && durable.leaseExpiresAt !== expected.expectedLeaseExpiresAt) return null;
    durable = clone(next);
    if (loseReplaceAck) { loseReplaceAck = false; throw Object.assign(new Error("replace ACK lost"), { code: "ACK_LOST" }); }
    return clone(durable);
  },
  async claimProviderCall() {
    throw new Error("Round One lease-foundation torture must not exercise provider-call admission.");
  },
};

const authority = createMovieMentorInferenceExecutionLeaseAuthority({ store, now: () => new Date(clock), leaseMs: 1000, maxProviderCalls: 5, randomId: () => `id-${++id}` });
const base = { creatorTurnId: "turn-1", principalId: "creator-1", projectId: "project-1", reservationId: "reservation-1", requestDigest: "sha256:req-1", ownerId: "worker-A" };

console.log("5A.24 Round One — durable execution identity + lease + fencing torture");

loseCreateAck = true;
const opened = await authority.openExecution(base);
assert.equal(opened.authorized, true);
assert.equal(opened.executionAuthorized, true);
assert.equal(opened.leaseGeneration, 1);
assert.equal(opened.reconciledAckLoss, true);
assert.equal(opened.maxProviderCalls, 5);

const replay = await authority.openExecution(base);
assert.equal(replay.authorized, true);
assert.equal(replay.executionAuthorized, true);
assert.equal(replay.executionId, opened.executionId);
assert.equal(replay.idempotent, true);

await assert.rejects(() => authority.openExecution({ ...base, requestDigest: "sha256:changed" }), (error) => error?.code === "MOVIE_MENTOR_INFERENCE_EXECUTION_TURN_IDENTITY_CONFLICT");

const blocked = await authority.acquireExecution({ executionId: opened.executionId, ownerId: "worker-B" });
assert.equal(blocked.authorized, false);
assert.equal(blocked.reason, "execution-lease-held-by-another-owner");

const liveA = await authority.assertFence(opened);
assert.equal(liveA.authorized, true);
assert.equal(liveA.executionAuthorized, true);

clock = new Date(clock.getTime() + 1001);
loseReplaceAck = true;
const takeover = await authority.acquireExecution({ executionId: opened.executionId, ownerId: "worker-B" });
assert.equal(takeover.authorized, true);
assert.equal(takeover.executionAuthorized, true);
assert.equal(takeover.leaseGeneration, 2);
assert.equal(takeover.reconciledAckLoss, true);
assert.notEqual(takeover.leaseReference, opened.leaseReference);
assert.notEqual(takeover.fencingToken, opened.fencingToken);

const zombieA = await authority.assertFence(opened);
assert.equal(zombieA.authorized, false);

const currentB = await authority.assertFence(takeover);
assert.equal(currentB.authorized, true);
assert.equal(currentB.executionAuthorized, true);

loseReplaceAck = true;
const renewed = await authority.renewExecution(takeover);
assert.equal(renewed.authorized, true);
assert.equal(renewed.executionAuthorized, true);
assert.equal(renewed.leaseGeneration, 2);
assert.equal(renewed.reconciledAckLoss, true);
assert.equal(renewed.fencingToken, takeover.fencingToken);

const afterRenew = await authority.assertFence(renewed);
assert.equal(afterRenew.authorized, true);
assert.equal(afterRenew.executionAuthorized, true);

// ROUND SEVEN: a creator-turn record may remain durable history after revocation, but openExecution may not
// reinterpret that history as a retryable lease-recovery universe.
const activeSnapshot = clone(durable);
durable = { ...clone(activeSnapshot), phase: "quarantined", quarantinedFromPhase: "settled", quarantineReason: "late-provider-effect-conflict" };
const foundQuarantine = await authority.findExecutionByCreatorTurn({creatorTurnId:base.creatorTurnId,principalId:base.principalId,projectId:base.projectId,requestDigest:base.requestDigest});
assert.equal(foundQuarantine.found,true);
assert.equal(foundQuarantine.authorized,true,"lookup may report a valid durable record");
assert.equal(foundQuarantine.executionAuthorized,false,"historical record existence is never forward execution authority");
await assert.rejects(()=>authority.openExecution(base),error=>error?.code==="MOVIE_MENTOR_INFERENCE_EXECUTION_QUARANTINED"&&error?.retryable===false&&error?.quarantinedFromPhase==="settled"&&error?.reason==="late-provider-effect-conflict");
const quarantinedAcquire=await authority.acquireExecution({executionId:opened.executionId,ownerId:"worker-C"});
assert.equal(quarantinedAcquire.authorized,false);
assert.equal(quarantinedAcquire.reason,"execution-not-active");
assert.equal(quarantinedAcquire.phase,"quarantined");

durable = { ...clone(activeSnapshot), phase: "aborted", abortReason: "unclaimed-reservation-released" };
await assert.rejects(()=>authority.openExecution(base),error=>error?.code==="MOVIE_MENTOR_INFERENCE_EXECUTION_ABORTED"&&error?.retryable===false&&error?.reason==="unclaimed-reservation-released");

// A create race that discovers an already-revoked same-turn record must preserve the same exact revocation,
// not downgrade into generic create-race recovery.
let raceRecord = null;
const raceStore = {
  async readExecution(){return null;},
  async readExecutionByCreatorTurn(){return clone(raceRecord);},
  async createExecution(next){raceRecord={...clone(next),executionId:"execution-race-winner",phase:"quarantined",quarantinedFromPhase:"settled",quarantineReason:"race-revoked"};throw Object.assign(new Error("duplicate creator turn"),{code:11000});},
  async replaceExecution(){throw new Error("revoked race must never replace execution");},
  async claimProviderCall(){throw new Error("revoked race must never claim provider call");},
};
const raceAuthority=createMovieMentorInferenceExecutionLeaseAuthority({store:raceStore,now:()=>new Date("2030-01-01T00:00:00.000Z"),randomId:()=>"race-id"});
await assert.rejects(()=>raceAuthority.openExecution({...base,creatorTurnId:"turn-race"}),error=>error?.code==="MOVIE_MENTOR_INFERENCE_EXECUTION_QUARANTINED"&&error?.retryable===false&&error?.quarantinedFromPhase==="settled"&&error?.reason==="race-revoked");

const emptyStore={readExecution:async()=>null,readExecutionByCreatorTurn:async()=>null,createExecution:async()=>{throw new Error("invalid clock must fail before durable create");},replaceExecution:async()=>null,claimProviderCall:async()=>null};
const invalidClockAuthority=createMovieMentorInferenceExecutionLeaseAuthority({store:emptyStore,now:()=>null});
await assert.rejects(()=>invalidClockAuthority.openExecution({...base,creatorTurnId:"turn-null-clock"}),error=>error?.code==="MOVIE_MENTOR_INFERENCE_EXECUTION_TIME_INVALID");

console.log("✓ creatorTurnId replay converges on one durable execution identity");
console.log("✓ changed immutable binding under the same creatorTurnId conflicts");
console.log("✓ live lease rejects competing execution owner");
console.log("✓ expired lease takeover advances generation exactly once");
console.log("✓ takeover mints fresh lease reference + fencing token");
console.log("✓ stale/zombie owner loses all forward execution authority");
console.log("✓ create/takeover/renew ACK loss reconciles from durable reality");
console.log("✓ QUARANTINED and ABORTED history cannot be reopened as live/retryable execution authority");
console.log("✓ creator-turn create races preserve exact non-retryable quarantine revocation");
console.log("✓ historical lookup evidence exposes executionAuthorized=false even when the durable record itself is valid");
console.log("✓ absent lease clock cannot manufacture Unix-epoch execution proof");
console.log("✓ Round One fake store satisfies the later claim-store constructor contract without exercising claim authority");
console.log("LAW: durable execution reality outranks process memory");
console.log("LAW: EXISTENCE IS HISTORY. FORWARD AUTHORITY REQUIRES A CURRENT ACTIVE LEASE.");
console.log("LAW: stale owner -> zero forward authority");
console.log("5A.24 Round One foundation torture: GREEN");
