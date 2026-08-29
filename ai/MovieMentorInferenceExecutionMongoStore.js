import mongoose from "mongoose";

const VERSION = "1.1.0";
const DOMAIN = "iband.movie-mentor.inference-execution-store";
const SCHEMA = 2;
const COLLECTION = "movie_mentor_inference_execution";
const ACTIVE_PHASE = "active";
const PHASES = Object.freeze(["active", "closing", "closed", "finalized", "quarantined"]);

let connectionPromise = null;
let model = null;

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function fail(code, message, extras = {}) { const error = new Error(message); error.code = code; Object.assign(error, extras); throw error; }
function date(value) { const parsed = value instanceof Date ? new Date(value) : new Date(value); return Number.isNaN(parsed.getTime()) ? null : parsed; }
function iso(value) { const parsed = date(value); return parsed ? parsed.toISOString() : ""; }
function plain(record) { return record && typeof record.toObject === "function" ? record.toObject() : record; }
function mongoUri() { return text(process.env.MONGO_URI || process.env.MONGODB_URI || ""); }

function getModel() {
  if (model) return model;
  const providerCallSchema = new mongoose.Schema({
    providerCallId: { type: String, required: true, immutable: true, trim: true },
    slotId: { type: String, required: true, immutable: true, trim: true },
    task: { type: String, required: true, immutable: true, trim: true },
    state: { type: String, enum: ["admitted"], required: true },
    leaseGeneration: { type: Number, min: 1, required: true, immutable: true },
    leaseReference: { type: String, required: true, immutable: true, trim: true },
    fencingToken: { type: String, required: true, immutable: true, trim: true },
    admittedAt: { type: Date, required: true, immutable: true },
  }, { _id: false, strict: true, minimize: false });

  const schema = new mongoose.Schema({
    domain: { type: String, required: true, immutable: true },
    schema: { type: Number, required: true, immutable: true },
    executionId: { type: String, required: true, immutable: true, trim: true },
    creatorTurnId: { type: String, required: true, immutable: true, trim: true },
    principalId: { type: String, required: true, immutable: true, trim: true },
    projectId: { type: String, required: true, immutable: true, trim: true },
    reservationId: { type: String, required: true, immutable: true, trim: true },
    requestDigest: { type: String, required: true, immutable: true, trim: true },
    phase: { type: String, enum: PHASES, required: true },
    ownerId: { type: String, required: true, trim: true },
    leaseGeneration: { type: Number, min: 1, required: true },
    leaseReference: { type: String, required: true, trim: true },
    fencingToken: { type: String, required: true, trim: true },
    leaseAcquiredAt: { type: Date, required: true },
    leaseExpiresAt: { type: Date, required: true },
    maxProviderCalls: { type: Number, min: 1, required: true },
    providerCallsClaimed: { type: Number, min: 0, required: true },
    providerCalls: { type: [providerCallSchema], default: [] },
  }, { collection: COLLECTION, timestamps: true, minimize: false, strict: true });

  schema.index({ executionId: 1 }, { unique: true });
  schema.index({ principalId: 1, projectId: 1, creatorTurnId: 1 }, { unique: true });
  schema.index({ reservationId: 1 }, { unique: true });
  schema.index({ executionId: 1, "providerCalls.slotId": 1 });
  model = mongoose.models.MovieMentorInferenceExecution || mongoose.model("MovieMentorInferenceExecution", schema);
  return model;
}

async function ensureConnection() {
  const uri = mongoUri();
  if (!uri) fail("MOVIE_MENTOR_INFERENCE_EXECUTION_MONGO_NOT_CONFIGURED", "Inference execution Mongo store requires MONGO_URI or MONGODB_URI.");
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 10 }).catch((error) => {
      connectionPromise = null;
      fail("MOVIE_MENTOR_INFERENCE_EXECUTION_MONGO_UNAVAILABLE", `Inference execution Mongo store unavailable: ${error instanceof Error ? error.message : "Mongo connection failed."}`, { retryable: true });
    });
  }
  await connectionPromise;
  return mongoose.connection;
}

function inspectProviderCall(call) {
  if (!call || typeof call !== "object" || Array.isArray(call)) return false;
  if (![call.providerCallId, call.slotId, call.task, call.leaseReference, call.fencingToken].every(text)) return false;
  if (text(call.state) !== "admitted" || !Number.isSafeInteger(call.leaseGeneration) || call.leaseGeneration < 1 || !iso(call.admittedAt)) return false;
  return true;
}

