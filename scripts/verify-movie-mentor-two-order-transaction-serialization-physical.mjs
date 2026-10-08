import assert from "node:assert/strict";
import mongoose from "mongoose";

// DESIGN-FEASIBILITY COURT ONLY. This does not exercise a production repair.
// Both competing writers must physically write the SAME execution document.
// A read-only snapshot check is NOT a sufficient cross-collection fence.
const uri = process.env.MONGO_URI;
assert.equal(uri, "mongodb://127.0.0.1:27017/iband_first_commit_takeover_court");
await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
const db = mongoose.connection.db;
const executions = db.collection("court_two_order_executions");
const creators = db.collection("court_two_order_creator_states");
const initial = async (key) => {
  await executions.insertOne({ _id: key, leaseGeneration: 1, leaseReference: "A", phase: "active", commitBarrier: 0 });
  await creators.insertOne({ _id: key, revision: 7, decisions: [] });
};
const takeover = async (key) => executions.updateOne(
  { _id: key, leaseGeneration: 1, leaseReference: "A", phase: "active" },
  { $set: { leaseGeneration: 2, leaseReference: "B" } },
);
const commit = async (key, { pauseAfterFence = async () => {} } = {}) => {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      // This conditional WRITE on the execution row creates the serialization conflict.
      const barrier = await executions.updateOne(
        { _id: key, leaseGeneration: 1, leaseReference: "A", phase: "active", commitBarrier: 0 },
        { $inc: { commitBarrier: 1 } }, { session },
      );
      if (barrier.modifiedCount !== 1) return "fenced";
      await pauseAfterFence();
      const state = await creators.updateOne(
        { _id: key, revision: 7, decisions: { $size: 0 } },
        { $inc: { revision: 1 }, $push: { decisions: "turn-1" } },
        { session },
      );
      assert.equal(state.modifiedCount, 1);
      return "committed";
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, maxCommitTimeMS: 10000 });
  } finally { await session.endSession(); }
};
try {
  await initial("takeover-first");
  assert.equal((await takeover("takeover-first")).modifiedCount, 1);
  assert.equal(await commit("takeover-first"), "fenced");
  const a = await creators.findOne({ _id: "takeover-first" });
  assert.equal(a.revision, 7);
  assert.deepEqual(a.decisions, []);
  const aLease = await executions.findOne({ _id: "takeover-first" });
  assert.equal(aLease.leaseGeneration, 2);

  await initial("commit-first");
  let releaseCommit;
  let signalBarrier;
  const barrierWritten = new Promise((resolve) => { signalBarrier = resolve; });
  const commitReleased = new Promise((resolve) => { releaseCommit = resolve; });
  const commitPromise = commit("commit-first", { pauseAfterFence: async () => {
    signalBarrier();
    await commitReleased;
  } });
  await barrierWritten;
  // Concurrent takeover attempts a write to the same execution row while the
  // creator transaction is open. It must not commit ahead of the creator transaction.
  const takeoverPromise = takeover("commit-first");
  releaseCommit();
  const [committed, takeoverResult] = await Promise.all([commitPromise, takeoverPromise]);
  assert.equal(committed, "committed");
  assert.equal(takeoverResult.modifiedCount, 1);
  const b = await creators.findOne({ _id: "commit-first" });
  const bLease = await executions.findOne({ _id: "commit-first" });
  assert.equal(b.revision, 8);
  assert.deepEqual(b.decisions, ["turn-1"]);
  assert.equal(bLease.leaseGeneration, 2);
  assert.equal(bLease.commitBarrier, 1);
  console.log(JSON.stringify({
    court: "two-order-physical-transaction-serialization-design-feasibility",
    takeoverFirst: { staleCommit: "fenced", creatorRevision: a.revision, leaseGeneration: aLease.leaseGeneration },
    commitFirst: { creatorCommit: committed, takeoverModifiedCount: takeoverResult.modifiedCount, creatorRevision: b.revision, leaseGeneration: bLease.leaseGeneration, commitBarrier: bLease.commitBarrier },
    qualification: "design feasibility only; no production integration proven",
  }));
  console.log("PASS: two physical ordering checks preserve the intended serialization under a shared execution-row write barrier");
} finally {
  await mongoose.disconnect();
}
