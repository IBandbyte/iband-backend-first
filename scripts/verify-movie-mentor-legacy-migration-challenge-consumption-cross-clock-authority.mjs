import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createMovieMentorLegacyMigrationChallengeAuthority } from "../ai/MovieMentorLegacyMigrationChallengeAuthority.js";
import {
  MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_COLLECTION,
  persistMovieMentorLegacyMigrationChallenge,
  readMovieMentorLegacyMigrationChallenge,
  consumeMovieMentorLegacyMigrationChallenge,
} from "../ai/MovieMentorLegacyMigrationChallengeStore.js";

console.log("3C.5E.4G.4 — legacy migration challenge consumption cross-clock authority");
assert.ok(process.env.MONGO_URI, "physical Mongo court requires MONGO_URI");
await mongoose.connect(process.env.MONGO_URI);
const collection = mongoose.connection.collection(MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_COLLECTION);
await collection.createIndex({ challengeId: 1 }, { unique: true });
await collection.createIndex({ consumptionId: 1 }, { unique: true, sparse: true });
await collection.createIndex({ issuanceAdoptionId: 1 }, { unique: true, sparse: true });

const realNow = Date.now();
const laggingProcessNow = realNow - 120_000;
const principal = Object.freeze({ authenticated: true, principalId: "owner-cross-clock" });
const project = Object.freeze({ id: "legacy-cross-clock", identity: Object.freeze({ domain: "iband.movie-mentor.project", schema: 0, issuance: "legacy-preserved" }) });
const authority = createMovieMentorLegacyMigrationChallengeAuthority({
  now: () => laggingProcessNow,
  ttlMs: 60_000,
  randomId: () => "cross-clock",
  randomNonce: () => "cross-clock-nonce",
  persistChallenge: persistMovieMentorLegacyMigrationChallenge,
  readChallenge: readMovieMentorLegacyMigrationChallenge,
  consumeChallenge: consumeMovieMentorLegacyMigrationChallenge,
});

const challenge = await authority.mintChallenge({ principal, project });
assert.ok(Date.parse(challenge.expiresAt) < realNow, "fixture must already be expired in durable/database reality");
await assert.rejects(
  () => authority.consumeForAttestationEligibility({ challenge, principal, project, consumptionId: "consume-cross-clock" }),
  (error) => error?.code === "MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_EXPIRED" || error?.code === "MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_CONSUMPTION_CONFLICT",
  "a lagging process clock must not irreversibly consume a challenge already expired in durable real time",
);
const durable = await readMovieMentorLegacyMigrationChallenge({ challengeId: challenge.challengeId });
assert.equal(durable.status, "issued", "expired challenge must remain unconsumed");
assert.equal(durable.consumptionId, null, "expired challenge must not mint consumption identity");
console.log("LAW: CALLER/PROCESS CLOCK MAY NOT GRANT DURABLE CHALLENGE CONSUMPTION AFTER DATABASE-REAL EXPIRY.");
console.log("legacy migration challenge consumption cross-clock authority: GREEN");
await mongoose.disconnect();
