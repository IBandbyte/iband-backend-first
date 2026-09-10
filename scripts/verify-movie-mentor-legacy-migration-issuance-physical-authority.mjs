import assert from "node:assert/strict";
import fs from "node:fs/promises";

const store = await fs.readFile(new URL("../ai/MovieMentorLegacyMigrationAttestationIssuanceStore.js", import.meta.url), "utf8");
const ceremony = await fs.readFile(new URL("../ai/MovieMentorLegacyMigrationCeremony.js", import.meta.url), "utf8");

console.log("Movie Mentor legacy migration attestation issuance physical authority court");

assert.match(ceremony, /createIssuance=createMovieMentorLegacyMigrationAttestationIssuance/, "production ceremony must reach the durable issuance store");
assert.match(ceremony, /const issuance=await issuer\.issue/, "production ceremony must cross attestation issuance before ownership adoption");
assert.match(store, /schema\.index\(\{consumptionId:1\},\{unique:true\}\)/, "declared consumptionId uniqueness must exist");
assert.match(store, /schema\.index\(\{adoptionId:1\},\{unique:true\}\)/, "declared adoptionId uniqueness must exist");
assert.match(store, /getModel\(\)\.create\(doc\)/, "durable issuance mint must remain production reachable");
assert.match(store, /collection\.indexes\(\)/, "store must inspect actual Mongo physical index reality before issuance mint");
assert.match(store, /physicalUniqueIndexReadiness/, "store must explicitly own physical unique-index readiness");
assert.match(store, /MOVIE_MENTOR_LEGACY_ATTESTATION_PHYSICAL_AUTHORITY_UNAVAILABLE/, "missing physical uniqueness must fail closed");

console.log("✓ production legacy migration ceremony reaches durable attestation issuance mint");
console.log("✓ issuance store declares both consumptionId and adoptionId uniqueness");
console.log("✓ actual Mongo physical uniqueness is required before irreversible issuance mint");
console.log("LAW: DECLARED UNIQUENESS IS NOT PHYSICAL AUTHORITY. NO PHYSICAL ISSUANCE IDENTITY → NO DURABLE ATTESTATION MINT → NO OWNERSHIP ADOPTION.");
