import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor preserved-credit partial-refund value conservation authority court");

const ingress = fs.readFileSync(new URL("../ai/MovieMentorCommercialProviderIngressAuthority.js", import.meta.url), "utf8");
const disposition = fs.readFileSync(new URL("../ai/MovieMentorProductionCommercialValueDispositionComposition.js", import.meta.url), "utf8");

assert.match(ingress, /reversalAmountMinor:Number\.isSafeInteger\(normalized\.reversalAmountMinor\)\?normalized\.reversalAmountMinor:null/, "verified provider reversal must preserve the provider reversal amount");
assert.match(ingress, /const kind=text\(normalized\.reversalKind\)===["']refund["']\?["']refund["']:["']chargeback["']/, "verified refund must reach refund disposition");

const reversalStart = ingress.indexOf("if(normalized?.commercialReversal===true)");
const reversalEnd = ingress.indexOf("const evidenceAuthority=", reversalStart);
assert.ok(reversalStart >= 0 && reversalEnd > reversalStart, "commercial reversal production path must exist");
const reversal = ingress.slice(reversalStart, reversalEnd);

assert.match(reversal, /terminallySettlePreservedValue/, "verified provider reversal must reach preserved-value settlement");

const passesProviderRefundAmount =
  /terminallySettlePreservedValue\([\s\S]*?(?:reversalAmountMinor|normalized\.reversalAmountMinor)/.test(reversal);
assert.equal(
  passesProviderRefundAmount,
  true,
  "RED: verified partial provider refund carries reversalAmountMinor, but preserved-value settlement is invoked without that partial refund amount."
);

const dispositionStart = disposition.indexOf("async function terminallySettlePreservedValue");
const dispositionEnd = disposition.indexOf("const s=status(true)", dispositionStart);
assert.ok(dispositionStart >= 0 && dispositionEnd > dispositionStart, "terminal preserved-value owner must exist");
const terminal = disposition.slice(dispositionStart, dispositionEnd);

const amountAware =
  /reversalAmountMinor|refundAmountMinor|cumulativeRefundedAmountMinor|remainingAmountMinor/.test(terminal);
assert.equal(
  amountAware,
  true,
  "RED: terminal preserved-value owner has no amount-aware partial-refund state and can only terminalize the whole preserved-value record."
);

console.log("GREEN: verified partial provider refunds conserve exact preserved customer value.");
console.log("LAW: A PARTIAL PROVIDER REFUND MAY EXTINGUISH ONLY THE REFUNDED AMOUNT; UNREFUNDED PRESERVED VALUE MUST REMAIN DURABLE CUSTOMER VALUE.");
