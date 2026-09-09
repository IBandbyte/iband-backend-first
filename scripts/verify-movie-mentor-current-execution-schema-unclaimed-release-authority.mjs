import assert from "node:assert/strict";
import fs from "node:fs";
import { createMovieMentorInferenceSettlementMongoStore } from "../ai/MovieMentorInferenceSettlementMongoStore.js";

console.log("5A.29 — current execution schema unclaimed-release authority court");

const executionSource = fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionMongoStore.js", import.meta.url), "utf8");
const schemaMatch = executionSource.match(/SCHEMA=(\d+)/);
assert.ok(schemaMatch, "court must discover the schema emitted by the current inference-execution store");
const currentSchema = Number(schemaMatch[1]);
assert.equal(currentSchema, 6, "court is intentionally anchored to the current durable execution schema");

async function releaseReasonFor(executionSchema) {
  const execution = {
    domain: "iband.movie-mentor.inference-execution-store",
    schema: executionSchema,
    phase: "active",
    executionId: `execution-release-schema-${executionSchema}`,
    creatorTurnId: `turn-release-schema-${executionSchema}`,
    principalId: "creator-release-schema",
    projectId: "project-release-schema",
    reservationId: `reservation-release-schema-${executionSchema}`,
    requestDigest: "request-release-schema",
    providerCallsClaimed: 0,
    providerCalls: [],
  };
  const rows = new Map([["movie_mentor_inference_execution", execution]]);
  const database = {
    collection(name) {
      return {
        async findOne() { return structuredClone(rows.get(name) || null); },
      };
    },
  };
  const session = { async withTransaction(fn) { return fn(); }, async endSession() {} };
  const store = createMovieMentorInferenceSettlementMongoStore({
    connect: async () => {},
    startSession: async () => session,
    db: () => database,
    now: () => new Date("2032-01-01T00:00:01.000Z"),
  });
  return (await store.releaseUnclaimedReservation({ executionId: execution.executionId })).reason;
}

const currentReason = await releaseReasonFor(currentSchema);
assert.equal(
  currentReason,
  "reservation-binding-invalid",
  `current schema-${currentSchema} must cross execution-schema validation and reach the deliberately later reservation fence; got ${currentReason}`,
);

for (const legacySchema of [4, 5]) {
  const reason = await releaseReasonFor(legacySchema);
  assert.equal(
    reason,
    "execution-binding-invalid",
    `legacy execution schema-${legacySchema} must not acquire economic release authority; got ${reason}`,
  );
}

console.log(`✓ current execution schema-${currentSchema} crosses unclaimed-release execution validation`);
console.log("✓ legacy execution schemas cannot cross into reservation/entitlement release authority");
console.log("LAW: AN ECONOMIC RELEASE BOUNDARY MAY READ HISTORY, BUT ONLY CURRENT DURABLE EXECUTION SCHEMA MAY AUTHORIZE NEW LEDGER EFFECTS");
console.log("5A.29 current execution schema unclaimed-release authority court: GREEN");
