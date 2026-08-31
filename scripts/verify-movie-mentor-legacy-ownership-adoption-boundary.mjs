import assert from "node:assert/strict";
import {
  certifyLegacyProjectOwnershipAdoption,
  isMovieMentorLegacyProjectOwnershipAdoptionAttestationOwnedProof,
} from "../ai/MovieMentorLegacyProjectOwnershipAdoptionBoundary.js";

const now = Date.parse("2026-08-27T21:30:00.000Z");
const principal = Object.freeze({ principalId: "creator-1", authenticated: true });
const project = Object.freeze({
  id: "movie-project-legacy-1",
  title: "Definitely Mine",
  identity: {
    domain: "iband.movie-mentor.project",
    schema: 0,
    issuance: "legacy-preserved",
    legacy: true,
  },
});

function verifiedEvidence(overrides = {}) {
  return {
    verified: true,
    subject: "creator-1",
    projectId: project.id,
    adoptionId: "legacy-adoption-1",
    issuer: "iband-migration-authority",
    audience: "iband.movie-mentor.legacy-ownership-adoption",
    verificationMethod: "deterministic-migration-attestation-v1",
    issuedAt: "2026-08-27T21:29:00.000Z",
    expiresAt: "2026-08-27T21:34:00.000Z",
    revoked: false,
    projectIdentity: {
      domain: project.identity.domain,
      schema: project.identity.schema,
      issuance: project.identity.issuance,
    },
    ...overrides,
  };
}

async function reject(code, options = {}) {
  await assert.rejects(
    certifyLegacyProjectOwnershipAdoption({
      principal,
      project,
      credential: { projectId: project.id, title: project.title },
      expectedIssuer: "iband-migration-authority",
      now,
      ...options,
    }),
    (error) => error?.code === code
  );
}

await reject("MOVIE_MENTOR_LEGACY_ADOPTION_VERIFIER_REQUIRED");
await reject("MOVIE_MENTOR_LEGACY_ADOPTION_AUTHENTICATION_REQUIRED", {
  principal: { principalId: "creator-1", authenticated: false },
  verifyAdoptionCredential: async () => verifiedEvidence(),
});
for (const invalidNow of [null, NaN, Infinity, -Infinity, "2026-08-27T21:30:00.000Z", {}, []]) {
  await reject("MOVIE_MENTOR_LEGACY_ADOPTION_CLOCK_INVALID", {
    now: invalidNow,
    verifyAdoptionCredential: async () => verifiedEvidence(),
  });
}
await reject("MOVIE_MENTOR_LEGACY_ADOPTION_PROOF_INVALID", {
  verifyAdoptionCredential: async () => ({ verified: false }),
});
await reject("MOVIE_MENTOR_LEGACY_ADOPTION_PRINCIPAL_CONFLICT", {
  verifyAdoptionCredential: async () => verifiedEvidence({ subject: "attacker" }),
});
await reject("MOVIE_MENTOR_LEGACY_ADOPTION_PROJECT_CONFLICT", {
  verifyAdoptionCredential: async () => verifiedEvidence({ projectId: "movie-project-other" }),
});
await reject("MOVIE_MENTOR_LEGACY_ADOPTION_ID_REQUIRED", {
  verifyAdoptionCredential: async () => verifiedEvidence({ adoptionId: "" }),
});
await reject("MOVIE_MENTOR_LEGACY_ADOPTION_ISSUER_INVALID", {
  verifyAdoptionCredential: async () => verifiedEvidence({ issuer: "zorg-auth" }),
});
await reject("MOVIE_MENTOR_LEGACY_ADOPTION_AUDIENCE_INVALID", {
  verifyAdoptionCredential: async () => verifiedEvidence({ audience: "iband.movie-mentor.turn" }),
});
await reject("MOVIE_MENTOR_LEGACY_ADOPTION_PROOF_REVOKED", {
  verifyAdoptionCredential: async () => verifiedEvidence({ revoked: true }),
});
await reject("MOVIE_MENTOR_LEGACY_ADOPTION_EXPIRED", {
  verifyAdoptionCredential: async () => verifiedEvidence({ expiresAt: "2026-08-27T21:29:30.000Z" }),
});
await reject("MOVIE_MENTOR_LEGACY_ADOPTION_IDENTITY_CONFLICT", {
  verifyAdoptionCredential: async () => verifiedEvidence({
    projectIdentity: { domain: project.identity.domain, schema: 1, issuance: "secure-web-crypto" },
  }),
});

const certified = await certifyLegacyProjectOwnershipAdoption({
  principal,
  project,
  credential: { opaqueMigrationProof: "not-interpreted-by-boundary" },
  verifyAdoptionCredential: async () => verifiedEvidence(),
  expectedIssuer: "iband-migration-authority",
  now,
});
assert.equal(certified.certified, true);
assert.equal(certified.principalId, principal.principalId);
assert.equal(certified.projectId, project.id);
assert.equal(certified.adoptionId, "legacy-adoption-1");
assert.equal(certified.ownerBoundProof, true);
assert.deepEqual(certified.projectIdentity, {
  domain: "iband.movie-mentor.project",
  schema: 0,
  issuance: "legacy-preserved",
});
assert.ok(Object.isFrozen(certified));
assert.ok(Object.isFrozen(certified.projectIdentity));
assert.equal(isMovieMentorLegacyProjectOwnershipAdoptionAttestationOwnedProof(certified), true);
const reconstructed = Object.freeze({ ...certified, projectIdentity: Object.freeze({ ...certified.projectIdentity }) });
assert.deepEqual(reconstructed, certified);
assert.notEqual(reconstructed, certified);
assert.equal(isMovieMentorLegacyProjectOwnershipAdoptionAttestationOwnedProof(reconstructed), false, "structural equality must not reincarnate adoption authority");
const jsonClone = JSON.parse(JSON.stringify(certified));
assert.deepEqual(jsonClone, certified);
assert.equal(isMovieMentorLegacyProjectOwnershipAdoptionAttestationOwnedProof(jsonClone), false, "JSON photocopy must carry history but zero owner-bound authority");
assert.equal("title" in certified, false, "project title must never become ownership evidence");
assert.equal("credential" in certified, false, "raw migration credential must not escape the verifier boundary");

console.log("Movie Mentor legacy ownership adoption quarantine: PASS — finite present proof time plus independently verified exact principal/project/identity evidence creates one owner-bound attestation; reconstructed history grants zero authority.");
console.log("LAW: HISTORY MAY SURVIVE COPYING. ADOPTION AUTHORITY MAY NOT. PROOF DOES NOT REINCARNATE.");
