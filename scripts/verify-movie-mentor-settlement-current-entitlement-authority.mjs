import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
console.log("Movie Mentor Settlement Current Entitlement authority court");

const canonical=source.slice(source.indexOf("async function settleCanonicalResult"),source.indexOf("async function releaseUnclaimedReservation"));
const unclaimed=source.slice(source.indexOf("async function releaseUnclaimedReservation"),source.indexOf("async function releaseUnboundReservation"));
const unbound=source.slice(source.indexOf("async function releaseUnboundReservation"),source.indexOf("async function compensateSupersededCreatorState"));

assert.match(canonical,/entitlements\.findOneAndUpdate\(\{[^}]*entitlementRevision:\{\$gte:reservation\.entitlementRevision\}[^}]*reservedUnits:\{\$gte:reservation\.units\}/,"FINALIZED canonical consumption must prove the debit still belongs to the durable reservation chronology; it may not consume unrelated current entitlement value.");
assert.doesNotMatch(canonical,/entitlements\.findOneAndUpdate\(\{[^}]*status:"active"/,"FINALIZED is already terminal debit authority: later suspension may revoke forward commercial authority but cannot strand that owned debit.");
assert.doesNotMatch(unclaimed,/entitlements\.findOneAndUpdate\(\{[^}]*status:"active"/,"Release is restitution, not new spend authority: unclaimed release must remain capable of restoring already-reserved Creator value after suspension.");
assert.doesNotMatch(unbound,/entitlements\.findOneAndUpdate\(\{[^}]*status:"active"/,"Release is restitution, not new spend authority: unbound release must remain capable of restoring already-reserved Creator value after suspension.");

console.log("GREEN: FINALIZED canonical debit is fenced to its durable reservation chronology; release paths remain restitution-capable under suspension.");
console.log("LAW: CURRENT ACTIVE ENTITLEMENT GOVERNS NEW/FORWARD COMMERCIAL AUTHORITY; A LEGITIMATELY FINALIZED RESULT OWNS ITS EXISTING RESERVATION DEBIT, AND SUSPENSION MAY NOT ORPHAN IT.");
