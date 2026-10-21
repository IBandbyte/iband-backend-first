// AUD-OPEN-01 verifier-only settlement return-path contract inventory.
// Source guard, not a physical ownership repair or dynamic caller certification.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const authority=await readFile("ai/MovieMentorProductionCommercialValueDispositionComposition.js","utf8");
const ingress=await readFile("ai/MovieMentorCommercialProviderIngressAuthority.js","utf8");
const recovery=await readFile("ai/MovieMentorCompletedChargebackRecovery.js","utf8");
const start=authority.indexOf("async function terminallySettlePreservedValue(");
const end=authority.indexOf("const s=status(true),authority=",start);
assert(start>=0&&end>start,"settlement function boundaries must remain discoverable");
const body=authority.slice(start,end);
const cases=[
 ["no-ledger-row",/if\(!row\)return Object\.freeze\(\{authorized:true,status:"not-preserved"/],
 ["refund-idempotent",/if\(refundAmountMinor<=previous\)return settlementResult(existing,false)/],
 ["refund-cas-loser-retry",/if\(!updated\)return terminallySettlePreservedValue\(input\)/],
 ["refund-cas-winner",/return normalize\(updated\)/],
 ["chargeback-event-replay",/if\(prior\)\{[^}]*return settlementResult(existing,false);/],
 ["terminal-replay",/if\(existing\.status===target&&existing\.terminalDisposition===kind&&existing\.terminalReference===reference\)return settlementResult(existing,false)/],
 ["chargeback-cas-guard",/chargebackEvents:\{\$not:\{\$elemMatch:\{reference\}\}\}/],
 ["chargeback-cas-winner",/const updated=await M\.findOneAndUpdate\(\{\.\.\.q,status:"preserved-credit",\.\.\.chargebackCas\}/]
];
for(const [name,pattern] of cases)assert.match(body,pattern,"Return-path source contract changed: "+name);
assert.equal((body.match(/if\(!updated\)return terminallySettlePreservedValue\(input\)/g)||[]).length,2,"refund and chargeback CAS retry paths must both remain visible");
assert.equal((body.match(/return normalize\(updated\)/g)||[]).length,2,"both CAS-winning return paths must remain visible");
assert.match(ingress,/await dispositionAuthority\.terminallySettlePreservedValue\(/,"ingress invocation must remain visible");
assert.match(recovery,/await dispositionAuthority\.terminallySettlePreservedValue\(/,"recovery invocation must remain visible");
assert.match(recovery,/settled\+\+/,"recovery currently counts confirmed observation rather than ownership");
assert.doesNotMatch(body,/\bapplied\s*:/,"current authority has no ownership return contract");
console.log("AUD-OPEN-01 RETURN PATH INVENTORY GREEN",JSON.stringify({cases:cases.map(x=>x[0]),casRetryPaths:2,casWinnerReturns:2,ingressConsumesReturn:false,recoveryOwnerAccountingProven:"physical verifier required",scope:"exact-head source shape only; ownership repair and compatibility remain RED/unproven"}));