function inspectMovieMentorInferenceExecution(record) {
  const value = plain(record);
  if (!value || typeof value !== "object" || Array.isArray(value)) return Object.freeze({ valid: false, reason: "record-not-object" });
  if (value.domain !== DOMAIN || value.schema !== SCHEMA) return Object.freeze({ valid: false, reason: "domain-or-schema-invalid" });
  const required = ["executionId", "creatorTurnId", "principalId", "projectId", "reservationId", "requestDigest", "phase", "ownerId", "leaseReference", "fencingToken"];
  if (required.some((field) => !text(value[field]))) return Object.freeze({ valid: false, reason: "identity-or-fence-invalid" });
  if (!PHASES.includes(text(value.phase))) return Object.freeze({ valid: false, reason: "phase-invalid" });
  if (!Number.isSafeInteger(value.leaseGeneration) || value.leaseGeneration < 1) return Object.freeze({ valid: false, reason: "generation-invalid" });
  if (!Number.isSafeInteger(value.maxProviderCalls) || value.maxProviderCalls < 1) return Object.freeze({ valid: false, reason: "provider-call-budget-invalid" });
  if (!Number.isSafeInteger(value.providerCallsClaimed) || value.providerCallsClaimed < 0 || value.providerCallsClaimed > value.maxProviderCalls) return Object.freeze({ valid: false, reason: "provider-call-claim-count-invalid" });
  const providerCalls = Array.isArray(value.providerCalls) ? value.providerCalls : [];
  if (providerCalls.length !== value.providerCallsClaimed || providerCalls.some((call) => !inspectProviderCall(call))) return Object.freeze({ valid: false, reason: "provider-call-ledger-invalid" });
  if (new Set(providerCalls.map((call) => text(call.slotId))).size !== providerCalls.length) return Object.freeze({ valid: false, reason: "provider-call-slot-duplicate" });
  const acquiredAt = iso(value.leaseAcquiredAt), expiresAt = iso(value.leaseExpiresAt);
  if (!acquiredAt || !expiresAt || new Date(expiresAt).getTime() <= new Date(acquiredAt).getTime()) return Object.freeze({ valid: false, reason: "lease-time-invalid" });
  return Object.freeze({ valid: true, acquiredAt, expiresAt });
}

function normalize(record) {
  if (!record) return null;
  const value = plain(record);
  const inspection = inspectMovieMentorInferenceExecution(value);
  if (!inspection.valid) fail("MOVIE_MENTOR_INFERENCE_EXECUTION_MONGO_RECORD_INVALID", "Durable inference execution record is malformed.", { reason: inspection.reason });
  return Object.freeze({
    executionId: text(value.executionId), creatorTurnId: text(value.creatorTurnId), principalId: text(value.principalId), projectId: text(value.projectId), reservationId: text(value.reservationId), requestDigest: text(value.requestDigest),
    phase: text(value.phase), ownerId: text(value.ownerId), leaseGeneration: value.leaseGeneration, leaseReference: text(value.leaseReference), fencingToken: text(value.fencingToken),
    leaseAcquiredAt: inspection.acquiredAt, leaseExpiresAt: inspection.expiresAt, maxProviderCalls: value.maxProviderCalls, providerCallsClaimed: value.providerCallsClaimed,
    providerCalls: Object.freeze((value.providerCalls || []).map((call) => Object.freeze({ providerCallId: text(call.providerCallId), slotId: text(call.slotId), task: text(call.task), state: "admitted", leaseGeneration: call.leaseGeneration, leaseReference: text(call.leaseReference), fencingToken: text(call.fencingToken), admittedAt: iso(call.admittedAt) }))),
  });
}

