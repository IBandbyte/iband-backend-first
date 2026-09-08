import assert from "node:assert/strict";
import { createMovieMentorProviderEffectAuthority } from "../ai/MovieMentorProviderEffectAuthority.js";

const call = Object.freeze({
  dispatchAuthorized: true,
  projectId: "project-evidence-binding",
  principalId: "principal-evidence-binding",
  creatorTurnId: "turn-evidence-binding",
  reservationId: "reservation-evidence-binding",
  requestDigest: "request-evidence-binding",
  providerCallId: "provider-call-evidence-binding",
  executionId: "execution-evidence-binding",
  slotId: "semantic",
  task: "semantic",
  ownerId: "owner-evidence-binding",
  leaseGeneration: 1,
  leaseReference: "lease-evidence-binding",
  fencingToken: "fence-evidence-binding",
  admittedAt: "2026-09-08T00:00:00.000Z",
});

let reality = null;
const store = {
  async readEffect() { return reality ? structuredClone(reality) : null; },
  async beginUnknown(input) {
    reality = {
      providerCallId: input.providerCallId,
      executionId: input.executionId,
      slotId: input.slotId,
      task: input.task,
      state: "unknown",
      dispatchUnknownAt: input.dispatchUnknownAt,
      evidence: [],
    };
    return structuredClone(reality);
  },
  async appendEvidence(input) {
    reality = {
      ...reality,
      state: "confirmed",
      evidence: [{
        externalEffectId: input.externalEffectId,
        provider: input.provider,
        observedAt: input.observedAt,
        source: input.source,
      }],
    };
    return structuredClone(reality);
  },
};

const authority = createMovieMentorProviderEffectAuthority({
  store,
  now: () => new Date("2026-09-08T00:00:01.000Z"),
});

await authority.beginDispatch({ providerCall: call });

await assert.rejects(
  () => authority.contributeEvidence({
    providerCallId: call.providerCallId,
    externalEffectId: "resp-known",
    provider: "openai",
    source: "provider-response",
    providerOperation: {
      providerOperationId: "different-provider-call",
      executionId: call.executionId,
      slotId: call.slotId,
      task: call.task,
    },
  }),
  (error) => error?.code === "MOVIE_MENTOR_PROVIDER_EFFECT_OPERATION_BINDING_INVALID",
  "provider evidence must not become durable authority when the supplied provider operation belongs to a different provider-call universe",
);

assert.equal(reality.state, "unknown", "mismatched provider-operation evidence must not mutate durable effect reality");
assert.deepEqual(reality.evidence, [], "mismatched provider-operation evidence must not be appended");

console.log("Movie Mentor provider evidence operation-binding authority: GREEN");
