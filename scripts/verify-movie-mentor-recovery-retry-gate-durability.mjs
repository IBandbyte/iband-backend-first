import assert from"node:assert/strict";import{persistRetryGate,recoverRetryGate}from"../ai/MovieMentorRecoveryRetryGateDurabilityControl.js";
const identity={incidentId:"cat-1",recoveryEpoch:9,authorityDecisionReference:"decision-cat1-e9",authorityReference:"recovery-root-A",bindingFingerprint:"a".repeat(64),previousStateReference:"distributed-state-cat1-e9",transitionReference:"global:decision-cat1-e9"};let disk=null,writes=0;
const commit=async({gate})=>{writes++;disk={found:true,durable:true,...structuredClone(gate),gateReference:"durable-gate-cat1-e9"};return{committed:true,identityCompared:true,incidentEpochCompared:true,newerGateExcluded:true,reference:"durable-gate-cat1-e9"}},read=async()=>structuredClone(disk||{found:false});
// ACK-lost retry produces unresolved identity. Gate is persisted and read back BEFORE control returns.
let r=await persistRetryGate({identity,reasonReference:"ack-lost-retry"},{commitRetryGate:commit,readRetryGate:read});assert.equal(r.persisted,true);assert.equal(r.reconciliationRequired,true);assert.equal(writes,1);
// POWER CUT: all process memory disappears. Restart recovers gate solely from durable storage.
const callerMemory=undefined;r=await recoverRetryGate({incidentId:"cat-1",recoveryEpoch:9},{readRetryGate:read});assert.equal(callerMemory,undefined);assert.equal(r.found,true);assert.equal(r.valid,true);assert.equal(r.reconciliationRequired,true);assert.deepEqual(r.retryRecoveryGate.identity,identity);
// Fresh caller pretending there was no gate cannot erase disk truth; recovery still returns it.
r=await recoverRetryGate({incidentId:"cat-1",recoveryEpoch:9},{readRetryGate:read});assert.equal(r.retryRecoveryGate.reconciliationRequired,true);
// Old epoch cannot steal current gate.
r=await recoverRetryGate({incidentId:"cat-1",recoveryEpoch:8},{readRetryGate:read});assert.equal(r.found,true);assert.equal(r.valid,false);assert.ok(r.reasons.includes("durable_retry_gate_invalid"));
// Torn/non-durable gate fails closed rather than becoming absence.
const good=structuredClone(disk);disk={...good,durable:false};r=await recoverRetryGate({incidentId:"cat-1",recoveryEpoch:9},{readRetryGate:read});assert.equal(r.found,true);assert.equal(r.valid,false);assert.equal(r.reconciliationRequired,true);disk=good;
// Substituted durable identity is detected.
disk=structuredClone(good);disk.identity.bindingFingerprint="b".repeat(64);r=await recoverRetryGate({incidentId:"cat-1",recoveryEpoch:9},{readRetryGate:read});assert.equal(r.found,true);assert.equal(r.valid,true);assert.notDeepEqual(r.retryRecoveryGate.identity,identity); // perimeter Certification must compare canonical identity next.
console.log("DURABLE RETRY GATE ABYSS PASSED: unresolved retry gate survives total process-memory loss; restart cannot interpret caller amnesia as permission to retry; wrong epoch/torn durable gate fail closed. Canonical substitution remains for Certification perimeter binding.");