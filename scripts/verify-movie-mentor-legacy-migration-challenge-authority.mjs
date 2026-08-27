import assert from "node:assert/strict";
import { createMovieMentorLegacyMigrationChallengeAuthority } from "../ai/MovieMentorLegacyMigrationChallengeAuthority.js";

let clock = Date.parse("2026-08-27T20:00:00.000Z");
let seq = 0;
const durable = new Map();
let ackLossConsumptionId = null;
const atomicConsume = async ({ challengeId, expectedStatus, principalId, projectId, consumptionId, consumedAt }) => {
  const current = durable.get(challengeId);
  if (!current || current.status !== expectedStatus || current.principalId !== principalId || current.projectId !== projectId) return { consumed: false };
  const next = { ...current, status: "consumed", consumptionId, consumedAt };
  durable.set(challengeId, next);
  if (consumptionId === ackLossConsumptionId) return { consumed: false };
  return { consumed: true };
};
const authority = createMovieMentorLegacyMigrationChallengeAuthority({
  now: () => clock,
  randomId: () => `challenge-${++seq}`,
  randomNonce: () => `nonce-${seq}`,
  ttlMs: 120000,
  persistChallenge: async challenge => durable.set(challenge.challengeId, structuredClone(challenge)),
  readChallenge: async ({ challengeId }) => durable.get(challengeId) ? structuredClone(durable.get(challengeId)) : null,
  consumeChallenge: atomicConsume,
});

const owner = Object.freeze({ authenticated: true, principalId: "principal-owner" });
const attacker = Object.freeze({ authenticated: true, principalId: "principal-attacker" });
const project = Object.freeze({ id: "legacy-project-1", identity: Object.freeze({ domain: "iband.movie-mentor.project", schema: 0, issuance: "legacy-preserved" }) });
const otherProject = Object.freeze({ id: "legacy-project-2", identity: Object.freeze({ domain: "iband.movie-mentor.project", schema: 0, issuance: "legacy-preserved" }) });

await assert.rejects(() => authority.mintChallenge({ principal: { authenticated: false, principalId: "principal-owner" }, project }), e => e.code === "MOVIE_MENTOR_LEGACY_MIGRATION_AUTHENTICATION_REQUIRED");
const challenge = await authority.mintChallenge({ principal: owner, project });
assert.equal((await authority.verifyChallengeBinding({ challenge, principal: owner, project })).verified, true);
await assert.rejects(() => authority.verifyChallengeBinding({ challenge, principal: attacker, project }), e => e.code === "MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_PRINCIPAL_CONFLICT");
await assert.rejects(() => authority.verifyChallengeBinding({ challenge, principal: owner, project: otherProject }), e => e.code === "MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_PROJECT_CONFLICT");
const mutatedIdentity = Object.freeze({ id: project.id, identity: Object.freeze({ domain: "iband.movie-mentor.project", schema: 1, issuance: "uuid-v1" }) });
await assert.rejects(() => authority.verifyChallengeBinding({ challenge, principal: owner, project: mutatedIdentity }), e => e.code === "MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_IDENTITY_CONFLICT");
const forged = { ...challenge, principalId: attacker.principalId, projectId: otherProject.id, nonce: "forged" };
assert.equal((await authority.verifyChallengeBinding({ challenge: forged, principal: owner, project })).challenge.nonce, challenge.nonce);
clock += 120001;
await assert.rejects(() => authority.verifyChallengeBinding({ challenge, principal: owner, project }), e => e.code === "MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_EXPIRED");
clock -= 120001;
const revoked = durable.get(challenge.challengeId); revoked.status = "revoked"; durable.set(challenge.challengeId, revoked);
await assert.rejects(() => authority.verifyChallengeBinding({ challenge, principal: owner, project }), e => e.code === "MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_NOT_ACTIVE");

// Atomic single-use consumption.
const consumable = await authority.mintChallenge({ principal: owner, project });
const first = await authority.consumeForAttestationEligibility({ challenge: consumable, principal: owner, project, consumptionId: "consume-1" });
assert.equal(first.eligible, true); assert.equal(first.status, "consumed");
assert.equal(durable.get(consumable.challengeId).status, "consumed");
await assert.rejects(() => authority.consumeForAttestationEligibility({ challenge: consumable, principal: owner, project, consumptionId: "consume-2" }), e => e.code === "MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_NOT_ACTIVE");
await assert.rejects(() => authority.consumeForAttestationEligibility({ challenge: consumable, principal: attacker, project, consumptionId: "consume-attacker" }), e => ["MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_NOT_ACTIVE", "MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_PRINCIPAL_CONFLICT"].includes(e.code));

// Two consumers race: exactly one atomic transition wins.
const race = await authority.mintChallenge({ principal: owner, project });
const raceResults = await Promise.allSettled([
  authority.consumeForAttestationEligibility({ challenge: race, principal: owner, project, consumptionId: "race-A" }),
  authority.consumeForAttestationEligibility({ challenge: race, principal: owner, project, consumptionId: "race-B" }),
]);
assert.equal(raceResults.filter(r => r.status === "fulfilled").length, 1);
assert.equal(raceResults.filter(r => r.status === "rejected").length, 1);
assert.ok(["race-A", "race-B"].includes(durable.get(race.challengeId).consumptionId));

// ACK loss after durable consumption reconciles only the exact operation.
const ack = await authority.mintChallenge({ principal: owner, project });
ackLossConsumptionId = "ack-loss-op";
const ackResult = await authority.consumeForAttestationEligibility({ challenge: ack, principal: owner, project, consumptionId: ackLossConsumptionId });
assert.equal(ackResult.status, "already-consumed-by-this-operation");
assert.equal(durable.get(ack.challengeId).consumptionId, ackLossConsumptionId);
ackLossConsumptionId = null;

// Expiry immediately before consumption is fenced by verification.
const expiring = await authority.mintChallenge({ principal: owner, project });
clock += 120001;
await assert.rejects(() => authority.consumeForAttestationEligibility({ challenge: expiring, principal: owner, project, consumptionId: "too-late" }), e => e.code === "MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_EXPIRED");
clock -= 120001;

// No durable consumer means no eligibility, ever.
const noConsumer = createMovieMentorLegacyMigrationChallengeAuthority({ now: () => clock, ttlMs: 120000 });
const local = await noConsumer.mintChallenge({ principal: owner, project });
await assert.rejects(() => noConsumer.consumeForAttestationEligibility({ challenge: local, principal: owner, project, consumptionId: "unsafe" }), e => e.code === "MOVIE_MENTOR_LEGACY_MIGRATION_CONSUMER_REQUIRED");

console.log("Movie Mentor legacy migration challenge authority verification passed, including atomic consumption race and ACK-loss reconciliation.");
