import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../ai/MovieMentorProjectOwnershipRegistry.js", import.meta.url), "utf8");

console.log("Movie Mentor project ownership physical authority court");

assert.match(source, /schema\.index\(\{ projectId: 1 \}, \{ unique: true \}\)/, "declared projectId uniqueness must exist");
assert.match(source, /schema\.index\(\{ establishmentAuthorityId: 1 \}, \{ unique: true \}\)/, "declared one-time establishment authority uniqueness must exist");

const createBoundary = source.slice(source.indexOf("async function createMovieMentorProjectOwnership"), source.indexOf("function createMovieMentorProjectOwnershipAuthority"));
assert.match(createBoundary, /getModel\(\)\.create\(candidate\)/, "production ownership establishment reaches an irreversible durable mint");
assert.match(createBoundary, /physicalUniqueIndexReadiness|assertPhysicalUniqueIndexes|ensurePhysicalUniqueIndexes/, "ownership establishment must prove physical Mongo uniqueness before irreversible create()");

const statusBoundary = source.slice(source.indexOf("function getMovieMentorProjectOwnershipRegistryStatus"), source.indexOf("function storeCapabilityProven"));
assert.match(statusBoundary, /physicalUniqueIndexReadiness/, "advertised ownership capability must explicitly own physical-index readiness");

console.log("GREEN: project ownership durable mint owns physical projectId + establishmentAuthorityId uniqueness before create().");
