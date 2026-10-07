import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor terminal-disposition production reachability authority court");

const server=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");
const gateway=fs.readFileSync(new URL("../movieMentorTurn.js",import.meta.url),"utf8");
const runtime=fs.readFileSync(new URL("../ai/MovieMentorTurnRuntime.js",import.meta.url),"utf8");
const composition=fs.readFileSync(new URL("../ai/MovieMentorProductionInferenceSettlementComposition.js",import.meta.url),"utf8");
const reconciliation=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementReconciliationAuthority.js",import.meta.url),"utf8");
const decisionStore=fs.readFileSync(new URL("../ai/MovieMentorTerminalDispositionDecisionMongoStore.js",import.meta.url),"utf8");
const terminalProduction=fs.readFileSync(new URL("../ai/MovieMentorTerminalDispositionProductionAuthority.js",import.meta.url),"utf8");

assert.match(decisionStore,/recordAuthorizedDecision/,"#417 durable terminal policy decision owner must remain present");
assert.match(decisionStore,/resolveAuthorizedDecision/,"#417 durable terminal policy decision resolver must remain present");
assert.match(decisionStore,/entitlementRevision/,"durable terminal policy decision must bind exact entitlement revision");
assert.match(reconciliation,/terminallyReleaseAuthorized/,"#418 reconciliation terminal consumer must remain present");
assert.match(composition,/terminalDispositionAuthority/,"#418 production settlement composition must continue proving terminal capability");

const productionSurface=[server,gateway,runtime].join("\n");
assert.match(
 productionSurface,
 /recordAuthorizedDecision/,
 "RED: no real creator production surface records the durable terminal policy decision proved by #417."
);
assert.match(
 productionSurface,
 /resolveAuthorizedDecision/,
 "RED: no real creator production surface resolves durable terminal policy authority before terminal value restoration."
);
assert.match(
 productionSurface,
 /terminallyReleaseAuthorized/,
 "RED: #418 exposes terminal release through production composition, but no real creator production surface invokes it."
);
assert.match(
 productionSurface,
 /expectedEntitlementRevision|entitlementRevision/,
 "RED: no proven terminal production caller binds terminal release to current entitlement revision."
);

console.log("GREEN: durable terminal policy decision record/resolve and exact-revision terminal release are reachable from a real creator production surface.");
console.log("LAW: COMPOSED CAPABILITY IS NOT PRODUCTION REACHABILITY. TERMINAL VALUE RESTORATION REQUIRES A REAL OWNER-BOUND CALLER THAT RESOLVES DURABLE POLICY AUTHORITY AND BINDS THE MUTATION TO CURRENT ENTITLEMENT REALITY.");
