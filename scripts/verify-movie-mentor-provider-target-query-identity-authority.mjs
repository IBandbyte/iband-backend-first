import assert from "node:assert/strict";
import {
  fingerprintMovieMentorProviderRoute,
  sanitizeProviderRoute,
} from "../ai/MovieMentorProviderTargetAuthority.js";

console.log("Movie Mentor provider target query-identity authority court");

const provider = "generic-http";
const base = "https://provider.example.test/v1/generate";
const deploymentA = `${base}?deployment=A&api-version=2032-01-01&transient_secret=one`;
const deploymentB = `${base}?deployment=B&api-version=2032-01-01&transient_secret=two`;
const versionB = `${base}?deployment=A&api-version=2032-06-01&transient_secret=three`;
const sameSemanticDifferentSecret = `${base}?api-version=2032-01-01&transient_secret=rotated&deployment=A`;
const sameSemanticReordered = `${base}?deployment=A&transient_secret=another&api-version=2032-01-01`;

const fingerprintA = fingerprintMovieMentorProviderRoute(provider, deploymentA);
const fingerprintDeploymentB = fingerprintMovieMentorProviderRoute(provider, deploymentB);
const fingerprintVersionB = fingerprintMovieMentorProviderRoute(provider, versionB);
const fingerprintSecretRotation = fingerprintMovieMentorProviderRoute(provider, sameSemanticDifferentSecret);
const fingerprintReordered = fingerprintMovieMentorProviderRoute(provider, sameSemanticReordered);

assert.notEqual(
  fingerprintA,
  fingerprintDeploymentB,
  "a semantic deployment query change must produce a different provider target identity",
);
assert.notEqual(
  fingerprintA,
  fingerprintVersionB,
  "a semantic API-version query change must produce a different provider target identity",
);
assert.equal(
  fingerprintA,
  fingerprintSecretRotation,
  "credential rotation must not manufacture provider route drift",
);
assert.equal(
  fingerprintA,
  fingerprintReordered,
  "query ordering must not manufacture provider route drift",
);

const sanitized = sanitizeProviderRoute(deploymentA);
assert.equal(sanitized.includes("transient_secret"), false, "credential-like query keys must not survive route sanitization");
assert.equal(sanitized.includes("one"), false, "credential-like query values must not survive route sanitization");
assert.equal(sanitized.includes("deployment=A"), true, "semantic deployment identity must survive sanitization");
assert.equal(sanitized.includes("api-version=2032-01-01"), true, "semantic API-version identity must survive sanitization");

console.log("✓ semantic deployment changes alter provider target identity");
console.log("✓ semantic API-version changes alter provider target identity");
console.log("✓ transient credential rotation does not alter provider target identity");
console.log("✓ query ordering does not alter provider target identity");
console.log("✓ durable route identity preserves semantics while excluding credential-like query material");
console.log("LAW: SECRETS MUST NOT ENTER IDENTITY. SEMANTICS MUST NOT BE ERASED FROM IDENTITY.");
console.log("Movie Mentor provider target query-identity authority: GREEN");
