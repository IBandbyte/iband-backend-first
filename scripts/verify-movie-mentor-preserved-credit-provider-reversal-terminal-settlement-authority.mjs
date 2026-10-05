import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor preserved-credit provider-reversal terminal-settlement authority court");

const ingress=fs.readFileSync(new URL("../ai/MovieMentorCommercialProviderIngressAuthority.js",import.meta.url),"utf8");
const disposition=fs.readFileSync(new URL("../ai/MovieMentorProductionCommercialValueDispositionComposition.js",import.meta.url),"utf8");

assert.match(disposition,/providerPaymentReference/,"preserved value must be durably keyed to provider payment identity");
assert.match(disposition,/terminallySettlePreservedValue/,"preserved value must expose its owned terminal-settlement operation");
assert.match(ingress,/normalized\?\.commercialReversal===true/,"production provider ingress must expose the signed commercial-reversal path");
assert.match(ingress,/resolveCheckoutBindingByProviderPaymentReference\(\{provider:selectedProvider,providerPaymentReference:paymentReference\}\)/,"commercial reversal must resolve exact provider-payment lineage");

const reversalBranch=ingress.slice(
 ingress.indexOf("if(normalized?.commercialReversal===true)"),
 ingress.indexOf("const evidenceAuthority=createMovieMentorCommercialPaymentEvidenceAuthority")
);
assert.ok(reversalBranch.length>0,"commercial reversal branch must be isolatable");
assert.match(reversalBranch,/suspendVerifiedReversal/,"same-payment provider reversal must reach durable reversal authority");

const settlesPreservedValue=/terminallySettlePreservedValue/.test(reversalBranch);
assert.equal(
 settlesPreservedValue,
 true,
 "RED: a signed provider refund/dispute can resolve the same durable providerPaymentReference and execute commercial reversal without terminally settling the preserved-credit record for that payment."
);

console.log("GREEN: same-payment provider reversal terminally settles preserved customer value.");
console.log("LAW: EXTERNAL REFUND OR CHARGEBACK REALITY MUST NOT COEXIST WITH REDEEMABLE PRESERVED CREDIT FOR THE SAME PROVIDER PAYMENT.");
