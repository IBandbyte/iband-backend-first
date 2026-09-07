import assert from "node:assert/strict";
import { createFencedInferenceOrchestrationDeps } from "../ai/MovieMentorTurnRuntime.js";
import { createMovieMentorProviderEffectAuthority } from "../ai/MovieMentorProviderEffectAuthority.js";

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
let effectReality = null;
const effectStore = {
  async readEffect(providerCallId) {
    return providerCallId === providerCall.providerCallId ? effectReality : null;
  },
  async beginUnknown(binding) {
    effectReality = Object.freeze({ ...structuredClone(binding), state: "unknown", evidence: [] });
    return effectReality;
  },
  async appendEvidence() {
    evidenceAttempts += 1;
    return null;
  },
};
const effectAuthority = createMovieMentorProviderEffectAuthority({
  store: effectStore,
  now: () => new Date("2026-09-07T00:00:01.000Z"),
});
const authority = {
  async claimProviderCall() { return providerCall; },
  async bindProviderReconstructionInput() { return { authorized: true, inputBound: true }; },
  beginProviderDispatch: ({ providerCall: call }) => effectAuthority.beginDispatch({ providerCall: call }),
  async assertProviderDispatch() { return { authorized: true, dispatchAuthorized: true }; },
  contributeProviderEffectEvidence: (evidence) => effectAuthority.contributeEvidence(evidence),
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
  "A known provider response must fail closed when the real effect authority cannot make its identity durable.",
);

assert.equal(providerExecutions, 1, "the provider response must already have happened");
assert.equal(evidenceAttempts, 1, "the real effect authority must attempt durable evidence persistence exactly once");
assert.equal(effectReality.state, "unknown", "failed evidence persistence must never counterfeit CONFIRMED reality");

console.log("Movie Mentor provider evidence durability authority verified.");
