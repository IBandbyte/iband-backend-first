import assert from "node:assert/strict";
import { assertRecoveredOutcomeBinding } from "../ai/MovieMentorRecoveredProviderResultAuthority.js";

const historical = Object.freeze({
  providerCallId: "provider-call-effect-binding",
  executionId: "execution-effect-binding",
  slotId: "semantic",
  task: "movie-mentor-semantic",
});

const wrongResponse = Object.freeze({
  id: "resp-neighbouring-effect",
  output_text: JSON.stringify({ readyToAdvance: true }),
});

const recovery = Object.freeze({
  outcome: "CONFIRMED_EFFECT",
  recovered: true,
  recoveryAuthorized: true,
  redispatchAuthorized: false,
  refundAuthorized: false,
  providerCallId: historical.providerCallId,
  executionId: historical.executionId,
  slotId: historical.slotId,
  task: historical.task,
  externalEffectId: "resp-authorized-effect",
  recoveredProviderResponse: wrongResponse,
});

await assert.rejects(
  async () => assertRecoveredOutcomeBinding({ recovery, historical }),
  (error) => error?.code === "MOVIE_MENTOR_PROVIDER_RECOVERY_RESPONSE_EFFECT_BINDING_INVALID",
  "recovered bytes from a neighbouring provider effect must not inherit the authorized historical effect ID",
);

const missingResponseId = Object.freeze({
  ...recovery,
  recoveredProviderResponse: Object.freeze({ output_text: "{}" }),
});
await assert.rejects(
  async () => assertRecoveredOutcomeBinding({ recovery: missingResponseId, historical }),
  (error) => error?.code === "MOVIE_MENTOR_PROVIDER_RECOVERY_RESPONSE_EFFECT_BINDING_INVALID",
  "recovered provider bytes without their exact response identity must fail closed",
);

const exactRecovery = Object.freeze({
  ...recovery,
  recoveredProviderResponse: Object.freeze({ id: recovery.externalEffectId, output_text: "{}" }),
});
const bound = assertRecoveredOutcomeBinding({ recovery: exactRecovery, historical });
assert.equal(bound.externalEffectId, recovery.externalEffectId);
assert.equal(bound.recoveredProviderResponse.id, recovery.externalEffectId);

console.log("✓ recovered provider bytes bind the exact authorized historical external effect ID");
console.log("LAW: RECOVERED BYTES MAY NOT BORROW AUTHORITY FROM A DIFFERENT PROVIDER EFFECT.");
console.log("Movie Mentor recovered response effect-binding authority gate: GREEN");
