import assert from "node:assert/strict";
import { createMovieMentorLegacyMigrationChallengeAuthority } from "../ai/MovieMentorLegacyMigrationChallengeAuthority.js";

const realNow = Date.parse("2030-01-01T00:02:00.000Z");
const laggingProcessNow = realNow - 120000;
const expiresAt = new Date(realNow - 1000).toISOString();
const challenge = {
  domain: "iband.movie-mentor.legacy-ownership-migration-challenge",
  schema: 1,
  challengeId: "movie-mentor-legacy-migration:cross-clock",
  principalId: "owner",
  projectId: "legacy-project",
  projectIdentity: { domain: "iband.movie-mentor.project", schema: 0, issuance: "legacy-preserved" },
  nonce: "nonce",
  issuedAt: new Date(realNow - 60000).toISOString(),
  expiresAt,
  status: "issued"
};
let durable = structuredClone(challenge);
const consumeChallenge = async ({ challengeId, expectedStatus, principalId, projectId, consumptionId, consumedAt }) => {
  const at = Date.parse(consumedAt);
  if (!durable || durable.challengeId !== challengeId || durable.status !== expectedStatus || durable.principalId !== principalId || durable.projectId !== projectId) return { consumed: false };
  // Model the production store contract exactly: expiresAt > caller-supplied consumedAt.
  if (Date.parse(durable.expiresAt) <= at) return { consumed: false };
  durable = { ...durable, status: "consumed", consumptionId, consumedAt };
  return { consumed: true, record: structuredClone(durable) };
};
const authority = createMovieMentorLegacyMigrationChallengeAuthority({
  now: () => laggingProcessNow,
  readChallenge: async () => structuredClone(durable),
  consumeChallenge
});
const principal = { authenticated: true, principalId: "owner" };
const project = { id: "legacy-project", identity: challenge.projectIdentity };

console.log("legacy migration challenge expiry cross-clock authority");
await assert.rejects(
  () => authority.consumeForAttestationEligibility({ challenge, principal, project, consumptionId: "consume-cross-clock" }),
  error => error?.code === "MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_EXPIRED",
  "a lagging process clock must not irreversibly consume a challenge already expired in authoritative real time"
);
assert.equal(durable.status, "issued", "expired durable challenge must remain unconsumed");
console.log("LAW: PROCESS-LOCAL CLOCK MAY NOT GRANT DURABLE CHALLENGE CONSUMPTION AFTER AUTHORITATIVE EXPIRY.");
