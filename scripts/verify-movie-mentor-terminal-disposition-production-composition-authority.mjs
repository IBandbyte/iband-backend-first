import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor terminal-disposition production composition authority court");

const physical=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementPhysicalAuthority.js",import.meta.url),"utf8");
const reconciliation=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementReconciliationAuthority.js",import.meta.url),"utf8");
const production=fs.readFileSync(new URL("../ai/MovieMentorProductionInferenceSettlementComposition.js",import.meta.url),"utf8");
const store=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");

assert.match(store,/terminallyReleaseAuthorizedReservation/,"#417 durable settlement store primitive must remain present");
assert.match(store,/status:"suspended",entitlementRevision:expectedEntitlementRevision/,"#417 terminal release must remain exact-revision fenced");
assert.match(store,/terminalDispositionDecisionId:decisionId/,"#417 terminal release must preserve durable decision identity on the reservation");

assert.match(
 physical,
 /terminallyReleaseAuthorizedReservation/,
 "RED: the owner-proven physical settlement authority does not delegate the #417 terminal-disposition primitive, so production cannot prove physical readiness before terminal value restoration."
);

assert.match(
 reconciliation,
 /terminallyReleaseAuthorizedReservation|terminallyReleaseAuthorized/,
 "RED: settlement reconciliation exposes no terminal-policy disposition consumer, so durable #417 policy authority has no reconciliation-owned production path."
);

assert.match(
 production,
 /terminallyReleaseAuthorizedReservation|terminalDisposition/,
 "RED: production inference-settlement composition does not prove or expose terminal-disposition authority across its owner-bound production chain."
);

console.log("GREEN: #417 terminal disposition is carried through physical readiness, reconciliation ownership, and production composition without borrowing preserved-credit authority.");
console.log("LAW: A SAFE LEDGER PRIMITIVE IS NOT PRODUCTION AUTHORITY. TERMINAL VALUE DISPOSITION MUST CROSS THE SAME OWNER-PROVEN PHYSICAL AND RECONCILIATION COMPOSITION BOUNDARIES AS THE VALUE IT MUTATES.");
