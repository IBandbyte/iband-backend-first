import assert from"node:assert/strict";import{verifyRetryProofFreshness as verify}from"../ai/MovieMentorRecoveryRetryProofFreshnessControl.js";
const DOMAIN="iband.movie-mentor.recovery-authority.binding",SCHEMA=2,REALITY_DOMAIN="iband.movie-mentor.operations.reconciliation-recovery-reality",PURPLE="purple.universe.zorg.clipboard";
const h={recoveryEpoch:29,clockEpoch:7,clockSequence:900,provenanceEpoch:14,authorityDecisionReference:"decision-cat1-e29",bindingFingerprintDomain:DOMAIN,bindingFingerprintSchema:SCHEMA,bindingFingerprint:"a".repeat(64),reference:"retry-proof-hwm-cat1-e29",verificationReference:"verify:retry-proof-hwm-cat1-e29"},proof=o=>({recoveryEpoch:29,clockEpoch:7,clockSequence:900,provenanceEpoch:14,authorityDecisionReference:h.authorityDecisionReference,bindingFingerprintDomain:h.bindingFingerprintDomain,bindingFingerprintSchema:h.bindingFingerprintSchema,bindingFingerprint:h.bindingFingerprint,freshnessSnapshotReference:h.reference,freshnessVerificationReference:h.verificationReference,...o});
const good=proof({});let r=verify({transactionAbsenceProof:good,gateAbsenceProof:good,currentHighWatermark:h});assert.equal(r.valid,true);assert.equal(r.fresh,true);assert.equal(r.highWatermarkReference,h.reference);assert.equal(r.verificationReference,h.verificationReference);assert.equal(r.bindingFingerprintDomain,DOMAIN);assert.equal(r.bindingFingerprintSchema,SCHEMA);assert.equal(r.bindingFingerprint,h.bindingFingerprint);
const attacks=[
 ["recovery epoch",{recoveryEpoch:28},"transaction_absence_proof_recovery_epoch_superseded"],
 ["clock epoch",{clockEpoch:6},"transaction_absence_proof_clock_superseded"],
 ["clock sequence",{clockSequence:899},"transaction_absence_proof_clock_superseded"],
 ["provenance epoch",{provenanceEpoch:13},"transaction_absence_proof_provenance_superseded"],
 ["authority decision",{authorityDecisionReference:"decision-cat1-e28"},"transaction_absence_proof_authority_decision_superseded"],
 ["binding",{bindingFingerprint:"b".repeat(64)},"transaction_absence_proof_binding_superseded"],
 ["snapshot",{freshnessSnapshotReference:"snapshot-B"},"transaction_absence_proof_freshness_snapshot_mismatch"],
 ["verification",{freshnessVerificationReference:"verify-B"},"transaction_absence_proof_freshness_verification_mismatch"]
];
for(const[name,mutation,reason]of attacks){r=verify({transactionAbsenceProof:proof(mutation),gateAbsenceProof:good,currentHighWatermark:h});assert.equal(r.valid,false,name);assert.ok(r.reasons.includes(reason),name)}
for(const[name,mutation]of attacks){r=verify({transactionAbsenceProof:good,gateAbsenceProof:proof(mutation),currentHighWatermark:h});assert.equal(r.valid,false,`gate ${name}`);assert.ok(r.reasons.some(x=>x.startsWith("gate_absence_proof_")),`gate ${name}`)}
// Authority-v2 protocol attacks: a matching shiny hash is never enough.
const envelopeAttacks=[
 ["legacy domain stripped",{bindingFingerprintDomain:undefined},"authority_envelope_invalid"],
 ["legacy schema stripped",{bindingFingerprintSchema:undefined},"authority_envelope_invalid"],
 ["Purple Universe",{bindingFingerprintDomain:PURPLE},"authority_envelope_invalid"],
 ["wrong schema",{bindingFingerprintSchema:3},"authority_envelope_invalid"],
 ["Recovery Reality substitution",{bindingFingerprintDomain:REALITY_DOMAIN},"authority_envelope_invalid"]
];
for(const[name,mutation,reason]of envelopeAttacks){r=verify({transactionAbsenceProof:proof(mutation),gateAbsenceProof:good,currentHighWatermark:h});assert.equal(r.valid,false,name);assert.ok(r.reasons.some(x=>x.includes(reason)),name)}
// The current HWM itself cannot be a legacy/cross-protocol clipboard even when both proofs are canonical.
for(const[name,mutation]of envelopeAttacks){r=verify({transactionAbsenceProof:good,gateAbsenceProof:good,currentHighWatermark:{...h,...mutation}});assert.equal(r.valid,false,`HWM ${name}`);assert.ok(r.reasons.includes("current_high_watermark_authority_envelope_invalid"),`HWM ${name}`)}
// Mixed transaction/gate Authority envelopes are independently fatal, not merely caught through HWM comparison.
r=verify({transactionAbsenceProof:good,gateAbsenceProof:proof({bindingFingerprintDomain:PURPLE}),currentHighWatermark:h});assert.equal(r.valid,false);assert.ok(r.reasons.includes("absence_proofs_authority_domain_diverged"));r=verify({transactionAbsenceProof:good,gateAbsenceProof:proof({bindingFingerprintSchema:3}),currentHighWatermark:h});assert.equal(r.valid,false);assert.ok(r.reasons.includes("absence_proofs_authority_schema_diverged"));r=verify({transactionAbsenceProof:good,gateAbsenceProof:proof({bindingFingerprint:"b".repeat(64)}),currentHighWatermark:h});assert.equal(r.valid,false);assert.ok(r.reasons.includes("absence_proofs_authority_fingerprint_diverged"));
// Signed clock can advance within the same recovery/provenance epoch; old proof still expires even though its snapshot lineage remains internally self-consistent.
r=verify({transactionAbsenceProof:good,gateAbsenceProof:good,currentHighWatermark:{...h,clockSequence:901}});assert.equal(r.valid,false);assert.ok(r.reasons.includes("transaction_absence_proof_clock_superseded"));assert.ok(r.reasons.includes("gate_absence_proof_clock_superseded"));
// Provenance rotation can supersede proofs without changing recovery epoch.
r=verify({transactionAbsenceProof:good,gateAbsenceProof:good,currentHighWatermark:{...h,provenanceEpoch:15}});assert.equal(r.valid,false);assert.ok(r.reasons.includes("transaction_absence_proof_provenance_superseded"));
// Two proofs may each contain otherwise valid freshness values yet belong to different certified snapshots. Divergent lineage is independently fatal.
r=verify({transactionAbsenceProof:good,gateAbsenceProof:proof({freshnessSnapshotReference:"snapshot-B",freshnessVerificationReference:"verify-B"}),currentHighWatermark:h});assert.equal(r.valid,false);assert.ok(r.reasons.includes("absence_proofs_freshness_snapshot_diverged"));assert.ok(r.reasons.includes("absence_proofs_freshness_verification_diverged"));
// Internally valid alternate snapshot B cannot replace A after proofs were minted from A.
const b={...h,reference:"snapshot-B",verificationReference:"verify-B"};r=verify({transactionAbsenceProof:good,gateAbsenceProof:good,currentHighWatermark:b});assert.equal(r.valid,false);assert.ok(r.reasons.includes("transaction_absence_proof_freshness_snapshot_mismatch"));assert.ok(r.reasons.includes("gate_absence_proof_freshness_snapshot_mismatch"));
console.log("PROOF FRESHNESS v1.2 AUTHORITY-v2 TORTURE PASSED: the golden ticket now requires canonical domain/schema/fingerprint across HWM and both absence proofs; legacy, Purple Universe, wrong-schema, Recovery Reality and mixed-envelope substitutions are shredded.");
