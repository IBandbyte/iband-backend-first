import assert from"node:assert/strict";
import{evaluateLeaseAuthorityQuorum,degradedOperationsPolicy}from"../ai/MovieMentorOperationsLeaseAuthorityQuorumControl.js";
import{evaluateAuthorityReentry}from"../ai/MovieMentorOperationsAuthorityReentryGate.js";
import{createRecoveryEpoch,evaluateStableReentry,invalidatePreparedOperation}from"../ai/MovieMentorOperationsRecoveryStabilityControl.js";
import{createLeaseRequest,acquireReconciliationLease,verifyActiveReconciliationLease,evaluateFailoverTakeover}from"../ai/MovieMentorOperationsReconciliationLeaseControl.js";

const incident={incidentId:"cat-1",effectId:"provider-effect-1",scopeFingerprint:"creator-project-77"};
const authorityHealthy={totalVotingMembers:5,reachableVotingMembers:3,singleLeaderConfirmed:true,termConsistent:true,authorityTerm:21,fencingHighWatermark:80,writeAuthority:true,reference:"authority-21"};
let q=await evaluateLeaseAuthorityQuorum(incident,{inspectAuthority:async()=>({...authorityHealthy,reachableVotingMembers:2,singleLeaderConfirmed:false,writeAuthority:false})});
assert.equal(q.authoritative,false);const degraded=degradedOperationsPolicy(q);assert.equal(degraded.highImpactMutation,false);assert.equal(degraded.creatorPreservation,true);assert.equal(degraded.diagnostics,true);

const oldEpoch=createRecoveryEpoch({incidentId:"cat-1",scopeFingerprint:"creator-project-77",epoch:8,authorityTerm:20,fencingHighWatermark:79,startedAt:"2026-08-24T13:00:00Z",stableAfterMs:15000});
assert.equal(invalidatePreparedOperation({preparedEpoch:8,currentEpoch:9}).valid,false);

const oldLeaseReq=createLeaseRequest({...incident,ownerRuntimeId:"dead-worker",ownerRegion:"eu-west",requestedAt:"2026-08-24T13:00:00Z",leaseDurationMs:30000});
const oldLease=(await acquireReconciliationLease(oldLeaseReq,{leaseStore:{acquire:async()=>({acquired:true,leaseId:"old-lease",fencingToken:79,issuedAt:"2026-08-24T13:00:00Z",expiresAt:"2026-08-24T13:00:30Z",reference:"old-store"})}})).lease;
assert.equal((await verifyActiveReconciliationLease(oldLease,{...incident,ownerRuntimeId:"dead-worker",ownerRegion:"eu-west"},{now:Date.parse("2026-08-24T13:01:00Z"),verifyLease:async()=>({active:false,currentFencingToken:80,reference:"superseded"})})).valid,false);

let reentry=await evaluateAuthorityReentry({...incident,previousAuthorityTerm:20,previousFencingHighWatermark:79},{inspectConvergence:async()=>({quorumRestored:true,singleLeaderConfirmed:true,termConverged:true,authorityTerm:21,fencingConverged:true,fencingHighWatermark:80,ledgerConverged:true,unresolvedMinorityEffects:0,indeterminateEffects:1,creatorCustodyVerified:true,writeAuthority:true,reference:"not-yet"})});
assert.equal(reentry.reentryAllowed,false);
reentry=await evaluateAuthorityReentry({...incident,previousAuthorityTerm:20,previousFencingHighWatermark:79},{inspectConvergence:async()=>({quorumRestored:true,singleLeaderConfirmed:true,termConverged:true,authorityTerm:21,fencingConverged:true,fencingHighWatermark:80,ledgerConverged:true,unresolvedMinorityEffects:0,indeterminateEffects:0,creatorCustodyVerified:true,writeAuthority:true,reference:"reconciled"})});
assert.equal(reentry.reentryAllowed,true);

const epoch=createRecoveryEpoch({incidentId:"cat-1",scopeFingerprint:"creator-project-77",epoch:9,authorityTerm:21,fencingHighWatermark:80,startedAt:"2026-08-24T13:02:00Z",stableAfterMs:15000});
let stable=await evaluateStableReentry(epoch,{incidentId:"cat-1",scopeFingerprint:"creator-project-77",epoch:9,authorityTerm:21,fencingHighWatermark:80},{now:Date.parse("2026-08-24T13:02:20Z"),inspectStability:async()=>({continuousQuorum:true,continuousSingleLeader:true,termUnchanged:true,fencingNonRegressed:true,noNewPartitionSignals:false,noNewIndeterminateEffects:true,reentryEpochCurrent:true,reference:"flap"})});
assert.equal(stable.stable,false);
stable=await evaluateStableReentry(epoch,{incidentId:"cat-1",scopeFingerprint:"creator-project-77",epoch:9,authorityTerm:21,fencingHighWatermark:80},{now:Date.parse("2026-08-24T13:02:40Z"),inspectStability:async()=>({continuousQuorum:true,continuousSingleLeader:true,termUnchanged:true,fencingNonRegressed:true,noNewPartitionSignals:true,noNewIndeterminateEffects:true,reentryEpochCurrent:true,reference:"stable"})});
assert.equal(stable.stable,true);

const candidate=createLeaseRequest({...incident,ownerRuntimeId:"replacement-worker",ownerRegion:"ap-southeast",requestedAt:"2026-08-24T13:02:40Z",leaseDurationMs:30000});
const takeover=await evaluateFailoverTakeover({previousLease:oldLease,candidateRequest:candidate},{trustedNow:Date.parse("2026-08-24T13:02:40Z"),leaseStore:{inspect:async()=>({active:false,takeoverSafe:true,lastFencingToken:80,authoritativeNow:Date.parse("2026-08-24T13:02:40Z"),reference:"takeover-safe"})}});
assert.equal(takeover.allowed,true);assert.equal(takeover.minimumNextFencingToken,81);
const newLease=(await acquireReconciliationLease(candidate,{leaseStore:{acquire:async()=>({acquired:true,leaseId:"new-lease",fencingToken:81,issuedAt:"2026-08-24T13:02:40Z",expiresAt:"2026-08-24T13:03:10Z",reference:"new-store"})}})).lease;
assert.equal((await verifyActiveReconciliationLease(newLease,{...incident,ownerRuntimeId:"replacement-worker",ownerRegion:"ap-southeast"},{now:Date.parse("2026-08-24T13:02:45Z"),verifyLease:async()=>({active:true,currentFencingToken:81,currentLeaseId:"new-lease",currentOwnerRuntimeId:"replacement-worker",currentOwnerRegion:"ap-southeast",reference:"new-proof"})})).valid,true);
assert.equal((await verifyActiveReconciliationLease(oldLease,{...incident,ownerRuntimeId:"dead-worker",ownerRegion:"eu-west"},{now:Date.parse("2026-08-24T13:00:10Z"),verifyLease:async()=>({active:true,currentFencingToken:81,currentLeaseId:"new-lease",currentOwnerRuntimeId:"replacement-worker",currentOwnerRegion:"ap-southeast",reference:"newer-owner"})})).valid,false);
console.log("Movie Mentor Operations full catastrophe simulation passed: degradation froze mutation, creator preservation remained available, stale epoch/worker were rejected, indeterminate effects blocked re-entry, flapping blocked stability, and fenced regional takeover required token 81.");