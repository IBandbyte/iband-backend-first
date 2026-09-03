import assert from "node:assert/strict";
import {
  createMovieMentorProductionInferenceExecutionComposition,
  isMovieMentorProductionInferenceExecutionOwnerProof,
} from "../ai/MovieMentorProductionInferenceExecutionComposition.js";

const noop = async () => null;

const executionStoreStatus = Object.freeze({
  configured: true,
  readiness: "injected-proven",
  durable: true,
  cas: "reservation-binding-active-closure-frozen-universe-provider-reality-revision-finalized-result-binding-and-atomic-abort",
});
const effectStoreStatus = Object.freeze({
  configured: true,
  readiness: "injected-proven",
  cas: "revision",
  crossLedgerSerialization: "execution-providerEffectRealityRevision",
});
const resultStoreStatus = Object.freeze({
  configured: true,
  readiness: "injected-proven",
  candidateLineage: "revalidated-in-finalization-transaction",
  resultFinalization: "atomic-result-insert-plus-closed-to-finalized-execution-transition",
  finalizationFreshnessFence: "exact-provider-effect-reality-revision",
});
const candidateStoreStatus = Object.freeze({
  configured: true,
  readiness: "injected-proven",
  authority: "zero-until-current-closure-and-canonical-finalization",
  atomicFence: "shared-execution-write-barrier-before-closure",
});

// These are deliberately convincing impostors. They advertise the same status strings and
// method shapes as the durable production stores, but own no production durability proof.
const fakeExecutionStore = Object.freeze({
  getStatus: () => executionStoreStatus,
  readExecution: noop,
  readExecutionByCreatorTurn: noop,
  createExecution: noop,
  replaceExecution: noop,
  claimProviderCall: async () => ({ claimed: false }),
  beginClosing: noop,
  recoverExpiredIntoClosing: noop,
  completeClosing: noop,
  quarantineExecution: noop,
});
const fakeEffectStore = Object.freeze({
  getStatus: () => effectStoreStatus,
  readEffect: noop,
  readEffectsByExecution: async () => [],
  beginUnknown: async (binding) => ({ ...binding, state: "unknown", evidence: [] }),
  appendEvidence: noop,
});
const fakeResultStore = Object.freeze({
  getStatus: () => resultStoreStatus,
  commit: noop,
  readByExecution: noop,
  readByCreatorTurn: noop,
});
const fakeCandidateStore = Object.freeze({
  getStatus: () => candidateStoreStatus,
  stageCandidate: noop,
  readByExecution: noop,
});

console.log("Gates of Execution — Durable Store Provenance / No Proof Teleportation torture");

const composition = createMovieMentorProductionInferenceExecutionComposition({
  store: fakeExecutionStore,
  effectStore: fakeEffectStore,
  resultStore: fakeResultStore,
  candidateStore: fakeCandidateStore,
});

const status = composition?.getStatus?.() || null;

assert.equal(
  composition?.ready,
  false,
  "self-attested injected store lookalikes must not create a production-ready execution composition",
);
assert.equal(
  status && isMovieMentorProductionInferenceExecutionOwnerProof(composition, status),
  false,
  "composition owner proof must not launder unowned store capability claims into production authority",
);
assert.notEqual(
  composition?.fullExecutionAuthority,
  true,
  "unowned injected stores must receive zero full execution authority",
);

console.log("✓ matching capability strings do not prove durable store provenance");
console.log("✓ matching method shapes do not prove durable store provenance");
console.log("✓ injected lookalikes cannot mint execution composition owner proof");
console.log("LAW: DURABLE STORE OWNER PROOF → EXECUTION COMPOSITION OWNER PROOF → EFFECT REALITY → IRREVERSIBLE PROVIDER EFFECT");
console.log('🐔 Zorg: "But every status string matches." 🐙 Kraken: "STATUS STRINGS ARE NOT A DEED TO THE DATABASE."');
console.log("Gates of Execution — No Proof Teleportation: GREEN");
