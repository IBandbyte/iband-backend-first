import assert from "node:assert/strict";
import mongoose from "mongoose";

// Isolated CONTRACT court, not a production integration test.
// Models the required physical interface: one transaction, execution-row
// write barrier, and exact creator-state revision CAS.
assert.equal(process.env.MONGO_URI, "mongodb://127.0.0.1:27017/iband_first_commit_takeover_court");
await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
const execution = mongoose.connection.collection("court_session_contract_execution");
const creator = mongoose.connection.collection("court_session_contract_creator");
const seed = async (id, generation = 1, owner = "A") => {
  await execution.insertOne({ _id: id, phase: "active", leaseGeneration: generation, leaseReference: owner, barrier: 0 });
  await creator.insertOne({ _id: id, revision: 7, decisions: [] });
};
async function commit(id, { generation = 1, owner = "A", failAfterCreatorWrite = false } = {}) {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const fence = await execution.updateOne(
        { _id: id, phase: "active", leaseGeneration: generation, leaseReference: owner, barrier: 0 },
        { $inc: { barrier: 1 } }, { session },
      );
      if (fence.modifiedCount !== 1) return "fenced";
      const cas = await creator.updateOne(
        { _id: id, revision: 7, decisions: { $size: 0 } },
        { $inc: { revision: 1 }, $push: { decisions: "turn" } }, { session },
      );
      if (cas.modifiedCount !== 1) throw new Error("CREATOR_REVISION_CONFLICT");
      if (failAfterCreatorWrite) throw new Error("INJECTED_POST_WRITE_FAILURE");
      return "committed";
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
  } finally { await session.endSession(); }
}
try {
  await seed("stale", 2, "B");
  assert.equal(await commit("stale"), "fenced");
  assert.equal((await creator.findOne({ _id: "stale" })).revision, 7);
  assert.equal((await execution.findOne({ _id: "stale" })).barrier, 0);

  await seed("rollback");
  await assert.rejects(commit("rollback", { failAfterCreatorWrite: true }), /INJECTED_POST_WRITE_FAILURE/);
  const rolledCreator = await creator.findOne({ _id: "rollback" });
  const rolledExecution = await execution.findOne({ _id: "rollback" });
  assert.equal(rolledCreator.revision, 7);
  assert.deepEqual(rolledCreator.decisions, []);
  assert.equal(rolledExecution.barrier, 0);

  await seed("current");
  assert.equal(await commit("current"), "committed");
  const currentCreator = await creator.findOne({ _id: "current" });
  const currentExecution = await execution.findOne({ _id: "current" });
  assert.equal(currentCreator.revision, 8);
  assert.deepEqual(currentCreator.decisions, ["turn"]);
  assert.equal(currentExecution.barrier, 1);
  console.log(JSON.stringify({
    court: "physical-shared-session-contract-feasibility",
    stale: "fenced-without-mutation",
    rollback: "both-records-unchanged",
    current: "one-creator-decision-committed",
    qualification: "contract feasibility only; no production interface integration proven",
  }));
  console.log("PASS: shared-session contract rejects stale authority, rolls back both writes, and permits current owner");
} finally { await mongoose.disconnect(); }
