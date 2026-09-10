import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../ai/MovieMentorProjectOwnershipRegistry.js", import.meta.url), "utf8");

console.log("Movie Mentor project ownership physical authority court");

assert.match(source, /schema\.index\(\{ projectId: 1 \}, \{ unique: true \}\)/, "declared projectId uniqueness must exist");
assert.match(source, /schema\.index\(\{ establishmentAuthorityId: 1 \}, \{ unique: true \}\)/, "declared one-time establishment authority uniqueness must exist");
assert.match(source, /connection\.collection\(MOVIE_MENTOR_PROJECT_OWNERSHIP_COLLECTION\)\.indexes\(\)/, "physical authority must inspect actual Mongo index reality");
assert.match(source, /indexMatches\(index, \{ projectId: 1 \}\)/, "physical authority must own projectId uniqueness");
assert.match(source, /indexMatches\(index, \{ establishmentAuthorityId: 1 \}\)/, "physical authority must own establishmentAuthorityId uniqueness");
assert.match(source, /MOVIE_MENTOR_PROJECT_OWNERSHIP_PHYSICAL_AUTHORITY_UNAVAILABLE/, "missing physical authority must fail closed");

const createBoundary = source.slice(source.indexOf("async function createMovieMentorProjectOwnership"), source.indexOf("function createMovieMentorProjectOwnershipAuthority"));
assert.match(createBoundary, /getModel\(\)\.create\(candidate\)/, "production ownership establishment reaches an irreversible durable mint");
const readinessCall = createBoundary.indexOf("await ensureMovieMentorProjectOwnershipPhysicalUniqueIndexReadiness()");
const mintCall = createBoundary.indexOf("getModel().create(candidate)");
assert.ok(readinessCall >= 0, "ownership establishment must prove physical Mongo uniqueness");
assert.ok(mintCall > readinessCall, "physical uniqueness proof must happen before irreversible create()");

const statusBoundary = source.slice(source.indexOf("function getMovieMentorProjectOwnershipRegistryStatus"), source.indexOf("function storeCapabilityProven"));
assert.match(statusBoundary, /physicalUniqueIndexReadiness/, "advertised ownership capability must explicitly own physical-index readiness");

console.log("GREEN: project ownership durable mint owns physical projectId + establishmentAuthorityId uniqueness before create().");
