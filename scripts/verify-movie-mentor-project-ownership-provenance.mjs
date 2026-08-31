import assert from "node:assert/strict";
import {
  createMovieMentorProjectOwnershipAuthority,
  getMovieMentorProjectOwnershipRegistryStatus,
} from "../ai/MovieMentorProjectOwnershipRegistry.js";
import { createMovieMentorCreatorRequestAuthority } from "../ai/MovieMentorCreatorRequestAuthority.js";

console.log("Round Seven — project ownership three-layer provenance torture");

const AUTHORITY_DOMAIN = "iband.movie-mentor.project-ownership-authority";
const STORE_DOMAIN = "iband.movie-mentor.project-ownership-store";

function principalAdapter(principalId = "creator-1") {
  return async () => Object.freeze({
    authenticated: true,
    principalId,
    authenticationSource: "test-principal",
  });
}

function exactAuthorityStatus(overrides = {}) {
  return Object.freeze({
    version: "test",
    domain: AUTHORITY_DOMAIN,
    configured: true,
    readiness: "store-proven",
    durable: true,
    authorization: "durable-owner-match",
    createOnce: true,
    projectUnique: true,
    establishmentAuthorityUnique: true,
    legacyAdoption: "certified-attestation-only",
    ownershipTransfer: false,
    processLocalFallback: false,
    ...overrides,
  });
}

function creatorWith(ownershipAuthority) {
  return createMovieMentorCreatorRequestAuthority({
    verifyCredential: async () => ({ verified: true }),
    derivePrincipal: principalAdapter(),
    ownershipAuthority,
  });
}

function grantingAuthority({ status = exactAuthorityStatus(), getStatus = true } = {}) {
  const authority = {
    async authorizeProject({ projectId }) {
      return Object.freeze({
        authorized: true,
        projectId,
        ownershipRef: `ownership:${projectId}`,
        ownershipRevision: 1,
        authorizationSource: "test-project-ownership",
      });
    },
  };
  if (getStatus) authority.getStatus = () => status;
  return authority;
}

// Method shape alone may deny, but can never grant creator authority.
await assert.rejects(
  () => creatorWith(grantingAuthority({ getStatus: false })).authorize({ request: {}, projectId: "project-method-only" }),
  (error) => error?.code === "MOVIE_MENTOR_CREATOR_OWNERSHIP_CAPABILITY_NOT_PROVEN"
);

// Deceptive configured status without the exact durable contract grants zero authority.
await assert.rejects(
  () => creatorWith(grantingAuthority({ status: { configured: true, readiness: "injected" } })).authorize({ request: {}, projectId: "project-deceptive" }),
  (error) => error?.code === "MOVIE_MENTOR_CREATOR_OWNERSHIP_CAPABILITY_NOT_PROVEN"
);

// An otherwise complete proof with process-local fallback still grants zero authority.
await assert.rejects(
  () => creatorWith(grantingAuthority({ status: exactAuthorityStatus({ processLocalFallback: true }) })).authorize({ request: {}, projectId: "project-local" }),
  (error) => error?.code === "MOVIE_MENTOR_CREATOR_OWNERSHIP_CAPABILITY_NOT_PROVEN"
);

// Uncertain/throwing provenance fails closed.
const throwing = grantingAuthority();
throwing.getStatus = () => { throw new Error("status unavailable"); };
await assert.rejects(
  () => creatorWith(throwing).authorize({ request: {}, projectId: "project-uncertain" }),
  (error) => error?.code === "MOVIE_MENTOR_CREATOR_OWNERSHIP_CAPABILITY_NOT_PROVEN"
);

// A method-shaped authority may still deny without being promoted to trusted authority.
const denying = { async authorizeProject({ projectId }) { return { authorized: false, projectId, reason: "principal-not-owner" }; } };
await assert.rejects(
  () => creatorWith(denying).authorize({ request: {}, projectId: "project-denied" }),
  (error) => error?.code === "MOVIE_MENTOR_CREATOR_PROJECT_NOT_AUTHORIZED"
);

