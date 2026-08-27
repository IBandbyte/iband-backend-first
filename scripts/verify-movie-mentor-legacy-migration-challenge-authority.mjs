import assert from "node:assert/strict";
import { createMovieMentorLegacyMigrationChallengeAuthority } from "../ai/MovieMentorLegacyMigrationChallengeAuthority.js";

let clock = Date.parse("2026-08-27T20:00:00.000Z");
let seq = 0;
const durable = new Map();
const authority = createMovieMentorLegacyMigrationChallengeAuthority({
  now: () => clock,
  randomId: () => `challenge-${++seq}`,
  randomNonce: () => `nonce-${seq}`,
  ttlMs: 120000,
  persistChallenge: async (challenge) => durable.set(challenge.challengeId, structuredClone(challenge)),
  readChallenge: async ({ challengeId }) => durable.get(challengeId) ? structuredClone(durable.get(challengeId)) : null,
});

const owner = Object.freeze({ authenticated: true, principalId: "principal-owner" });
const attacker = Object.freeze({ authenticated: true, principalId: "principal-attacker" });
const project = Object.freeze({ id: "legacy-project-1", identity: Object.freeze({ domain: "iband.movie-mentor.project", schema: 0, issuance: "legacy-preserved" }) });
const otherProject = Object.freeze({ id: "legacy-project-2", identity: Object.freeze({ domain: "iband.movie-mentor.project", schema: 0, issuance: "legacy-preserved" }) });

await assert.rejects(() => authority.mintChallenge({ principal: { authenticated: false, principalId: "principal-owner" }, project }), e => e.code === "MOVIE_MENTOR_LEGACY_MIGRATION_AUTHENTICATION_REQUIRED");

const challenge = await authority.mintChallenge({ principal: owner, project });
assert.equal(challenge.principalId, owner.principalId);
assert.equal(challenge.projectId, project.id);
assert.equal(challenge.projectIdentity.issuance, "legacy-preserved");
assert.ok(challenge.nonce);
assert.ok(durable.has(challenge.challengeId));

const verified = await authority.verifyChallengeBinding({ challenge, principal: owner, project });
assert.equal(verified.verified, true);

await assert.rejects(() => authority.verifyChallengeBinding({ challenge, principal: attacker, project }), e => e.code === "MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_PRINCIPAL_CONFLICT");
await assert.rejects(() => authority.verifyChallengeBinding({ challenge, principal: owner, project: otherProject }), e => e.code === "MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_PROJECT_CONFLICT");

const mutatedIdentity = Object.freeze({ id: project.id, identity: Object.freeze({ domain: "iband.movie-mentor.project", schema: 1, issuance: "uuid-v1" }) });
await assert.rejects(() => authority.verifyChallengeBinding({ challenge, principal: owner, project: mutatedIdentity }), e => e.code === "MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_IDENTITY_CONFLICT");

// Client tampering is defeated when a durable challenge reader is configured.
const forged = { ...challenge, principalId: attacker.principalId, projectId: otherProject.id, nonce: "forged" };
const reread = await authority.verifyChallengeBinding({ challenge: forged, principal: owner, project });
assert.equal(reread.verified, true);
assert.equal(reread.challenge.nonce, challenge.nonce);

clock += 120001;
await assert.rejects(() => authority.verifyChallengeBinding({ challenge, principal: owner, project }), e => e.code === "MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_EXPIRED");

clock -= 120001;
const revoked = durable.get(challenge.challengeId);
revoked.status = "revoked";
durable.set(challenge.challengeId, revoked);
await assert.rejects(() => authority.verifyChallengeBinding({ challenge, principal: owner, project }), e => e.code === "MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_NOT_ACTIVE");

// A fresh challenge is independent and cannot be substituted for another project/principal binding.
const fresh = await authority.mintChallenge({ principal: owner, project });
assert.notEqual(fresh.challengeId, challenge.challengeId);
assert.notEqual(fresh.nonce, challenge.nonce);

console.log("Movie Mentor legacy migration challenge authority verification passed.");
