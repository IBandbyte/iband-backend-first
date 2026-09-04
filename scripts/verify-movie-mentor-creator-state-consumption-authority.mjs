import assert from "node:assert/strict";
import fs from "node:fs";
import {
  MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_AUTHORITY_DOMAIN,
  MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_PROOF_DOMAIN,
  createMovieMentorCreatorStateConsumptionAuthority,
  assertMovieMentorCreatorStateConsumptionAuthority,
} from "../ai/MovieMentorCreatorStateConsumptionAuthority.js";
import { createCreatorStateConsumptionRuntimeDeps } from "../ai/MovieMentorCreatorStateConsumptionRuntime.js";

const state = Object.freeze({
  projectId: "project-7",
  creatorSessionId: "session-history-7",
  revision: 12,
  revisionAuthorityReference: "revision-12",
  creatorStateGeneration: 8,
  creatorStateFingerprint: "state-fingerprint-8",
  creatorAuthorityReference: "creator-authority-8",
  snapshotReference: "snapshot-12",
  creatorConfirmedContext: [],
  projectJourney: { stageId: "story" },
  memoryContext: null,
  responseBlueprint: null,
  communicationPlan: null,
  capturedAt: new Date().toISOString(),
});

function authorization(overrides = {}) {
  return {
    authorized: true,
    principalId: "creator-7",
    projectId: "project-7",
    ownershipRef: "ownership-7",
    ownershipRevision: 4,
    authorizationSource: "test-current-project-owner",
    ...overrides,
  };
}

async function rejectsCode(fn, code) {
  await assert.rejects(fn, (error) => error?.code === code, `expected ${code}`);
}

console.log("ROUND SEVEN — creator-state consumption current-ownership torture");

let calls = 0;
const stableRequestAuthority = {
  async authorize() {
    calls += 1;
    return authorization();
  },
};
const capability = createMovieMentorCreatorStateConsumptionAuthority({
  request: { id: "request-7" },
  authorization: authorization(),
  requestAuthority: stableRequestAuthority,
});
assert.equal(capability.domain, MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_AUTHORITY_DOMAIN);

const promotionProof = await assertMovieMentorCreatorStateConsumptionAuthority({
  authority: capability,
  projectId: state.projectId,
  stage: "state-promotion",
  revision: state.revision,
  creatorStateGeneration: state.creatorStateGeneration,
  creatorStateFingerprint: state.creatorStateFingerprint,
});
assert.equal(promotionProof.domain, MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_PROOF_DOMAIN);
assert.equal(promotionProof.currentOwnershipVerified, true);
assert.equal(calls, 1, "state promotion must independently ask current request authority");

await rejectsCode(
  () => assertMovieMentorCreatorStateConsumptionAuthority({
    authority: capability,
    projectId: "project-evil",
    stage: "state-promotion",
    revision: state.revision,
    creatorStateGeneration: state.creatorStateGeneration,
    creatorStateFingerprint: state.creatorStateFingerprint,
  }),
  "MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_AUTHORITY_REQUIRED",
);

await rejectsCode(
  () => assertMovieMentorCreatorStateConsumptionAuthority({
    authority: capability,
    projectId: state.projectId,
    stage: "provider-dispatch",
    revision: state.revision,
    creatorStateGeneration: state.creatorStateGeneration,
    creatorStateFingerprint: state.creatorStateFingerprint,
  }),
  "MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_DISPATCH_BINDING_REQUIRED",
);

const intruderCapability = createMovieMentorCreatorStateConsumptionAuthority({
  request: {},
  authorization: authorization(),
  requestAuthority: { authorize: async () => authorization({ principalId: "intruder" }) },
});
await rejectsCode(
  () => assertMovieMentorCreatorStateConsumptionAuthority({
    authority: intruderCapability,
    projectId: state.projectId,
    stage: "state-promotion",
    revision: state.revision,
    creatorStateGeneration: state.creatorStateGeneration,
    creatorStateFingerprint: state.creatorStateFingerprint,
  }),
  "MOVIE_MENTOR_CREATOR_STATE_CURRENT_CONSUMPTION_OWNERSHIP_REQUIRED",
);

const changedOwnershipCapability = createMovieMentorCreatorStateConsumptionAuthority({
  request: {},
  authorization: authorization(),
  requestAuthority: { authorize: async () => authorization({ ownershipRevision: 5 }) },
});
await rejectsCode(
  () => assertMovieMentorCreatorStateConsumptionAuthority({
    authority: changedOwnershipCapability,
    projectId: state.projectId,
    stage: "state-promotion",
    revision: state.revision,
    creatorStateGeneration: state.creatorStateGeneration,
    creatorStateFingerprint: state.creatorStateFingerprint,
  }),
  "MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_OWNERSHIP_CHANGED",
);

