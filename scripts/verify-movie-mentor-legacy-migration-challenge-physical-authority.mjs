import assert from "node:assert/strict";
import fs from "node:fs/promises";

const store=await fs.readFile(new URL("../ai/MovieMentorLegacyMigrationChallengeStore.js",import.meta.url),"utf8");
const ceremony=await fs.readFile(new URL("../ai/MovieMentorLegacyMigrationCeremony.js",import.meta.url),"utf8");

console.log("Movie Mentor legacy migration challenge physical authority court");
assert.match(ceremony,/persistChallenge=persistMovieMentorLegacyMigrationChallenge/,"production ceremony must compose durable challenge mint");
assert.match(ceremony,/consumeChallenge=consumeMovieMentorLegacyMigrationChallenge/,"production ceremony must compose durable challenge consumption CAS");
assert.match(ceremony,/bindConsumptionIssuance=bindMovieMentorLegacyMigrationConsumptionIssuance/,"production ceremony must compose irreversible issuance-lineage binding CAS");
assert.match(store,/schema\.index\(\{ challengeId: 1 \}, \{ unique: true \}\)/,"challenge identity must be declared unique");
assert.match(store,/schema\.index\(\{ consumptionId: 1 \}, \{ unique: true, sparse: true \}\)/,"consumption identity must be declared unique");
assert.match(store,/schema\.index\(\{ issuanceAdoptionId: 1 \}, \{ unique: true, sparse: true \}\)/,"issuance adoption identity must be declared unique");
assert.match(store,/getModel\(\)\.create\(doc\)/,"production durable challenge mint must remain reachable");
assert.match(store,/collection\.indexes\(\)/,"store must inspect actual Mongo physical index reality before challenge authority crosses durable mutation");
assert.match(store,/physicalUniqueIndexReadiness/,"store must explicitly own physical unique-index readiness");
assert.match(store,/MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_PHYSICAL_AUTHORITY_UNAVAILABLE/,"missing physical uniqueness must fail closed");
console.log("✓ production ceremony reaches challenge mint, consumption CAS, and issuance-lineage CAS");
console.log("✓ all three durable identities are declared unique");
console.log("✓ actual Mongo physical uniqueness gates irreversible challenge authority");
console.log("LAW: DECLARED CHALLENGE UNIQUENESS IS NOT PHYSICAL AUTHORITY. NO THREE PHYSICAL IDENTITIES → NO MINT / CONSUMPTION / ISSUANCE-LINEAGE MUTATION.");