function candidate(record = {}) {
  const value = {
    domain: DOMAIN, schema: SCHEMA,
    executionId: text(record.executionId), creatorTurnId: text(record.creatorTurnId), principalId: text(record.principalId), projectId: text(record.projectId), reservationId: text(record.reservationId), requestDigest: text(record.requestDigest),
    phase: text(record.phase), ownerId: text(record.ownerId), leaseGeneration: record.leaseGeneration, leaseReference: text(record.leaseReference), fencingToken: text(record.fencingToken),
    leaseAcquiredAt: date(record.leaseAcquiredAt), leaseExpiresAt: date(record.leaseExpiresAt), maxProviderCalls: record.maxProviderCalls, providerCallsClaimed: record.providerCallsClaimed,
    providerCalls: (record.providerCalls || []).map((call) => ({ providerCallId: text(call.providerCallId), slotId: text(call.slotId), task: text(call.task), state: text(call.state), leaseGeneration: call.leaseGeneration, leaseReference: text(call.leaseReference), fencingToken: text(call.fencingToken), admittedAt: date(call.admittedAt) })),
  };
  const inspection = inspectMovieMentorInferenceExecution(value);
  if (!inspection.valid) fail("MOVIE_MENTOR_INFERENCE_EXECUTION_MONGO_RECORD_INVALID", "Inference execution write candidate is malformed.", { reason: inspection.reason });
  return value;
}

function sameImmutableBinding(left, right) {
  return ["executionId", "creatorTurnId", "principalId", "projectId", "reservationId", "requestDigest", "maxProviderCalls"].every((field) => String(left?.[field]) === String(right?.[field]));
}