let raceCalls = 0;
let durableReads = 0;
let providerFenceCalls = 0;
let providerEffects = 0;
const raceCapability = createMovieMentorCreatorStateConsumptionAuthority({
  request: { id: "race-request" },
  authorization: authorization(),
  requestAuthority: {
    async authorize() {
      raceCalls += 1;
      if (raceCalls === 1) return authorization();
      return { authorized: false, principalId: "creator-7", projectId: "project-7" };
    },
  },
});
const baseExecutionAuthority = {
  async assertProviderDispatch({ providerCall }) {
    providerFenceCalls += 1;
    return { dispatchAuthorized: true, executionId: providerCall.executionId, providerCallId: providerCall.providerCallId };
  },
};
const guarded = createCreatorStateConsumptionRuntimeDeps({
  creatorStateConsumptionAuthority: raceCapability,
  readAuthoritativeTurnSource: async () => { durableReads += 1; return structuredClone(state); },
  inferenceExecutionAuthority: baseExecutionAuthority,
});
const readableHistory = await guarded.readAuthoritativeTurnSource({ creatorSessionId: state.creatorSessionId });
assert.equal(readableHistory.projectId, state.projectId, "historical/session-secondary state may remain readable");
assert.equal(durableReads, 1);
assert.equal(raceCalls, 1, "promotion boundary must ask current ownership once");
await rejectsCode(
  async () => {
    await guarded.inferenceExecutionAuthority.assertProviderDispatch({
      providerCall: { executionId: "execution-7", providerCallId: "provider-call-7" },
    });
    providerEffects += 1;
  },
  "MOVIE_MENTOR_CREATOR_STATE_CURRENT_CONSUMPTION_OWNERSHIP_REQUIRED",
);
assert.equal(providerFenceCalls, 1, "existing execution fence must still own its proof");
assert.equal(raceCalls, 2, "provider dispatch must independently ask current ownership again");
assert.equal(providerEffects, 0, "revoked ownership must produce zero provider effects");

let stableBoundaryCalls = 0;
const stableBoundaryCapability = createMovieMentorCreatorStateConsumptionAuthority({
  request: {},
  authorization: authorization(),
  requestAuthority: { authorize: async () => { stableBoundaryCalls += 1; return authorization(); } },
});
const stableGuarded = createCreatorStateConsumptionRuntimeDeps({
  creatorStateConsumptionAuthority: stableBoundaryCapability,
  readAuthoritativeTurnSource: async () => structuredClone(state),
  inferenceExecutionAuthority: {
    async assertProviderDispatch({ providerCall }) {
      return { dispatchAuthorized: true, executionId: providerCall.executionId, providerCallId: providerCall.providerCallId };
    },
  },
});
await stableGuarded.readAuthoritativeTurnSource({ projectId: state.projectId });
const current = await stableGuarded.inferenceExecutionAuthority.assertProviderDispatch({ providerCall: { executionId: "execution-ok", providerCallId: "provider-ok" } });
assert.equal(current.dispatchAuthorized, true);
assert.equal(stableBoundaryCalls, 2, "capability may survive; proof may not");

const gatewaySource = fs.readFileSync(new URL("../movieMentorTurn.js", import.meta.url), "utf8");
const runtimeSource = fs.readFileSync(new URL("../ai/MovieMentorCreatorStateConsumptionRuntime.js", import.meta.url), "utf8");
const coreRuntimeSource = fs.readFileSync(new URL("../ai/MovieMentorTurnRuntime.js", import.meta.url), "utf8");

assert.match(gatewaySource, /createMovieMentorCreatorStateConsumptionAuthority/);
assert.match(gatewaySource, /creatorStateConsumptionAuthority=consumptionAuthorityFrom\(req,authorized\)/);
assert.match(gatewaySource, /creatorStateConsumptionAuthority,forwardExecutionAuthority,commitCreatorDecision/);
assert.match(gatewaySource, /runMovieMentorTurnWithForwardExecutionAuthority/);
assert.match(runtimeSource, /const state = await baseRead\(identity\);[\s\S]*stage: "state-promotion"[\s\S]*liveStateUniverse = universe;[\s\S]*return state;/);
assert.match(runtimeSource, /const current = await method\.call\(target, args\);[\s\S]*stage: "provider-dispatch"[\s\S]*return current;/);
assert.match(coreRuntimeSource, /const state = await readSource\(identity\);\s*const envelope = buildTurnEnvelopeFromDurableState/);
assert.match(coreRuntimeSource, /const current = await inferenceExecutionAuthority\.assertProviderDispatch\(\{ providerCall: decision \}\);[\s\S]*const result = await providerFunction\(\);/);
assert.ok(coreRuntimeSource.indexOf("convergeExistingTurn") < coreRuntimeSource.indexOf("const state = await readSource(identity)"), "terminal convergence must remain before mutable creator-state consumption");

console.log("PASS — current ownership is independently required when durable creator state enters the live turn and again after the execution fence before provider dispatch.");
