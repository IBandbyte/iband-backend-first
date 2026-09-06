import assert from "node:assert/strict";
import { createMovieMentorCreatorStateConsumptionAuthority } from "../ai/MovieMentorCreatorStateConsumptionAuthority.js";
import { createCreatorStateConsumptionRuntimeDeps } from "../ai/MovieMentorCreatorStateConsumptionRuntime.js";

console.log("5A.33 — stale creator-state provider-dispatch authority");

const authorization = Object.freeze({
  authorized: true,
  principalId: "creator-7",
  projectId: "project-7",
  ownershipRef: "ownership-7",
  ownershipRevision: 4,
  authorizationSource: "adversarial-verifier",
});

function creatorState({ revision, generation, fingerprint }) {
  return Object.freeze({
    projectId: "project-7",
    creatorSessionId: "session-7",
    revision,
    revisionAuthorityReference: `revision-${revision}`,
    creatorStateGeneration: generation,
    creatorStateFingerprint: fingerprint,
    creatorAuthorityReference: `creator-authority-${generation}`,
    snapshotReference: `snapshot-${revision}`,
    creatorConfirmedContext: [],
    projectJourney: { stageId: "story", revision },
    memoryContext: null,
    responseBlueprint: null,
    communicationPlan: null,
    capturedAt: "2026-09-06T20:30:00.000Z",
  });
}

async function run({ advanceStateBeforeDispatch = false } = {}) {
  let durableState = creatorState({ revision: 12, generation: 8, fingerprint: "state-fingerprint-8" });
  let providerEffects = 0;
  let providerFenceCalls = 0;
  let durableReads = 0;

  const requestAuthority = {
    async authorize() {
      return authorization;
    },
  };

  const consumptionAuthority = createMovieMentorCreatorStateConsumptionAuthority({
    request: { id: "request-7" },
    authorization,
    requestAuthority,
  });

  const guarded = createCreatorStateConsumptionRuntimeDeps({
    creatorStateConsumptionAuthority: consumptionAuthority,
    readAuthoritativeTurnSource: async () => {
      durableReads += 1;
      return structuredClone(durableState);
    },
    inferenceExecutionAuthority: {
      async assertProviderDispatch({ providerCall }) {
        providerFenceCalls += 1;
        return {
          authorized: true,
          dispatchAuthorized: true,
          executionId: providerCall.executionId,
          providerCallId: providerCall.providerCallId,
        };
      },
    },
  });

  const promoted = await guarded.readAuthoritativeTurnSource({ projectId: "project-7" });
  assert.equal(promoted.revision, 12);
  assert.equal(promoted.creatorStateGeneration, 8);
  assert.equal(promoted.creatorStateFingerprint, "state-fingerprint-8");

  if (advanceStateBeforeDispatch) {
    durableState = creatorState({ revision: 13, generation: 9, fingerprint: "state-fingerprint-9" });
  }

  let dispatch = null;
  try {
    dispatch = await guarded.inferenceExecutionAuthority.assertProviderDispatch({
      providerCall: {
        executionId: "execution-7",
        providerCallId: "provider-call-7",
      },
    });
    if (dispatch?.dispatchAuthorized === true) providerEffects += 1;
  } catch (error) {
    dispatch = error;
  }

  return { durableReads, providerFenceCalls, providerEffects, dispatch, durableState };
}

{
  const result = await run({ advanceStateBeforeDispatch: false });
  assert.equal(result.providerEffects, 1, "unchanged durable creator-state universe must remain dispatchable");
  assert.equal(result.providerFenceCalls, 1);
  console.log("✓ unchanged durable creator-state universe remains dispatchable");
}

{
  const result = await run({ advanceStateBeforeDispatch: true });
  assert.equal(result.durableState.revision, 13, "adversarial verifier must advance durable creator state after promotion");
  assert.equal(result.durableState.creatorStateGeneration, 9);
  assert.equal(result.providerEffects, 0, "provider dispatch must expose zero effects when the promoted creator-state universe is no longer current");
  assert.ok(result.dispatch instanceof Error, "stale promoted creator state must fail closed before provider dispatch");
  console.log("✓ stale promoted creator-state universe cannot authorize later provider dispatch");
}

console.log("PASS stale creator-state provider-dispatch authority.");
console.log("LAW: CURRENT OWNERSHIP DOES NOT MAKE STALE CREATOR STATE CURRENT. PROVIDER DISPATCH MUST RE-EARN THE CURRENT DURABLE CREATOR-STATE UNIVERSE.");
