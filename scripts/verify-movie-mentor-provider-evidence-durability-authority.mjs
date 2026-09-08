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

function unknownReality(binding = providerCall) {
  return Object.freeze({
    ...structuredClone(binding),
    state: "unknown",
    evidence: Object.freeze([]),
    dispatchUnknownAt: "2026-09-07T00:00:00.500Z",
  });
}

async function runRuntimeCase({ appendEvidence }) {
  let providerExecutions = 0;
  let evidenceAttempts = 0;
  let effectReality = null;
  const effectStore = {
    async readEffect(providerCallId) {
      return providerCallId === providerCall.providerCallId ? effectReality : null;
    },
    async beginUnknown(binding) {
      effectReality = unknownReality(binding);
      return effectReality;
    },
    async appendEvidence(input) {
      evidenceAttempts += 1;
      return appendEvidence({ input, getReality: () => effectReality, setReality: (value) => { effectReality = value; } });
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
  return { fenced, stats: () => ({ providerExecutions, evidenceAttempts, effectReality }) };
}

const nullWrite = await runRuntimeCase({ appendEvidence: async () => null });
await assert.rejects(
  () => nullWrite.fenced.interpretSemantics({ proof: true }),
  (error) => error?.code === "MOVIE_MENTOR_PROVIDER_EFFECT_EVIDENCE_NOT_DURABLE",
  "A known provider response must fail closed when appendEvidence returns no durable reality.",
);
assert.equal(nullWrite.stats().providerExecutions, 1, "the provider response must already have happened");
assert.equal(nullWrite.stats().evidenceAttempts, 1, "durable evidence persistence must be attempted exactly once");
assert.equal(nullWrite.stats().effectReality.state, "unknown", "failed persistence must never counterfeit CONFIRMED reality");

const thrownWrite = await runRuntimeCase({
  appendEvidence: async () => {
    const error = new Error("simulated durable write failure");
    error.code = "SIMULATED_PROVIDER_EFFECT_WRITE_FAILURE";
    throw error;
  },
});
await assert.rejects(
  () => thrownWrite.fenced.interpretSemantics({ proof: true }),
  (error) => error?.code === "MOVIE_MENTOR_PROVIDER_EFFECT_EVIDENCE_NOT_DURABLE",
  "A failed evidence write followed by a reread of the still-UNKNOWN row must not counterfeit durable contribution.",
);
assert.equal(thrownWrite.stats().providerExecutions, 1, "the provider response must not be replayed after evidence-write failure");
assert.equal(thrownWrite.stats().evidenceAttempts, 1, "the failed durable write must not be silently retried by result authority");
assert.equal(thrownWrite.stats().effectReality.state, "unknown", "rereading the pre-existing UNKNOWN row is not a commit receipt");

const durableWrite = await runRuntimeCase({
  appendEvidence: async ({ input, getReality, setReality }) => {
    const before = getReality();
    const after = Object.freeze({
      ...structuredClone(before),
      state: "confirmed",
      evidence: Object.freeze([Object.freeze({
        externalEffectId: input.externalEffectId,
        provider: input.provider,
        observedAt: input.observedAt,
        source: input.source,
      })]),
    });
    setReality(after);
    return after;
  },
});
const result = await durableWrite.fenced.interpretSemantics({ proof: true });
assert.equal(result.metadata.responseId, "resp-evidence-known-but-not-durable", "a genuinely durable provider response may retain result authority");
assert.equal(durableWrite.stats().effectReality.state, "confirmed", "successful evidence persistence must establish confirmed durable reality");
assert.deepEqual(durableWrite.stats().effectReality.evidence.map((item) => item.externalEffectId), ["resp-evidence-known-but-not-durable"]);

console.log("Movie Mentor provider evidence durability authority verified.");
console.log("LAW: A REREAD IS A COMMIT RECEIPT ONLY WHEN IT CONTAINS THE EXACT EVIDENCE BEING AUTHORIZED.");