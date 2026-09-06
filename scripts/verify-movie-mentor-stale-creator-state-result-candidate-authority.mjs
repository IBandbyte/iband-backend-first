import assert from "node:assert/strict";
import { createMovieMentorCreatorStateConsumptionAuthority } from "../ai/MovieMentorCreatorStateConsumptionAuthority.js";
import { createCreatorStateConsumptionRuntimeDeps } from "../ai/MovieMentorCreatorStateConsumptionRuntime.js";

console.log("5A.34 — stale creator-state result-candidate authority");

const authorization = Object.freeze({
  authorized: true,
  principalId: "creator-9",
  projectId: "project-9",
  ownershipRef: "ownership-9",
  ownershipRevision: 6,
});

const requestAuthority = Object.freeze({
  async authorize() {
    return authorization;
  },
});

const creatorStateConsumptionAuthority = createMovieMentorCreatorStateConsumptionAuthority({
  request: Object.freeze({ id: "request-9" }),
  authorization,
  requestAuthority,
});

function state(revision, generation, fingerprint) {
  return {
    projectId: "project-9",
    creatorSessionId: "session-9",
    revision,
    creatorStateGeneration: generation,
    creatorStateFingerprint: fingerprint,
  };
}

async function buildHarness() {
  let durableState = state(20, 11, "state-fingerprint-11");
  let staged = 0;
  const baseExecutionAuthority = {
    async assertProviderDispatch({ providerCall }) {
      return {
        authorized: true,
        dispatchAuthorized: true,
        executionId: providerCall.executionId,
        providerCallId: providerCall.providerCallId,
      };
    },
    async stageResultCandidate({ execution, resultPayload }) {
      staged += 1;
      return {
        candidateReference: `candidate-${staged}`,
        executionId: execution.executionId,
        resultDigest: `digest-${staged}`,
        resultPayload,
      };
    },
  };

  const guarded = createCreatorStateConsumptionRuntimeDeps({
    creatorStateConsumptionAuthority,
    readAuthoritativeTurnSource: async () => structuredClone(durableState),
    inferenceExecutionAuthority: baseExecutionAuthority,
  });

  await guarded.readAuthoritativeTurnSource({ projectId: "project-9" });
  await guarded.inferenceExecutionAuthority.assertProviderDispatch({
    providerCall: {
      executionId: "execution-9",
      providerCallId: "provider-call-9",
    },
  });

  return {
    guarded,
    staged: () => staged,
    advanceState(next) {
      durableState = structuredClone(next);
    },
  };
}

{
  const harness = await buildHarness();
  const candidate = await harness.guarded.inferenceExecutionAuthority.stageResultCandidate({
    execution: { executionId: "execution-9" },
    resultPayload: { success: true, text: "current result" },
  });
  assert.equal(candidate.candidateReference, "candidate-1");
  assert.equal(harness.staged(), 1, "unchanged durable creator state must remain stageable");
  console.log("✓ unchanged durable creator-state universe remains result-candidate stageable");
}

{
  const harness = await buildHarness();
  harness.advanceState(state(21, 12, "state-fingerprint-12"));
  await assert.rejects(
    () => harness.guarded.inferenceExecutionAuthority.stageResultCandidate({
      execution: { executionId: "execution-9" },
      resultPayload: { success: true, text: "historical result" },
    }),
    error => error?.code === "MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_STALE",
    "result-candidate staging must fail closed when the durable creator-state universe changed after the final provider boundary",
  );
  assert.equal(harness.staged(), 0, "stale creator-state result must produce zero durable candidate writes");
  console.log("✓ stale durable creator-state universe cannot become a result candidate");
}

console.log("5A.34 stale creator-state result-candidate authority gate: GREEN");