// Exact owner-proven authority preserves legitimate creator authorization.
const legitimate = await creatorWith(grantingAuthority()).authorize({ request: {}, projectId: "project-legitimate" });
assert.equal(legitimate.authorized, true);
assert.equal(legitimate.projectId, "project-legitimate");
assert.equal(legitimate.ownershipRevision, 1);

// Raw injected read/create functions remain useful for unit torture but own no production durability proof.
const injectedAuthority = createMovieMentorProjectOwnershipAuthority({
  readOwnership: async ({ projectId }) => ({
    domain: "iband.movie-mentor.project-ownership",
    schema: 1,
    projectId,
    ownerPrincipalId: "creator-1",
    ownershipRevision: 1,
    ownershipReference: `ownership:${projectId}`,
    establishmentAuthorityId: "test-establishment",
    establishmentSource: "test",
    status: "active",
  }),
  createOwnership: async (record) => record,
});
const injectedStatus = injectedAuthority.getStatus();
assert.equal(injectedStatus.domain, AUTHORITY_DOMAIN);
assert.equal(injectedStatus.configured, false);
assert.equal(injectedStatus.durable, false);
assert.equal(injectedStatus.processLocalFallback, true);
await assert.rejects(
  () => creatorWith(injectedAuthority).authorize({ request: {}, projectId: "project-injected-functions" }),
  (error) => error?.code === "MOVIE_MENTOR_CREATOR_OWNERSHIP_CAPABILITY_NOT_PROVEN"
);

// The module-owned Mongo store publishes the proof it owns; configuration is still required.
const previousMongoUri = process.env.MONGO_URI;
const previousMongodbUri = process.env.MONGODB_URI;
try {
  delete process.env.MONGO_URI;
  delete process.env.MONGODB_URI;
  const absent = getMovieMentorProjectOwnershipRegistryStatus();
  assert.equal(absent.domain, STORE_DOMAIN);
  assert.equal(absent.configured, false);
  assert.equal(absent.durable, true);
  assert.equal(absent.processLocalFallback, false);

  process.env.MONGO_URI = "mongodb://127.0.0.1:27017/movie-mentor-provenance-test";
  const configured = getMovieMentorProjectOwnershipRegistryStatus();
  assert.equal(configured.domain, STORE_DOMAIN);
  assert.equal(configured.configured, true);
  assert.equal(configured.storage, "mongodb");
  assert.equal(configured.projectUnique, true);
  assert.equal(configured.establishmentAuthorityUnique, true);
  assert.equal(configured.processLocalFallback, false);

  const productionAuthority = createMovieMentorProjectOwnershipAuthority();
  const productionStatus = productionAuthority.getStatus();
  assert.equal(productionStatus.domain, AUTHORITY_DOMAIN);
  assert.equal(productionStatus.configured, true);
  assert.equal(productionStatus.durable, true);
  assert.equal(productionStatus.authorization, "durable-owner-match");
  assert.equal(productionStatus.processLocalFallback, false);
} finally {
  if (previousMongoUri === undefined) delete process.env.MONGO_URI; else process.env.MONGO_URI = previousMongoUri;
  if (previousMongodbUri === undefined) delete process.env.MONGODB_URI; else process.env.MONGODB_URI = previousMongodbUri;
}

console.log("✓ store owns Mongo durability/uniqueness proof");
console.log("✓ ownership authority exposes only store-derived production capability");
console.log("✓ raw injected read/create functions never become durable authority by method shape");
console.log("✓ creator boundary rejects method-only, deceptive, local-fallback and uncertain grant paths");
console.log("✓ unproven neighbours may deny but may never grant creator authority");
console.log("LAW: STORE -> AUTHORITY -> CREATOR. THREE-LAYER PROVENANCE OR ZERO AUTHORITY.");
console.log("Round Seven project ownership provenance torture: GREEN");
