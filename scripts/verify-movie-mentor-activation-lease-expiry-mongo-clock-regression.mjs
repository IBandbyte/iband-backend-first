import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createMovieMentorJourneyRecoveryActivationLeaseMongoStore } from "../ai/MovieMentorJourneyRecoveryActivationLeaseMongoStore.js";

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
assert.ok(uri, "MONGO_URI is required for the physical Mongo clock regression court");
await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
const collection = mongoose.connection.collection("movie_mentor_journey_recovery_activation_lease");
await collection.deleteMany({});
await collection.createIndex({ serviceKey: 1 }, { unique: true });

const serverNow = (await mongoose.connection.db.command({ hello: 1 })).localTime;
const acquiredAt = new Date(serverNow.getTime() - 120000);
const expiresAt = new Date(serverNow.getTime() - 60000);
await collection.insertOne({
  domain: "iband.movie-mentor.journey-recovery-activation-lease-store",
  schema: 1,
  serviceKey: "movie-mentor-journey-recovery-activation",
  processInstanceId: "process-A",
  deploymentId: "deploy-A",
  basePath: "/api/movie-mentor-recovery",
  expectedIssuer: "issuer",
  expectedAudience: "audience",
  status: "active",
  leaseGeneration: 1,
  leaseReference: "ref-1-A",
  fencingToken: "fence-1-A",
  acquiredAt,
  expiresAt
});

const store = createMovieMentorJourneyRecoveryActivationLeaseMongoStore();
const nextAcquiredAt = new Date(serverNow.getTime() + 1000);
const nextExpiresAt = new Date(serverNow.getTime() + 121000);
console.log("activation lease expiry Mongo clock regression");
const takeover = await store.replaceLease({
  processInstanceId: "process-B",
  deploymentId: "deploy-B",
  basePath: "/api/movie-mentor-recovery",
  expectedIssuer: "issuer",
  expectedAudience: "audience",
  status: "active",
  leaseGeneration: 2,
  leaseReference: "ref-2-B",
  fencingToken: "fence-2-B",
  acquiredAt: nextAcquiredAt,
  expiresAt: nextExpiresAt
}, {
  expectedLeaseGeneration: 1,
  expectedLeaseReference: "ref-1-A",
  requireDurablyExpired: true
});
assert.ok(takeover, "a lease durably expired by Mongo server time must admit exactly one fenced takeover");
assert.equal(takeover.leaseGeneration, 2);
assert.equal(takeover.leaseReference, "ref-2-B");
console.log("LAW: durable Mongo server time, not a field path or process clock, owns expired-lease takeover eligibility.");
await mongoose.disconnect();
