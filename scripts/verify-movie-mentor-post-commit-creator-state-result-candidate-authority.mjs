import assert from "node:assert/strict";
import { createCreatorStateConsumptionRuntimeDeps } from "../ai/MovieMentorCreatorStateConsumptionRuntime.js";

console.log("ROUND SEVEN — post-commit creator-state result-candidate authority torture");

const projectId = "project-post-commit-1";
let durableState = {
  projectId,
  revision: 12,
  creatorStateGeneration: 8,
  creatorStateFingerprint: "state-fingerprint-8",
};
let staged = 0;
const proofs = [];

const creatorStateConsumptionAuthority = {
  async assertCurrentConsumption(target = {}) {
    proofs.push(structuredClone(target));
    return {
      authorized: true,
      currentOwnershipVerified: true,
      projectId: target.projectId,
      revision: target.revision,
      creatorStateGeneration: target.creatorStateGeneration,
      creatorStateFingerprint: target.creatorStateFingerprint,
      executionId: target.executionId || null,
      providerCallId: target.providerCallId || null,
      stage: target.stage,
    };
  },
};

const baseExecutionAuthority = {
  async assertProviderDispatch({ providerCall } = {}) {
    return {
      authorized: true,
      dispatchAuthorized: true,
      executionId: providerCall?.executionId,
      providerCallId: providerCall?.providerCallId,
    };
  },
  async stageResultCandidate({ execution, resultPayload, creatorStateConsumptionProof = null } = {}) {
    staged += 1;
    return {
      candidateReference: `candidate-${staged}`,
      executionId: execution?.executionId,
      resultDigest: `digest-${staged}`,
      resultPayload,
      creatorStateConsumptionProof,
    };
  },
};

const deps = createCreatorStateConsumptionRuntimeDeps({
  creatorStateConsumptionAuthority,
  readAuthoritativeTurnSource: async () => structuredClone(durableState),
  inferenceExecutionAuthority: baseExecutionAuthority,
});

// Promote the exact state that owns the turn.
await deps.readAuthoritativeTurnSource({ projectId });
assert.equal(proofs.at(-1)?.stage, "state-promotion");
assert.equal(proofs.at(-1)?.revision, 12);

// The SAME creator turn then legitimately commits an explicit creator decision.
// This is not an external stale-state race: it is the turn's own authorized mutation.
durableState = {
  projectId,
  revision: 13,
  creatorStateGeneration: 9,
  creatorStateFingerprint: "state-fingerprint-9",
};

const execution = { executionId: "execution-post-commit-1" };
const resultPayload = {
  text: "I’ve locked in the hidden-tunnel choice and carried it into the next step.",
  postCommitCreatorAuthority: {
    projectId,
    revision: 13,
    creatorState: { generation: 9, fingerprint: "state-fingerprint-9" },
  },
};

const candidate = await deps.inferenceExecutionAuthority.stageResultCandidate({ execution, resultPayload });
assert.equal(staged, 1, "the turn's own authorized post-commit state must remain eligible for result-candidate staging");
assert.equal(candidate?.creatorStateConsumptionProof?.revision, 13, "result-candidate authority must bind the exact post-commit durable revision");
assert.equal(candidate?.creatorStateConsumptionProof?.creatorStateGeneration, 9, "result-candidate authority must bind the exact post-commit state generation");
assert.equal(candidate?.creatorStateConsumptionProof?.creatorStateFingerprint, "state-fingerprint-9", "result-candidate authority must bind the exact post-commit state fingerprint");
console.log("✓ legitimate same-turn creator mutation advances the tracked universe before result-candidate staging");

console.log("LAW: A TURN MUST NOT REVOKE ITSELF FOR MAKING THE CREATOR DECISION IT WAS AUTHORIZED TO MAKE.");
console.log("LAW: POST-COMMIT CURRENTNESS MUST BE PROVEN, NOT CONFUSED WITH PRE-COMMIT STALENESS.");
console.log("ROUND SEVEN post-commit creator-state result-candidate authority torture: GREEN");
