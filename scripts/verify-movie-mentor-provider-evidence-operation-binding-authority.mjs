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
const exactOperation = Object.freeze({
  providerOperationId: call.providerCallId,
  executionId: call.executionId,
  slotId: call.slotId,
  task: call.task,
  providerTarget: Object.freeze({
    provider: "openai",
    adapter: "openai-responses",
    routeFingerprint: "a".repeat(64),
    recoveryMode: "known-response-id-retrieval",
  }),
});

let reality = null;
let appendCount = 0;
const store = {
  async readEffect() { return reality ? structuredClone(reality) : null; },
  async beginUnknown(input) {
    reality = { providerCallId: input.providerCallId, executionId: input.executionId, slotId: input.slotId, task: input.task, state: "unknown", dispatchUnknownAt: input.dispatchUnknownAt, evidence: [] };
    return structuredClone(reality);
  },
  async appendEvidence(input) {
    appendCount += 1;
    reality = { ...reality, state: "confirmed", evidence: [...reality.evidence, { externalEffectId: input.externalEffectId, provider: input.provider, observedAt: input.observedAt, source: input.source }] };
    return structuredClone(reality);
  },
};
const authority = createMovieMentorProviderEffectAuthority({ store, now: () => new Date("2026-09-08T00:00:01.000Z"), requireEvidenceOperationBinding: true });
await authority.beginDispatch({ providerCall: call });

await assert.rejects(
  () => authority.contributeEvidence({ providerCallId: call.providerCallId, externalEffectId: "resp-missing-operation", provider: "openai", source: "provider-response" }),
  (error) => error?.code === "MOVIE_MENTOR_PROVIDER_EFFECT_OPERATION_BINDING_REQUIRED",
  "production evidence authority must reject caller-supplied effect identity without its durable provider operation",
);
assert.equal(appendCount, 0, "missing provider-operation authority must fail before durable mutation");

await assert.rejects(
  () => authority.contributeEvidence({ providerCallId: call.providerCallId, externalEffectId: "resp-wrong-operation", provider: "openai", source: "provider-response", providerOperation: { ...exactOperation, providerOperationId: "different-provider-call" } }),
  (error) => error?.code === "MOVIE_MENTOR_PROVIDER_EFFECT_OPERATION_BINDING_INVALID",
  "mismatched provider operation must be structurally rejected",
);
assert.equal(appendCount, 0, "mismatched provider-operation evidence must fail before durable mutation");

await assert.rejects(
  () => authority.contributeEvidence({ providerCallId: call.providerCallId, externalEffectId: "resp-wrong-provider", provider: "generic-http", source: "provider-response", providerOperation: exactOperation }),
  (error) => error?.code === "MOVIE_MENTOR_PROVIDER_EFFECT_PROVIDER_BINDING_INVALID",
  "provider evidence must match the provider identity durably bound to the exact provider operation",
);
assert.equal(appendCount, 0, "wrong-provider evidence must fail before durable mutation");
assert.equal(reality.state, "unknown");
assert.deepEqual(reality.evidence, []);

const accepted = await authority.contributeEvidence({ providerCallId: call.providerCallId, externalEffectId: "resp-known", provider: "openai", source: "provider-response", providerOperation: exactOperation });
assert.equal(accepted.accepted, true);
assert.equal(accepted.providerOperationBound, true);
assert.equal(appendCount, 1);
assert.equal(reality.state, "confirmed");
assert.equal(reality.evidence[0].externalEffectId, "resp-known");
assert.equal(reality.evidence[0].provider, "openai");

console.log("Movie Mentor provider evidence operation-binding authority: GREEN");
