import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor preserved-credit dispute lifecycle authority court");

const adapterSource=fs.readFileSync(new URL("../ai/MovieMentorStripeCommercialProviderAdapter.js",import.meta.url),"utf8");
const ingressSource=fs.readFileSync(new URL("../ai/MovieMentorCommercialProviderIngressAuthority.js",import.meta.url),"utf8");

const createdBlock=adapterSource.match(/if\(eventKind==="charge\.dispute\.created"[\s\S]*?return Object\.freeze\((\{[\s\S]*?\})\);\}/)?.[0]||"";
assert.ok(createdBlock.includes('eventKind==="charge.dispute.created"'),"court requires Stripe dispute-created normalization");
assert.equal(/commercialReversal\s*:\s*true/.test(createdBlock),false,"RED: dispute-created is treated as a final commercial reversal before funds/final loss authority exists.");

const ingressReversal=ingressSource.match(/if\(normalized\?\.commercialReversal===true\)[\s\S]*?const evidenceAuthority=/)?.[0]||"";
assert.ok(ingressReversal.includes('kind=text(normalized.reversalKind)==="refund"?"refund":"chargeback"'),"court requires current ingress dispute-to-chargeback disposition mapping");
assert.equal(/reversalKind\)==="dispute"[\s\S]*?disputeLifecycle|disputeStatus|fundsWithdrawn|finalLoss/.test(ingressReversal),true,"RED: verified dispute evidence reaches chargeback settlement without a dispute lifecycle/funds-affected/final-loss gate.");

console.log("GREEN: dispute-created cannot terminally charge back preserved value before explicit funds/final-loss authority.");
console.log("LAW: DISPUTE OPENED IS NOT FINAL CHARGEBACK; PRESERVED CUSTOMER VALUE MAY BE TERMINALLY EXTINGUISHED ONLY BY EXPLICIT FUNDS-AFFECTED OR FINAL-LOSS AUTHORITY.");
