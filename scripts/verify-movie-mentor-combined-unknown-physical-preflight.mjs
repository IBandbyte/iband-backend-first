import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createMovieMentorInferenceExecutionMongoStore } from "../ai/MovieMentorInferenceExecutionMongoStore.js";
import { createMovieMentorProviderEffectMongoStore } from "../ai/MovieMentorProviderEffectMongoStore.js";

// Physical preflight for the combined socket-loss/restart court.
// This file deliberately does NOT claim complete provider or recovery certification.
const uri = process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.match(uri || "", /^mongodb:\/\/(127\.0\.0\.1|localhost)(:|\/)/,
  "Only an explicitly configured loopback Mongo replica set is permitted");
assert.match(uri, /(?:\?|&)replicaSet=/, "Transactions require an isolated replica set");
process.env.MONGO_URI = uri;
const suffix = `combined-preflight-${process.pid}-${Date.now()}`;
const executionId = `${suffix}-execution`;
const providerCallId = `${suffix}-call`;
const ownerId = `${suffix}-owner`;
const leaseReference = `${suffix}-lease`;
const fencingToken = `${suffix}-fence`;
const admittedAt = new Date();
const leaseExpiresAt = new Date(admittedAt.getTime() + 300000);
const names = {
  execution: "movie_mentor_inference_execution",
  effect: "movie_mentor_provider_effect_reality",
  reservation: "movie_mentor_inference_spend_reservation"
};
await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
try {
  const db = mongoose.connection.db;
  await db.collection(names.execution).createIndex({ executionId: 1 }, { unique: true });
  await db.collection(names.execution).createIndex(
    { principalId: 1, projectId: 1, creatorTurnId: 1 }, { unique: true });
  await db.collection(names.execution).createIndex({ reservationId: 1 }, { unique: true });
  await db.collection(names.effect).createIndex({ providerCallId: 1 }, { unique: true });
  const reservationId = `${suffix}-reservation`;
  const principalId = `${suffix}-principal`;
  const projectId = `${suffix}-project`;
  // Reservation is the isolated spend fixture, not proof of production spend admission.
  await db.collection(names.reservation).insertOne({
    domain: "iband.movie-mentor.inference-spend", schema: 1,
    reservationId, principalId, projectId, operation: "movie-mentor-turn",
    status: "reserved", executionBindingBarrierRevision: 0
  });
  const executionStore = createMovieMentorInferenceExecutionMongoStore();
  const created = await executionStore.createExecution({
    executionId, creatorTurnId: `${suffix}-turn`, principalId, projectId,
    reservationId, requestDigest: `${suffix}-digest`,
    phase: "active", ownerId, leaseGeneration: 1, leaseReference,
    fencingToken, leaseAcquiredAt: admittedAt, leaseExpiresAt,
    maxProviderCalls: 1, providerCallsClaimed: 0, providerCalls: []
  });
  assert.equal(created?.schema, 6);
  const admitted = await executionStore.claimProviderCall({
    executionId, ownerId, leaseGeneration: 1, leaseReference, fencingToken,
    providerCallId, slotId: "semantic", task: "movie-mentor-semantic", admittedAt
  });
  assert.equal(admitted.claimed, true);
  const effectStore = createMovieMentorProviderEffectMongoStore();
  const reality = await effectStore.beginUnknown({
    providerCallId, executionId, slotId: "semantic", task: "movie-mentor-semantic",
    ownerId, leaseGeneration: 1, leaseReference, fencingToken,
    dispatchUnknownAt: new Date().toISOString()
  });
  assert.equal(reality.state, "unknown");
  assert.deepEqual(reality.evidence, []);
  const durableExecution = await db.collection(names.execution).findOne({ executionId });
  assert.equal(durableExecution.providerEffectRealityRevision, 1,
    "UNKNOWN must transactionally advance the same execution ledger");
  assert.equal((await db.collection(names.effect).countDocuments({ providerCallId })), 1);
  console.log("GREEN physical preflight: reserved spend -> schema-6 execution -> admitted call -> transactional UNKNOWN");
  console.log("LIMITATION: isolated reservation fixture; no provider socket, process restart, or full ownership proof yet.");
} finally {
  await mongoose.disconnect();
}
