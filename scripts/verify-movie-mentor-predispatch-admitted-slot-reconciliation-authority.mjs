import assert from "node:assert/strict";
import fs from "node:fs";
import { createMovieMentorProviderOutcomeRecoveryAuthority } from "../ai/MovieMentorProviderOutcomeRecoveryAuthority.js";

const runtime = fs.readFileSync(new URL("../ai/MovieMentorTurnRuntime.js", import.meta.url), "utf8");
const settlement = fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js", import.meta.url), "utf8");

const claim = runtime.indexOf("claimProviderCall({ execution, slotId, task })");
const bind = runtime.indexOf("bindProviderReconstructionInput({", claim);
const begin = runtime.indexOf("beginProviderDispatch({ providerCall: decision })", bind);
const network = runtime.indexOf("providerFunction({ providerOperation }", begin);
assert.ok(claim >= 0 && bind > claim && begin > bind && network > begin,
  "production chronology must prove claim -> durable input/operation -> UNKNOWN -> network");

assert.match(settlement, /providerCallsClaimed!==0\|\|\(execution\.providerCalls\|\|\[\]\)\.length!==0/);
assert.match(settlement, /reason:"provider-call-claims-exist"/);

const recovery = createMovieMentorProviderOutcomeRecoveryAuthority({
  readProviderOperation: async () => null,
  readProviderEffectReality: async () => null,
  recoverProviderResponse: async () => { throw new Error("network recovery must not run without a durable operation"); },
});

const decision = await recovery.reconcile({ providerCallId: "provider-call-crash-before-operation" });
assert.equal(decision.outcome, "STILL_UNKNOWN");
assert.equal(decision.reason, "provider-operation-not-found");
assert.equal(decision.redispatchAuthorized, false);

// Court law: because production requires the durable provider operation and UNKNOWN
// before network I/O, their durable absence proves this admitted claim never reached
// the irreversible provider boundary. The system must therefore expose a durable,
// atomic reconciliation path that can retire the orphan claim and restore its
// reservation without permitting redispatch.
//
// RED today: recovery refuses refund and releaseUnclaimed refuses every claimed
// execution, so the reservation has no convergent economic terminal state.
assert.equal(
  decision.refundAuthorized,
  true,
  "admitted claim with no durable provider operation/effect must have a safe durable abandonment/refund authority",
);

console.log("5A.?? pre-dispatch admitted-slot reconciliation authority: GREEN");
console.log("LAW: a durable claim that provably never reached durable operation/UNKNOWN must converge without duplicate dispatch or stranded creator value.");
