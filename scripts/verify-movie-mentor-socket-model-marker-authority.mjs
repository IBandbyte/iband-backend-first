import assert from "node:assert/strict";
import { normalizeProviderOperation, assertProviderOperationModel } from "../ai/StructuredAIProviderClient.js";

console.log("Movie Mentor socket model-marker authority court");

const target = ({ dispatchModel = null } = {}) => Object.freeze({
  provider: "generic-http",
  adapter: "generic-http",
  routeFingerprint: "e".repeat(64),
  recoveryMode: "none",
  dispatchModel,
});

const base = Object.freeze({
  providerOperationId: "provider-operation-socket-marker",
  executionId: "execution-socket-marker",
  slotId: "semantic",
  task: "movie-mentor-semantic",
  providerTarget: target({ dispatchModel: null }),
});

assert.throws(
  () => normalizeProviderOperation(base),
  (error) => error?.code === "AI_PROVIDER_MODEL_AUTHORITY_MARKER_REQUIRED",
  "the provider socket must reject a model-bearing target whose operation envelope never carried the explicit model-authority marker",
);

assert.throws(
  () => normalizeProviderOperation({ ...base, providerModel: null }),
  (error) => error?.code === "AI_PROVIDER_MODEL_AUTHORITY_MARKER_REQUIRED",
  "the provider socket must not infer authority merely because a providerModel property is present without its explicit marker",
);

assert.throws(
  () => normalizeProviderOperation({
    ...base,
    providerModelAuthorityBound: true,
    providerModel: "model-a",
    providerTarget: target({ dispatchModel: "model-b" }),
  }),
  (error) => error?.code === "AI_PROVIDER_MODEL_AUTHORITY_CONFLICT",
  "the provider socket must independently reject a marked provider model that conflicts with the model carried by its authorized provider target",
);

const explicitNull = normalizeProviderOperation({
  ...base,
  providerModelAuthorityBound: true,
  providerModel: null,
});
assert.equal(explicitNull.providerModelAuthorityBound, true);
assert.ok(Object.prototype.hasOwnProperty.call(explicitNull, "providerModel"));
assert.equal(explicitNull.providerModel, null);
assert.equal(
  assertProviderOperationModel(explicitNull, { provider: "generic-http", model: "" }),
  null,
  "explicit null model authority must remain valid for generic-http at the irreversible provider boundary",
);

const unbound = normalizeProviderOperation({
  providerOperationId: "provider-operation-unbound-model",
  executionId: "execution-unbound-model",
  slotId: "semantic",
  task: "movie-mentor-semantic",
});
assert.equal(unbound.providerModelAuthorityBound, false);
assert.equal(
  Object.prototype.hasOwnProperty.call(unbound, "providerModel"),
  false,
  "an unbound provider operation must preserve absence instead of manufacturing a null model value",
);

console.log("✓ socket refuses to manufacture model authority from target/model fields");
console.log("✓ socket independently rejects conflicts inside a marked model-authority envelope");
console.log("✓ explicit null remains valid when and only when the authority marker is present");
console.log("LAW: THE NETWORK BOUNDARY MAY VERIFY MODEL AUTHORITY. IT MAY NOT INVENT THE MARKER OR BORROW CONSISTENCY PROOF FROM ITS NEIGHBOUR.");
console.log("Movie Mentor socket model-marker authority gate: GREEN");