function createMovieMentorInferenceExecutionMongoStore({ mongoModel = null, connect = ensureConnection } = {}) {
  const storeModel = () => mongoModel || getModel();
  async function ready() { if (!mongoModel) await connect(); }

  async function readExecution(executionId) {
    await ready();
    const record = await storeModel().findOne({ executionId: text(executionId) }).lean().exec();
    return record ? normalize(record) : null;
  }

  async function readExecutionByCreatorTurn({ principalId, projectId, creatorTurnId } = {}) {
    await ready();
    const record = await storeModel().findOne({ principalId: text(principalId), projectId: text(projectId), creatorTurnId: text(creatorTurnId) }).lean().exec();
    return record ? normalize(record) : null;
  }

  async function createExecution(record = {}) {
    await ready();
    const next = candidate(record);
    if (next.phase !== ACTIVE_PHASE || next.leaseGeneration !== 1 || next.providerCallsClaimed !== 0 || next.providerCalls.length !== 0) fail("MOVIE_MENTOR_INFERENCE_EXECUTION_MONGO_CREATE_STATE_INVALID", "New inference execution must begin active at generation 1 with zero provider calls claimed.");
    try { return normalize(await storeModel().create(next)); } catch (error) { if (error?.code === 11000) return null; throw error; }
  }

  async function replaceExecution(record = {}, expected = {}) {
    await ready();
    const next = candidate(record);
    const expectedGeneration = expected.expectedLeaseGeneration, expectedReference = text(expected.expectedLeaseReference), expectedPhase = text(expected.expectedPhase), expectedExpiresAt = expected.expectedLeaseExpiresAt ? iso(expected.expectedLeaseExpiresAt) : "";
    if (!Number.isSafeInteger(expectedGeneration) || expectedGeneration < 1 || !expectedReference || !expectedPhase) fail("MOVIE_MENTOR_INFERENCE_EXECUTION_MONGO_CAS_REQUIRED", "Inference execution replacement requires expected phase, generation and lease reference.");

    const current = await storeModel().findOne({ executionId: next.executionId }).lean().exec();
    if (!current) return null;
    const normalizedCurrent = normalize(current);
    if (!sameImmutableBinding(normalizedCurrent, next)) fail("MOVIE_MENTOR_INFERENCE_EXECUTION_MONGO_IMMUTABLE_BINDING_CONFLICT", "Inference execution immutable binding cannot change.");
    if (normalizedCurrent.phase !== expectedPhase || normalizedCurrent.leaseGeneration !== expectedGeneration || normalizedCurrent.leaseReference !== expectedReference) return null;
    if (expectedExpiresAt && normalizedCurrent.leaseExpiresAt !== expectedExpiresAt) return null;
    if (JSON.stringify(normalizedCurrent.providerCalls) !== JSON.stringify(next.providerCalls.map((call) => ({ ...call, admittedAt: iso(call.admittedAt) })))) fail("MOVIE_MENTOR_INFERENCE_EXECUTION_MONGO_PROVIDER_CALL_MUTATION_FORBIDDEN", "Lease replacement cannot rewrite durable provider-call claims.");

    const sameGeneration = next.leaseGeneration === expectedGeneration, takeover = next.leaseGeneration === expectedGeneration + 1;
    if (!sameGeneration && !takeover) fail("MOVIE_MENTOR_INFERENCE_EXECUTION_MONGO_GENERATION_TRANSITION_INVALID", "Inference execution generation may remain stable or advance exactly once.");
    if (takeover && (next.leaseReference === normalizedCurrent.leaseReference || next.fencingToken === normalizedCurrent.fencingToken || next.ownerId === normalizedCurrent.ownerId)) fail("MOVIE_MENTOR_INFERENCE_EXECUTION_MONGO_TAKEOVER_FENCE_REUSE", "Execution takeover must mint new owner, lease reference and fencing token.");

    const filter = { executionId: next.executionId, phase: expectedPhase, leaseGeneration: expectedGeneration, leaseReference: expectedReference };
    if (expectedExpiresAt) filter.leaseExpiresAt = new Date(expectedExpiresAt);
    const written = await storeModel().findOneAndUpdate(filter, { $set: next }, { new: true, runValidators: true }).lean().exec();
    return written ? normalize(written) : null;
  }

  async function claimProviderCall({ executionId, ownerId, leaseGeneration, leaseReference, fencingToken, providerCallId, slotId, task, admittedAt } = {}) {
    await ready();
    const id = text(executionId), owner = text(ownerId), reference = text(leaseReference), fence = text(fencingToken), callId = text(providerCallId), slot = text(slotId), callTask = text(task), at = date(admittedAt);
    if (![id, owner, reference, fence, callId, slot, callTask].every(Boolean) || !Number.isSafeInteger(leaseGeneration) || leaseGeneration < 1 || !at) fail("MOVIE_MENTOR_INFERENCE_PROVIDER_CALL_CLAIM_INVALID", "Provider-call claim requires complete execution fencing and call identity.");
    const call = { providerCallId: callId, slotId: slot, task: callTask, state: "admitted", leaseGeneration, leaseReference: reference, fencingToken: fence, admittedAt: at };
    const filter = {
      executionId: id, phase: ACTIVE_PHASE, ownerId: owner, leaseGeneration, leaseReference: reference, fencingToken: fence,
      leaseExpiresAt: { $gt: at }, "providerCalls.slotId": { $ne: slot }, $expr: { $lt: ["$providerCallsClaimed", "$maxProviderCalls"] },
    };
    const written = await storeModel().findOneAndUpdate(filter, { $push: { providerCalls: call }, $inc: { providerCallsClaimed: 1 } }, { new: true, runValidators: true }).lean().exec();
    if (written) return Object.freeze({ claimed: true, execution: normalize(written), providerCall: Object.freeze({ ...call, admittedAt: at.toISOString() }) });
    const current = await readExecution(id);
    const existing = current?.providerCalls?.find((entry) => entry.slotId === slot) || null;
    return Object.freeze({ claimed: false, execution: current, existingProviderCall: existing });
  }

  return Object.freeze({ readExecution, readExecutionByCreatorTurn, createExecution, replaceExecution, claimProviderCall });
}

function getMovieMentorInferenceExecutionMongoStoreStatus() {
  const configured = Boolean(mongoUri());
  return Object.freeze({ version: VERSION, configured, readiness: configured ? "configured" : "configuration-required", collection: COLLECTION, durable: true, cas: "phase-generation-reference-expiry-provider-call" });
}

export {
  VERSION as MOVIE_MENTOR_INFERENCE_EXECUTION_MONGO_STORE_VERSION,
  DOMAIN as MOVIE_MENTOR_INFERENCE_EXECUTION_MONGO_STORE_DOMAIN,
  SCHEMA as MOVIE_MENTOR_INFERENCE_EXECUTION_MONGO_STORE_SCHEMA,
  COLLECTION as MOVIE_MENTOR_INFERENCE_EXECUTION_MONGO_COLLECTION,
  PHASES as MOVIE_MENTOR_INFERENCE_EXECUTION_PHASES,
  inspectMovieMentorInferenceExecution,
  createMovieMentorInferenceExecutionMongoStore,
  getMovieMentorInferenceExecutionMongoStoreStatus,
};

export default createMovieMentorInferenceExecutionMongoStore;
