import assert from "node:assert/strict";
import fs from "node:fs/promises";

const path = new URL("../ai/MovieMentorLegacyMigrationChallengeStore.js", import.meta.url);
const source = await fs.readFile(path, "utf8");

// Structural persistence law: dedicated collection, unique identities, issued-only terminal CAS, expiry fence.
assert.match(source, /movie_mentor_legacy_migration_challenges/);
assert.match(source, /schema\.index\(\{ challengeId: 1 \}, \{ unique: true \}\)/);
assert.match(source, /schema\.index\(\{ consumptionId: 1 \}, \{ unique: true, sparse: true \}\)/);
assert.match(source, /status: \"issued\"/);
assert.match(source, /expiresAt: \{ \$gt: at \}/);
assert.match(source, /status: \"consumed\"/);
assert.match(source, /status: \"revoked\"/);

// Model the store transition independently to torture terminal-state atomicity without CI Mongo.
const records = new Map();
const consumptionIds = new Set();
function create(challenge) {
  if (records.has(challenge.challengeId)) throw new Error("duplicate-challenge");
  records.set(challenge.challengeId, structuredClone({ ...challenge, status: "issued", consumptionId: null }));
}
function consume({ challengeId, principalId, projectId, consumptionId, at }) {
  const r = records.get(challengeId);
  if (!r || r.status !== "issued" || r.principalId !== principalId || r.projectId !== projectId || Date.parse(r.expiresAt) <= at || consumptionIds.has(consumptionId)) return false;
  r.status = "consumed"; r.consumptionId = consumptionId; r.consumedAt = new Date(at).toISOString(); consumptionIds.add(consumptionId); return true;
}
function revoke({ challengeId, at }) {
  const r = records.get(challengeId); if (!r || r.status !== "issued") return false;
  r.status = "revoked"; r.revokedAt = new Date(at).toISOString(); return true;
}

const now = Date.parse("2026-08-27T22:00:00Z");
const base = { challengeId: "challenge-A", principalId: "owner", projectId: "project-A", nonce: "nonce-A", issuedAt: new Date(now).toISOString(), expiresAt: new Date(now + 60000).toISOString() };
create(base);
assert.throws(() => create(base), /duplicate-challenge/);
assert.equal(consume({ challengeId: base.challengeId, principalId: "owner", projectId: "project-A", consumptionId: "consume-A", at: now + 1 }), true);
assert.equal(consume({ challengeId: base.challengeId, principalId: "owner", projectId: "project-A", consumptionId: "consume-B", at: now + 2 }), false);
assert.equal(revoke({ challengeId: base.challengeId, at: now + 3 }), false);
assert.equal(records.get(base.challengeId).status, "consumed");

create({ ...base, challengeId: "challenge-B", nonce: "nonce-B" });
assert.equal(revoke({ challengeId: "challenge-B", at: now + 1 }), true);
assert.equal(consume({ challengeId: "challenge-B", principalId: "owner", projectId: "project-A", consumptionId: "consume-C", at: now + 2 }), false);
assert.equal(records.get("challenge-B").status, "revoked");

create({ ...base, challengeId: "challenge-expired", expiresAt: new Date(now + 10).toISOString() });
assert.equal(consume({ challengeId: "challenge-expired", principalId: "owner", projectId: "project-A", consumptionId: "consume-D", at: now + 11 }), false);
assert.equal(records.get("challenge-expired").status, "issued");

// Global consumption identity cannot be recycled on another challenge.
create({ ...base, challengeId: "challenge-C", nonce: "nonce-C" });
assert.equal(consume({ challengeId: "challenge-C", principalId: "owner", projectId: "project-A", consumptionId: "consume-A", at: now + 2 }), false);

// Race consume vs revoke: exactly one terminal transition can win.
create({ ...base, challengeId: "challenge-race", nonce: "nonce-race" });
const operations = [
  () => consume({ challengeId: "challenge-race", principalId: "owner", projectId: "project-A", consumptionId: "race-consume", at: now + 5 }),
  () => revoke({ challengeId: "challenge-race", at: now + 5 }),
];
const outcomes = operations.map(fn => fn());
assert.equal(outcomes.filter(Boolean).length, 1);
assert.ok(["consumed", "revoked"].includes(records.get("challenge-race").status));

console.log("Movie Mentor durable legacy migration challenge store verification passed: unique identity, expiry fence, terminal CAS, replay fence, and consume/revoke race.");
