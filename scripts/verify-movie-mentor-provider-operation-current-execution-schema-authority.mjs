import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createMovieMentorProviderOperationAuthority } from "../ai/MovieMentorProviderOperationAuthority.js";
import { createMovieMentorProviderOperationMongoStore } from "../ai/MovieMentorProviderOperationMongoStore.js";

function memoryModel() {
  let row = null;
  const query = (value) => ({ lean() { return this; }, async exec() { return value ? structuredClone(value) : null; } });
  return {
    findOne(filter) { return query(row && row.providerCallId === filter.providerCallId ? row : null); },
    async create(candidate) {
      if (row) { const error = new Error("duplicate"); error.code = 11000; throw error; }
      row = structuredClone(candidate);
      return structuredClone(row);
    },
    updateOne() { return { async exec() { return { modifiedCount: 0 }; } }; },
  };
}

const routeFingerprint = crypto.createHash("sha256").update("generic-http|https://provider-operation-schema.example.test/v1/infer").digest("hex");

async function attempt(executionSchema) {
  const store = createMovieMentorProviderOperationMongoStore({ mongoModel: memoryModel() });
  const authority = createMovieMentorProviderOperationAuthority({
    store,
    now: () => new Date("2035-01-01T00:00:00.000Z"),
    resolveCurrentTarget: () => ({ provider: "generic-http", adapter: "generic-http", routeFingerprint, recoveryMode: "none" }),
    resolveCurrentModel: () => null,
  });
  const providerCall = Object.freeze({
    authorized: true,
    dispatchAuthorized: true,
    schema: executionSchema,
    providerCallId: `call-schema-${executionSchema}`,
    executionId: `execution-schema-${executionSchema}`,
    slotId: "semantic",
    task: "movie-mentor-semantic",
    ownerId: "owner-schema-court",
    leaseGeneration: 4,
    leaseReference: "lease-schema-court",
    fencingToken: "fence-schema-court",
  });
  try { return { ok: true, result: await authority.bindOperation({ providerCall }) }; }
  catch (error) { return { ok: false, error }; }
}

const current = await attempt(6);
assert.equal(current.ok, true, `current schema-6 provider-call authority must bind durable provider-operation identity; observed ${current.error?.code || "no-error-code"}`);
assert.equal(current.result.authorized, true);

const legacy = await attempt(5);
assert.equal(legacy.ok, false, "legacy execution-shaped provider-call proof must not acquire a new durable provider-operation identity");
assert.equal(legacy.error?.code, "MOVIE_MENTOR_PROVIDER_OPERATION_CURRENT_EXECUTION_SCHEMA_REQUIRED");

console.log("GREEN: provider-operation binding independently requires current durable execution schema authority.");
console.log("LAW: A PROVIDER OPERATION IDENTITY MUST NOT BORROW CURRENT-SCHEMA AUTHORITY FROM A NEIGHBOURING LEASE PROOF.");
