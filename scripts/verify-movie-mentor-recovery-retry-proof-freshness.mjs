import assert from"node:assert/strict";import{verifyRetryProofFreshness as verify}from"../ai/MovieMentorRecoveryRetryProofFreshnessControl.js";
const h={recoveryEpoch:29,clockEpoch:7,clockSequence:900,provenanceEpoch:14,authorityDecisionReference:"decision-cat1-e29",bindingFingerprint:"a".repeat(64),reference:"retry-proof-hwm-cat1-e29"},proof=o=>({recoveryEpoch:29,clockEpoch:7,clockSequence:900,provenanceEpoch:14,authorityDecisionReference:h.authorityDecisionReference,bindingFingerprint:h.bindingFingerprint,...o});
const good=proof({});let r=verify({transactionAbsenceProof:good,gateAbsenceProof:good,currentHighWatermark:h});assert.equal(r.valid,true);assert.equal(r.fresh,true);
const attacks=[
 ["recovery epoch",{recoveryEpoch:28},"transaction_absence_proof_recovery_epoch_superseded"],
 ["clock epoch",{clockEpoch:6},"transaction_absence_proof_clock_superseded"],
 ["clock sequence",{clockSequence:899},"transaction_absence_proof_clock_superseded"],
 ["provenance epoch",{provenanceEpoch:13},"transaction_absence_proof_provenance_superseded"],
 ["authority decision",{authorityDecisionReference:"decision-cat1-e28"},"transaction_absence_proof_authority_decision_superseded"],
 ["binding",{bindingFingerprint:"b".repeat(64)},"transaction_absence_proof_binding_superseded"]
];
for(const[name,mutation,reason]of attacks){r=verify({transactionAbsenceProof:proof(mutation),gateAbsenceProof:good,currentHighWatermark:h});assert.equal(r.valid,false,name);assert.ok(r.reasons.includes(reason),name)}
for(const[name,mutation]of attacks){r=verify({transactionAbsenceProof:good,gateAbsenceProof:proof(mutation),currentHighWatermark:h});assert.equal(r.valid,false,`gate ${name}`);assert.ok(r.reasons.some(x=>x.startsWith("gate_absence_proof_")),`gate ${name}`)}
// Signed clock can advance within the same recovery/provenance epoch; old proof still expires.
r=verify({transactionAbsenceProof:proof({clockSequence:900}),gateAbsenceProof:proof({clockSequence:900}),currentHighWatermark:{...h,clockSequence:901}});assert.equal(r.valid,false);assert.ok(r.reasons.includes("transaction_absence_proof_clock_superseded"));assert.ok(r.reasons.includes("gate_absence_proof_clock_superseded"));
// Provenance rotation can supersede proofs without changing recovery epoch.
r=verify({transactionAbsenceProof:good,gateAbsenceProof:good,currentHighWatermark:{...h,provenanceEpoch:15}});assert.equal(r.valid,false);assert.ok(r.reasons.includes("transaction_absence_proof_provenance_superseded"));
console.log("PROOF FRESHNESS TORTURE PASSED: identity-correct absence proofs expire on recovery epoch, signed-clock epoch/sequence, provenance epoch, Authority decision or canonical binding supersession. The right golden ticket can expire.");