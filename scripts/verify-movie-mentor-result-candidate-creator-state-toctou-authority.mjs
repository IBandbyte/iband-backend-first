import assert from "node:assert/strict";
import { createMovieMentorCreatorStateConsumptionAuthority } from "../ai/MovieMentorCreatorStateConsumptionAuthority.js";
import { createCreatorStateConsumptionRuntimeDeps } from "../ai/MovieMentorCreatorStateConsumptionRuntime.js";

console.log("5A.35 — result-candidate creator-state TOCTOU authority");

const authorization = Object.freeze({
  authorized: true,
  principalId: "creator-35",
  projectId: "project-35",
  ownershipRef: "ownership-35",
  ownershipRevision: 9,
});
const requestAuthority = Object.freeze({ async authorize() { return authorization; } });
const creatorStateConsumptionAuthority = createMovieMentorCreatorStateConsumptionAuthority({
  request: Object.freeze({ id: "request-35" }),
  authorization,
  requestAuthority,
});

function creatorState(revision, generation, fingerprint) {
  return {
    projectId: "project-35",
    creatorSessionId: "session-35",
    revision,
    creatorStateGeneration: generation,
    creatorStateFingerprint: fingerprint,
  };
}

function proofMatchesState(proof, state) {
  return Boolean(
    proof?.authorized === true
    && proof?.currentOwnershipVerified === true
    && proof?.stage === "result-candidate"
    && proof?.projectId === state.projectId
    && proof?.revision === state.revision
    && proof?.creatorStateGeneration === state.creatorStateGeneration
    && proof?.creatorStateFingerprint === state.creatorStateFingerprint
    && proof?.executionId === "execution-35"
  );
}

async function buildHarness({ mutateAtCandidateStoreBoundary = false } = {}) {
  let durableState = creatorState(30, 14, "state-fingerprint-14");
  let staged = 0;
  let candidateStoreCalls = 0;

  const baseExecutionAuthority = {
    async assertProviderDispatch({ providerCall }) {
      return {
        authorized: true,
        dispatchAuthorized: true,
        executionId: providerCall.executionId,
        providerCallId: providerCall.providerCallId,
      };
    },
    async stageResultCandidate({ execution, resultPayload, creatorStateConsumptionProof = null }) {
      candidateStoreCalls += 1;

      // This is the adversarial interleaving PR #27 cannot close with a
      // read-before-write alone: the state changes after the runtime freshness
      // read but before the durable candidate write owns its transaction.
      if (mutateAtCandidateStoreBoundary) {
        durableState = creatorState(31, 15, "state-fingerprint-15");
      }

      // Model the production store behaviour we need: if the runtime carries
      // its exact result-candidate proof into the irreversible store boundary,
      // the store can compare that proof with creator state inside the same
      // transaction and fail before any candidate becomes durable.
      if (creatorStateConsumptionProof && !proofMatchesState(creatorStateConsumptionProof, durableState)) {
        const error = new Error("Result-candidate creator state changed at the atomic store boundary.");
        error.code = "MOVIE_MENTOR_RESULT_CANDIDATE_CREATOR_STATE_FENCED";
        throw error;
      }

      staged += 1;
      return {
        authorized: true,
        staged: true,
        candidateReference: `candidate-${staged}`,
        executionId: execution.executionId,
        resultPayload,
      };
    },
  };

  const guarded = createCreatorStateConsumptionRuntimeDeps({
    creatorStateConsumptionAuthority,
    readAuthoritativeTurnSource: async () => structuredClone(durableState),
    inferenceExecutionAuthority: baseExecutionAuthority,
  });

  await guarded.readAuthoritativeTurnSource({ projectId: "project-35" });
  await guarded.inferenceExecutionAuthority.assertProviderDispatch({
    providerCall: { executionId: "execution-35", providerCallId: "provider-call-35" },
  });

  return {
    guarded,
    staged: () => staged,
    candidateStoreCalls: () => candidateStoreCalls,
  };
}

{
  const harness = await buildHarness();
  const candidate = await harness.guarded.inferenceExecutionAuthority.stageResultCandidate({
    execution: { executionId: "execution-35" },
    resultPayload: { text: "current result" },
  });
  assert.equal(candidate.candidateReference, "candidate-1");
  assert.equal(harness.staged(), 1, "unchanged creator state must still stage exactly one candidate");
  console.log("✓ unchanged creator state remains candidate-stageable");
}

{
  const harness = await buildHarness({ mutateAtCandidateStoreBoundary: true });
  await assert.rejects(
    () => harness.guarded.inferenceExecutionAuthority.stageResultCandidate({
      execution: { executionId: "execution-35" },
      resultPayload: { text: "historical result" },
    }),
    error => error?.code === "MOVIE_MENTOR_RESULT_CANDIDATE_CREATOR_STATE_FENCED",
    "candidate staging must carry its current-state proof into the irreversible store boundary so a post-check creator-state race fails closed",
  );
  assert.equal(harness.candidateStoreCalls(), 1, "the atomic candidate boundary must be reached exactly once");
  assert.equal(harness.staged(), 0, "creator-state TOCTOU must produce zero durable candidate writes");
  console.log("✓ creator-state change between runtime check and candidate write produces zero durable candidates");
}

console.log("5A.35 result-candidate creator-state TOCTOU authority gate: GREEN");
