import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

// AUD-OPEN-01 verifier-first source contract only.
// This court must not be confused with a physical startup/lease certification.
const startup=await readFile("ai/MovieMentorProductionCommercialHttpIngress.js","utf8");
const recovery=await readFile("ai/MovieMentorCompletedChargebackRecovery.js","utf8");
const disposition=await readFile("ai/MovieMentorProductionCommercialValueDispositionComposition.js","utf8");
const ingress=await readFile("ai/MovieMentorCommercialProviderIngressAuthority.js","utf8");
assert.match(startup,/await recoverMovieMentorCompletedChargebacks\s*\(/,"startup recovery call must be visible");
assert.match(startup,/completed-reversal-recovery-failed/,"genuine recovery errors must preserve fail-closed mount");
assert.match(startup,/app\.post\(STRIPE_WEBHOOK_PATH/,"signed Stripe ingress route must remain present");
assert.match(recovery,/async function scanCompletedChargebacks/,"recovery entry point must remain present");
assert.match(recovery,/listCompletedReversalReceipts/,"durable receipt discovery must remain present");
assert.match(disposition,/async function terminallySettlePreservedValue/,"real financial writer must remain present");
assert.match(ingress,/verifyDelivery/,"provider verification path must remain present");
console.log("AUD STARTUP OUTCOME SOURCE CONTRACT GREEN: entry points and fail-closed path remain visible; healthy non-owner, lease ownership, signed ingress and physical financial effects are NOT certified.");
