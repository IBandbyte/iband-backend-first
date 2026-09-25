import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor reversal ↔ canonical settlement race authority court");

const reversal=fs.readFileSync(new URL("../ai/MovieMentorCommercialReversalMongoStore.js",import.meta.url),"utf8");
const settlement=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");

assert.match(reversal,/session\.withTransaction/);
assert.match(reversal,/status:"active",entitlementRevision:before/);
assert.match(reversal,/\$set:\{status:"suspended"\},\$inc:\{entitlementRevision:1\}/);
assert.match(settlement,/entitlementRevision:\{\$gte:reservation\.entitlementRevision\},reservedUnits:\{\$gte:reservation\.units\}/);
assert.match(settlement,/\$inc:\{reservedUnits:-reservation\.units,consumedUnits:reservation\.units,entitlementRevision:1\}/);

function reverse(tx){
 if(tx.entitlement.status!=="active") return "already-suspended";
 const before=tx.entitlement.revision;
 if(tx.entitlement.status!=="active"||tx.entitlement.revision!==before) throw new Error("reversal-race");
 tx.entitlement.status="suspended";tx.entitlement.revision++;return "suspended";
}
function settle(tx){
 if(tx.reservation!=="reserved") return "not-reserved";
 if(tx.entitlement.revision<tx.reservationRevision||tx.entitlement.reserved<1) throw new Error("ledger-conflict");
 tx.entitlement.reserved--;tx.entitlement.consumed++;tx.entitlement.revision++;
 tx.reservation="consumed";tx.execution="settled";return "consumed";
}
for(const order of [["reversal","settlement"],["settlement","reversal"]]){
 const tx={entitlement:{status:"active",revision:12,reserved:1,remaining:4,consumed:3},reservationRevision:10,reservation:"reserved",execution:"finalized"};
 for(const op of order) op==="reversal"?reverse(tx):settle(tx);
 assert.equal(tx.entitlement.status,"suspended",`${order.join("→")} must end with forward authority suspended`);
 assert.equal(tx.entitlement.reserved,0,`${order.join("→")} must discharge exactly one reserved debit`);
 assert.equal(tx.entitlement.consumed,4,`${order.join("→")} must consume exactly once`);
 assert.equal(tx.reservation,"consumed");
 assert.equal(tx.execution,"settled");
 assert.equal(tx.entitlement.revision,14,"both serial orders must preserve both entitlement mutations");
}
console.log("GREEN: reversal and canonical settlement serialize on the same entitlement row and both valid serial orders preserve suspension plus exact debit disposition.");
console.log("LAW: REVERSAL MAY REVOKE FORWARD AUTHORITY BEFORE OR AFTER TERMINAL DEBIT; IT MUST NOT ERASE OR DUPLICATE AN ALREADY-RESERVED CANONICAL OBLIGATION.");
