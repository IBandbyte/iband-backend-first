import assert from "node:assert/strict";
import { createFencedInferenceOrchestrationDeps } from "../ai/MovieMentorTurnRuntime.js";

const providerCall = Object.freeze({
  authorized: true,
  dispatchAuthorized: true,
  projectId: "project-evidence-durability",
  principalId: "creator-evidence-durability",
  creatorTurnId: "turn-evidence-durability",
  reservationId: "reservation-evidence-durability",
  requestDigest: "request-evidence-durability",
  providerCallId: "provider-call-evidence-durability",
  executionId: "execution-evidence-durability",
  slotId: "semantic",
  task: "movie-mentor-semantic",
  ownerId: "owner-evidence-durability",
  leaseGeneration: 1,
  leaseReference: "lease-evidence-durability",
  fencingToken: "fence-evidence-durability",
  admittedAt: "2026-09-07T00:00:00.000Z",
});

let providerExecutions = 0;
let evidenceAttempts = 0;
const authority = {
  async claimProviderCall() { return providerCall; },
  async bindProviderReconstructionInput() { return { authorized: true, inputBound: true }; },
  async beginProviderDispatch() { return { authorized: true, dispatchAuthorized: true, effectState: "unknown" }; },
  async assertProviderDispatch() { return { authorized: true, dispatchAuthorized: true }; },
  async contributeProviderEffectEvidence() {
    evidenceAttempts += 1;
    return { accepted: false, reason: "provider-effect-evidence-not-durable" };
  },
};

const fenced = createFencedInferenceOrchestrationDeps({
  execution: Object.freeze({ authorized: true, executionId: providerCall.executionId }),
  inferenceExecutionAuthority: authority,
  deps: {
    interpretSemantics: async () => {
      providerExecutions += 1;
      return Object.freeze({
        structured: Object.freeze({ movieJourneyIntelligence: Object.freeze({ proof: true }) }),
        metadata: Object.freeze({ provider: "openai", responseId: "resp-evidence-known-but-not-durable" }),
      });
    },
  },
});

await assert.rejects(
  () => fenced.interpretSemantics({ proof: true }),
  (error) => error?.code === "MOVIE_MENTOR_PROVIDER_EFFECT_EVIDENCE_NOT_DURABLE",
  "A known provider response must not return result authority when its effect identity failed to become durable.",
);

assert.equal(providerExecutions, 1, "the provider response must already have happened");
assert.equal(evidenceAttempts, 1, "the runtime must attempt to persist the known provider effect exactly once");

console.log("Movie Mentor provider evidence durability authority verified.");
