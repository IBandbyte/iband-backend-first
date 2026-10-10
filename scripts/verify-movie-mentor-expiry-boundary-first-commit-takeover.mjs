import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createMovieMentorResultCandidateMongoStore } from "../ai/MovieMentorResultCandidateMongoStore.js";
import { createMovieMentorInferenceExecutionMongoStore } from "../ai/MovieMentorInferenceExecutionMongoStore.js";
import { createMovieMentorInferenceExecutionLeaseAuthority } from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";
import { MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_PROOF_DOMAIN as DOMAIN, MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_SCHEMA as SCHEMA } from "../ai/MovieMentorCreatorStateConsumptionAuthority.js";

// Verifier only. Real MongoDB replica set, production stores, real server-time expiry CAS.
// The gate holds a REAL uncommitted transaction after its production callback completes.
// It never injects a 11000 or substitutes a fake database outcome.
const uri = "mongodb://127.0.0.1:27017/iband_expiry_boundary_first_commit_court";
assert.equal(process.env.MONGO_URI, uri, "Isolated court URI required");
await mongoose.connect(uri, { monitorCommands: true, maxPoolSize: 20, serverSelectionTimeoutMS: 10000 });
const db = mongoose.connection.db;
const events = [];
const client = mongoose.connection.getClient();
for (const name of ["commandFailed", "commandSucceeded"]) client.on(name, e => {
  if (["insert", "update", "findAndModify", "commitTransaction"].includes(e.commandName))
    events.push({ event: name, command: e.commandName, code: e.failure?.code ?? null,
      writeErrors: (e.reply?.writeErrors ?? []).map(w => w.code) });
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const serverNow = async () => new Date((await db.admin().command({ hello: 1 })).localTime).getTime();
async function untilServerTime(instant) {
  const deadline = Date.now() + 20000;
  while ((await serverNow()) < instant) {
    assert.ok(Date.now() < deadline, "Server-time expiry wait timed out");
    await sleep(40);
  }
}
const states = db.collection("movie_mentor_creator_state");
const executions = db.collection("movie_mentor_inference_execution");
const candidates = db.collection("movie_mentor_result_candidate");
const summary = { court: "expiry-boundary-first-commit-takeover", cases: [], classification: "INCONCLUSIVE" };
try {
  await states.createIndex({ projectId: 1 }, { unique: true, partialFilterExpression: { projectId: { $type: "string" } } });
  await executions.createIndex({ executionId: 1 }, { unique: true });
  const executionStore = createMovieMentorInferenceExecutionMongoStore();
  const authority = createMovieMentorInferenceExecutionLeaseAuthority({ store: executionStore, leaseMs: 3000 });
  for (let n = 0; n < 3; n++) {
    const id = "expiry-first-commit-" + n;
    const seed = {
      authorized: true, executionAuthorized: true, executionId: id, creatorTurnId: "turn-" + id,
      principalId: "principal-" + id, projectId: "project-" + id,
      reservationId: "reservation-" + id, requestDigest: "digest-" + id,
      ownerId: "owner-A", leaseGeneration: 1, leaseReference: "lease-A",
      fencingToken: "fence-A", phase: "active", schema: 6,
      maxProviderCalls: 5, providerCallsClaimed: 0, providerCalls: [],
      leaseAcquiredAt: new Date((await serverNow()) - 1000),
      leaseExpiresAt: new Date((await serverNow()) + 3000),
      resultCandidateBarrierRevision: 0
    };
    await executions.insertOne(seed);
    await states.insertOne({ projectId: seed.projectId, revision: 7, creatorStateGeneration: 3,
      creatorStateFingerprint: "fingerprint-" + id, resultCandidateBarrierRevision: 0 });
    const proof = { domain: DOMAIN, schema: SCHEMA, authorized: true, currentOwnershipVerified: true,
      principalId: seed.principalId, projectId: seed.projectId, ownershipRef: "ownership-" + id,
      ownershipRevision: 1, stage: "result-candidate", revision: 7,
      creatorStateGeneration: 3, creatorStateFingerprint: "fingerprint-" + id,
      executionId: id, providerCallId: null };
    let signalReady, release;
    const ready = new Promise(resolve => { signalReady = resolve; });
    const held = new Promise(resolve => { release = resolve; });
    let entered = false;
    const store = createMovieMentorResultCandidateMongoStore({
      startSession: async () => {
        const session = await mongoose.startSession();
        const original = session.withTransaction.bind(session);
        session.withTransaction = (callback, options) => original(async (...args) => {
          const value = await callback(...args);
          if (!entered) { entered = true; signalReady(); await held; }
          return value;
        }, options);
        return session;
      }
    });
    const payload = { result: "immutable-" + id };
    const staging = store.stageCandidate({ execution: seed, creatorStateConsumptionProof: proof, resultPayload: payload })
      .then(value => ({ status: "fulfilled", idempotent: value?.idempotent === true }),
        error => ({ status: "rejected", code: error?.code ?? null, message: error?.message ?? "" }));
    let takeover, attemptedBeforeRelease = false;
    try {
      await Promise.race([ready, sleep(12000).then(() => { throw Error("First transaction did not reach gate"); })]);
      const expiry = seed.leaseExpiresAt.getTime();
      await untilServerTime(expiry + 150);
      const attempt = authority.acquireExecution({ executionId: id, ownerId: "owner-B" })
        .then(value => ({ status: "fulfilled", authorized: value?.authorized === true,
          acquired: value?.acquired === true, reason: value?.reason ?? null }),
          error => ({ status: "rejected", code: error?.code ?? null, message: error?.message ?? "" }));
      takeover = await Promise.race([attempt, sleep(250).then(() => ({ status: "pending" }))]);
      attemptedBeforeRelease = true;
    } finally { release(); }
    const stageResult = await staging;
    // If the initial takeover was blocked by the transaction, retry via production authority.
    const after = await authority.acquireExecution({ executionId: id, ownerId: "owner-B" })
      .then(value => ({ status: "fulfilled", authorized: value?.authorized === true,
        acquired: value?.acquired === true, reason: value?.reason ?? null }),
        error => ({ status: "rejected", code: error?.code ?? null }));
    const row = await executions.findOne({ executionId: id });
    const count = await candidates.countDocuments({ executionId: id });
    const candidate = await candidates.findOne({ executionId: id });
    const state = await states.findOne({ projectId: seed.projectId });
    assert.ok(attemptedBeforeRelease);
    assert.ok(count <= 1, "GENUINE RED: duplicate immutable candidates");
    assert.equal(row.resultCandidateBarrierRevision, state.resultCandidateBarrierRevision,
      "GENUINE RED: cross-ledger barrier mismatch");
    assert.equal(row.resultCandidateBarrierRevision, count,
      "GENUINE RED: candidate/barrier mismatch");
    if (row.ownerId === "owner-B") {
      assert.equal(row.leaseGeneration, 2, "GENUINE RED: takeover generation invalid");
      assert.notEqual(candidate?.stagedFromLeaseGeneration, 2, "GENUINE RED: owner A forged owner B candidate");
    }
    summary.cases.push({ id, stageResult, takeoverBeforeRelease: takeover, takeoverAfterRelease: after,
      finalOwner: row.ownerId, generation: row.leaseGeneration, candidates: count,
      candidateGeneration: candidate?.stagedFromLeaseGeneration ?? null,
      barrier: row.resultCandidateBarrierRevision });
  }
  summary.command11000 = events.flatMap(e => [e.code, ...e.writeErrors]).filter(x => x === 11000).length;
  summary.command112 = events.flatMap(e => [e.code, ...e.writeErrors]).filter(x => x === 112).length;
  summary.command251 = events.flatMap(e => [e.code, ...e.writeErrors]).filter(x => x === 251).length;
  summary.classification = summary.command11000 > 0
    ? "11000_OBSERVED_REVIEW_EXACT_EXECUTION_ID_AND_AUTHORITY"
    : "INCONCLUSIVE_NO_EXECUTION_ID_11000";
  console.log(JSON.stringify(summary));
} finally { await mongoose.disconnect(); }
