import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../ai/MovieMentorProjectOwnershipRegistry.js", import.meta.url), "utf8");

console.log("Movie Mentor project ownership physical authority court");

assert.match(source, /schema\.index\(\{ projectId: 1 \}, \{ unique: true \}\)/, "declared projectId uniqueness must exist");
assert.match(source, /schema\.index\(\{ establishmentAuthorityId: 1 \}, \{ unique: true \}\)/, "declared one-time establishment authority uniqueness must exist");

const createBoundary = source.slice(source.indexOf("async function createMovieMentorProjectOwnership"), source.indexOf("function createMovieMentorProjectOwnershipAuthority"));
assert.match(createBoundary, /getModel\(\)\.create\(candidate\)/, "production ownership establishment reaches an irreversible durable mint");
assert.ok(!/collection\.indexes\(|readPhysicalIndexes|physicalUniqueIndexReadiness|syncIndexes\(|createIndexes\(/.test(createBoundary), "RED: ownership establishment crosses durable mint without proving physical Mongo uniqueness first");

const statusBoundary = source.slice(source.indexOf("function getMovieMentorProjectOwnershipRegistryStatus"), source.indexOf("function storeCapabilityProven"));
assert.ok(!/physicalUniqueIndexReadiness|physicalAuthority/.test(statusBoundary), "RED: advertised ownership capability borrows declared schema uniqueness without physical-index reality proof");

console.log("RED expected before repair: project ownership durable mint must own physical projectId + establishmentAuthorityId uniqueness before create().");
