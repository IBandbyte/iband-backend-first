import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor preserved-credit partial-refund chargeback exact-value authority court");

const ingress=fs.readFileSync(new URL("../ai/MovieMentorCommercialProviderIngressAuthority.js",import.meta.url),"utf8");
const adapter=fs.readFileSync(new URL("../ai/MovieMentorStripeCommercialProviderAdapter.js",import.meta.url),"utf8");
const disposition=fs.readFileSync(new URL("../ai/MovieMentorProductionCommercialValueDispositionComposition.js",import.meta.url),"utf8");

assert.match(adapter,/charge\.dispute\.funds_withdrawn/,"court requires Stripe funds-withdrawn production evidence");
assert.match(adapter,/reversalAmountMinor:Number\.isSafeInteger\(object\.amount\)\?object\.amount:null/,"Stripe adapter must preserve exact disputed/withdrawn amount");
assert.match(ingress,/reversalAmountMinor:Number\.isSafeInteger\(normalized\.reversalAmountMinor\)\?normalized\.reversalAmountMinor:null/,"provider ingress must preserve reversal amount in verified history");
assert.match(disposition,/cumulativeRefundedAmountMinor/,"court requires cumulative partial-refund accounting");
assert.match(disposition,/remainingAmountMinor/,"court requires remaining preserved-value accounting");

const settlementCall=ingress.match(/terminallySettlePreservedValue\(\{[^}]+\}\)/s)?.[0]||"";
assert.ok(settlementCall,"production reversal path must reach preserved-value settlement");
assert.match(settlementCall,/refundAmountMinor:kind==="refund"\?normalized\.reversalAmountMinor:null/,"refund path must carry exact provider amount");
assert.doesNotMatch(settlementCall,/chargebackAmountMinor|reversalAmountMinor:normalized\.reversalAmountMinor/,"RED: funds-withdrawn exact amount is dropped when production calls chargeback settlement");

assert.fail("RED: Stripe funds-withdrawn carries exact disputed value, but production chargeback settlement receives no exact chargeback amount and can collapse a partially-refunded preserved row without value-specific authority.");
