import assert from"node:assert/strict";import{retryFinalRecovery}from"../ai/MovieMentorRecoveryFinalizationRetryControl.js";
const identity={incidentId:"cat-1",recoveryEpoch:29,authorityDecisionReference:"decision-cat1-e29",authorityReference:"recovery-root-B",bindingFingerprint:"a".repeat(64),previousStateReference:"distributed-state-cat1-e29",transitionReference:"global:decision-cat1-e29"};
const tx=(o={})=>({valid:true,safeToRetry:true,retryMustUseSameIdentity:true,reference:"tx-absence-current",incidentId:identity.incidentId,recoveryEpoch:identity.recoveryEpoch,authorityDecisionReference:identity.authorityDecisionReference,bindingFingerprint:identity.bindingFingerprint,...o});
const gate=(o={})=>({valid:true,absent:true,authoritative:true,quorum:true,reference:"gate-absence-current",incidentId:identity.incidentId,recoveryEpoch:identity.recoveryEpoch,authorityDecisionReference:identity.authorityDecisionReference,bindingFingerprint:identity.bindingFingerprint,...o});
async function deny(absenceProof,gateAbsenceProof,reason){let attempts=0;const r=await retryFinalRecovery({originalIdentity:identity,retryIdentity:structuredClone(identity),absenceProof,gateAbsenceProof},{commitFinalRecoveryRetry:async()=>{attempts++;throw new Error("RECYCLED PROOF MUST NEVER REACH CAS")},readFinalRecoveryByIdentity:async()=>{throw new Error("NO READBACK")}});assert.equal(r.retried,false);assert.ok(r.reasons.includes(reason),`${reason}:${r.reasons}`);assert.equal(attempts,0)}
// Genuine transaction proof stolen from another recovery reality.
await deny(tx({incidentId:"cat-2"}),gate(),"transaction_absence_proof_identity_mismatch");
await deny(tx({recoveryEpoch:28}),gate(),"transaction_absence_proof_identity_mismatch");
await deny(tx({authorityDecisionReference:"decision-cat1-e28"}),gate(),"transaction_absence_proof_identity_mismatch");
await deny(tx({bindingFingerprint:"b".repeat(64)}),gate(),"transaction_absence_proof_identity_mismatch");
// Genuine gate proof stolen from another recovery reality.
await deny(tx(),gate({incidentId:"cat-2"}),"gate_absence_proof_identity_mismatch");
await deny(tx(),gate({recoveryEpoch:28}),"gate_absence_proof_identity_mismatch");
await deny(tx(),gate({authorityDecisionReference:"decision-cat1-e28"}),"gate_absence_proof_identity_mismatch");
await deny(tx(),gate({bindingFingerprint:"b".repeat(64)}),"gate_absence_proof_identity_mismatch");
// MIX-AND-MATCH: each proof can be internally genuine yet belong to different recoveries. Neither combination gains authority.
await deny(tx({recoveryEpoch:28,reference:"tx-genuine-e28"}),gate(),"transaction_absence_proof_identity_mismatch");
await deny(tx(),gate({recoveryEpoch:28,reference:"gate-genuine-e28"}),"gate_absence_proof_identity_mismatch");
await deny(tx({incidentId:"cat-2",reference:"tx-genuine-cat2"}),gate({incidentId:"cat-3",reference:"gate-genuine-cat3"}),"transaction_absence_proof_identity_mismatch");
// Authority-root alone is not part of the proof binding contract; the decision+digest bind its canonical consequence. Identity itself still cannot drift.
let attempts=0;let r=await retryFinalRecovery({originalIdentity:identity,retryIdentity:{...identity,authorityReference:"recovery-root-evil"},absenceProof:tx(),gateAbsenceProof:gate()},{commitFinalRecoveryRetry:async()=>{attempts++},readFinalRecoveryByIdentity:async()=>({})});assert.equal(r.retried,false);assert.ok(r.reasons.includes("final_retry_identity_drift_denied"));assert.equal(attempts,0);
console.log("PROOF RECYCLING BIN PASSED: genuine absence proofs from another incident, epoch, Authority decision or canonical digest—and mixed proofs from different recoveries—are non-transferable. Every recycled combination dies before CAS; attempts=0.");