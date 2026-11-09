import assert from "node:assert/strict";
import mongoose from "mongoose";
import http from "node:http";
import { spawnSync } from "node:child_process";
import { executeStructuredAI } from "../ai/StructuredAIProviderClient.js";
import { createMovieMentorProviderOperationMongoStore } from "../ai/MovieMentorProviderOperationMongoStore.js";
import { describeCurrentMovieMentorProviderTarget } from "../ai/MovieMentorProviderTargetAuthority.js";
import { createMovieMentorProviderOutcomeRecoveryAuthority } from "../ai/MovieMentorProviderOutcomeRecoveryAuthority.js";
import { recoverPreviouslyAdmittedProviderResult } from "../ai/MovieMentorRecoveredProviderResultAuthority.js";
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
const isRecovery = process.argv[2] === "--recovered-worker";
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
  reservation: "movie_mentor_inference_spend_reservation",
  operation: "movie_mentor_provider_operation_reality",
  entitlement: "movie_mentor_inference_entitlement"
};
await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
if (isRecovery) {
  const id = process.argv[3];
  assert.match(id || "", /^combined-preflight-\d+-\d+-call$/);
  const db = mongoose.connection.db;
  const operationStore = createMovieMentorProviderOperationMongoStore();
  const operation = await operationStore.readOperation(id);
  assert.equal(operation?.providerCallId, id);
  const effect = await db.collection(names.effect).findOne({ providerCallId: id });
  assert.equal(effect?.state, "unknown");
  const execution = await db.collection(names.execution).findOne({ executionId: operation.executionId });
  assert.ok(execution?.providerCalls?.some(call => call.providerCallId === id));
  const recovery = createMovieMentorProviderOutcomeRecoveryAuthority({
    readProviderOperation: key => operationStore.readOperation(key),
    readProviderEffectReality: key => db.collection(names.effect).findOne({ providerCallId: key }),
    recoverProviderResponse: async () => { throw Error("UNKNOWN cannot recover provider response"); },
    resolveCurrentTarget: () => operation.providerTarget
  });
  const result = await recovery.reconcile({ providerCallId: id });
  assert.equal(result.outcome, "STILL_UNKNOWN");
  for (const key of ["redispatchAuthorized", "refundAuthorized", "recoveryAuthorized"]) assert.equal(result[key], false);
  await assert.rejects(() => recoverPreviouslyAdmittedProviderResult({
    decision: { dispatchAuthorized: false, reason: "provider-call-slot-already-admitted", existingProviderCall: { providerCallId: id, executionId: operation.executionId, slotId: operation.slotId, task: operation.task } },
    execution: { executionId: operation.executionId, ownerId: "fresh-worker", leaseGeneration: 2 },
    slotId: operation.slotId, task: operation.task, input: { proof: true },
    recoverProviderOutcome: () => recovery.reconcile({ providerCallId: id }),
    readProviderOperation: async () => { throw Error("UNKNOWN cannot reconstruct"); },
    reconstructRecoveredResult: async () => { throw Error("UNKNOWN cannot reconstruct"); }
  }), error => error?.code === "MOVIE_MENTOR_PROVIDER_RECOVERY_STILL_UNKNOWN");
  console.log("GREEN fresh-worker real durable UNKNOWN denial");
  await mongoose.disconnect();
  process.exit(0);
}
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
  await db.collection(names.operation).createIndex({ providerCallId: 1 }, { unique: true });
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    requests.push({ key: req.headers["idempotency-key"], body: JSON.parse(body) });
    res.destroy();
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  process.env.IBAND_AI_PROVIDER = "openai";
  process.env.IBAND_AI_MODEL = "gpt-test";
  process.env.IBAND_AI_API_KEY = "isolated-test-only";
  process.env.IBAND_AI_BASE_URL = `http://127.0.0.1:${server.address().port}/v1/responses`;
  const operationStore = createMovieMentorProviderOperationMongoStore();
  await operationStore.bindOperation({ providerCallId, executionId, slotId: "semantic", task: "movie-mentor-semantic", providerTarget: describeCurrentMovieMentorProviderTarget(), providerModel: "gpt-test", boundAt: new Date().toISOString() });
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
  try {
    await assert.rejects(() => executeStructuredAI({
      task: "movie-mentor-semantic", systemInstructions: "Return JSON.", input: { proof: true },
      schema: { type: "object", additionalProperties: false, properties: { value: { type: "string" } }, required: ["value"] },
      schemaName: "movie_mentor_combined_socket_loss",
      providerOperation: { providerOperationId: providerCallId, executionId, slotId: "semantic", task: "movie-mentor-semantic" }
    }));
    assert.equal(requests.length, 1);
    assert.equal(requests[0].key, providerCallId);
  } finally { await new Promise(resolve => server.close(resolve)); }
  const snapshot = {};
  for (const [key, name] of Object.entries(names)) snapshot[key] = await db.collection(name).find({}).project({ _id: 0 }).toArray();
  await mongoose.disconnect();
  const child = spawnSync(process.execPath, [new URL(import.meta.url).pathname, "--recovered-worker", providerCallId], { encoding: "utf8", timeout: 30000, env: { ...process.env, MOVIE_MENTOR_ISOLATED_MONGO_URI: uri } });
  assert.equal(child.status, 0, `${child.stderr} ${child.stdout}`);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  for (const [key, name] of Object.entries(names)) {
    const after = await mongoose.connection.db.collection(name).find({}).project({ _id: 0 }).toArray();
    assert.deepEqual(after, snapshot[key], `recovery must not mutate ${name}`);
  }
  console.log(child.stdout.trim());
  console.log("GREEN combined physical chain: production-store UNKNOWN -> one accepted socket with lost response -> fresh worker durable denial -> immutable ledgers");
  console.log("LIMITATION: isolated reservation fixture; full production ownership and HTTP journey not certified.");
} finally {
  await mongoose.disconnect();
}
