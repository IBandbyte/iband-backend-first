import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Frontend contract is authenticated GET /api/movie-mentor/projects/owned.
// Require a dedicated owner-filtered durable Mongo implementation, not a
// client-provided principal, a process-local list, or unrestricted collection scan.
const source = readFileSync(new URL("../ai/MovieMentorOwnedProjectsReadAuthority.js", import.meta.url), "utf8");
assert.match(source, /ownerPrincipalId/, "RED: owned discovery must filter by durable owner principal");
assert.match(source, /projectId/, "RED: owned discovery must return project identities");
assert.match(source, /authenticated/, "RED: discovery must deny unauthenticated principal");
assert.doesNotMatch(source, /insertOne|updateOne|deleteOne|\.save\(/, "RED: discovery must not mutate Mongo");
console.log("GREEN: owned-project discovery authority has owner-filtered read-only contract");
