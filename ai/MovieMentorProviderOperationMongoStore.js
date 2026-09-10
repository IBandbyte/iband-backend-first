import mongoose from "mongoose";
import { normalizeMovieMentorProviderModel, normalizeMovieMentorProviderTarget } from "./MovieMentorProviderTargetAuthority.js";

const VERSION = "1.4.0";
const DOMAIN = "iband.movie-mentor.provider-operation-reality";
const SCHEMA = 1;
const COLLECTION = "movie_mentor_provider_operation_reality";
const PHYSICAL_AUTHORITY_BOUNDARY = "before-provider-operation-read-or-irreversible-mint";
const REQUIRED_UNIQUE_INDEXES = Object.freeze([
  Object.freeze({ key: Object.freeze({ providerCallId: 1 }), unique: true }),
]);
let connectionPromise = null;
let model = null;

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function plain(value) { return value && typeof value.toObject === "function" ? value.toObject() : value; }
function clone(value) { if (value === undefined) return undefined; try { return JSON.parse(JSON.stringify(value)); } catch { return value; } }
function iso(value) { const parsed = value instanceof Date ? new Date(value) : new Date(value); return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString(); }
function fail(code, message, extras = {}) { const error = new Error(message); error.code = code; Object.assign(error, extras); throw error; }
function mongoUri() { return text(process.env.MONGO_URI || process.env.MONGODB_URI || ""); }

function getModel() {
  if (model) return model;
  const providerTargetSchema = new mongoose.Schema({
    provider: { type: String, required: true, immutable: true, trim: true },
    adapter: { type: String, required: true, immutable: true, trim: true },
    routeFingerprint: { type: String, required: true, immutable: true, trim: true },
    recoveryMode: { type: String, required: true, immutable: true, trim: true },
  }, { _id: false, strict: true, minimize: false });
  const schema = new mongoose.Schema({
    domain: { type: String, required: true, immutable: true },
    schema: { type: Number, required: true, immutable: true },
    providerCallId: { type: String, required: true, immutable: true, trim: true },
    executionId: { type: String, required: true, immutable: true, trim: true },
    slotId: { type: String, required: true, immutable: true, trim: true },
    task: { type: String, required: true, immutable: true, trim: true },
    providerTarget: { type: providerTargetSchema, required: true, immutable: true },
    providerModel: { type: String, default: null, immutable: true, trim: true },
    boundAt: { type: Date, required: true, immutable: true },
    reconstructionInputDigest: { type: String, default: null, immutable: true, trim: true },
    reconstructionInput: { type: mongoose.Schema.Types.Mixed, default: null, immutable: true },
    reconstructionInputBoundAt: { type: Date, default: null, immutable: true },
  }, { collection: COLLECTION, timestamps: true, strict: true, minimize: false });
  schema.index({ providerCallId: 1 }, { unique: true });
  schema.index({ executionId: 1, slotId: 1 });
  model = mongoose.models.MovieMentorProviderOperationReality || mongoose.model("MovieMentorProviderOperationReality", schema);
  return model;
}

async function ensureConnection() {
  const uri = mongoUri();
  if (!uri) fail("MOVIE_MENTOR_PROVIDER_OPERATION_MONGO_NOT_CONFIGURED", "Provider operation identity requires MONGO_URI or MONGODB_URI.");
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 10 }).catch((error) => {
      connectionPromise = null;
      fail("MOVIE_MENTOR_PROVIDER_OPERATION_MONGO_UNAVAILABLE", `Provider operation Mongo store unavailable: ${error instanceof Error ? error.message : "Mongo connection failed."}`, { retryable: true });
    });
  }
  await connectionPromise;
  return mongoose.connection;
}

function sameKey(actual, required) {
  const a = actual && typeof actual === "object" ? actual : {};
  const r = required && typeof required === "object" ? required : {};
  const ak = Object.keys(a); const rk = Object.keys(r);
  return ak.length === rk.length && rk.every((key) => a[key] === r[key]);
}

function assertPhysicalUniqueIndexes(indexes) {
  const physical = Array.isArray(indexes) ? indexes : [];
  for (const required of REQUIRED_UNIQUE_INDEXES) {
    if (!physical.some((index) => index?.unique === true && sameKey(index?.key, required.key))) {
      fail("MOVIE_MENTOR_PROVIDER_OPERATION_PHYSICAL_AUTHORITY_UNAVAILABLE", "Provider operation physical unique-index authority is unavailable before irreversible durable identity mint.", { retryable: true, boundary: PHYSICAL_AUTHORITY_BOUNDARY, requiredIndex: required.key });
    }
  }
  return true;
}

function normalize(record) {
  if (!record) return null;
  const value = plain(record);
  if (value.domain !== DOMAIN || value.schema !== SCHEMA || !text(value.providerCallId) || !text(value.executionId) || !text(value.slotId) || !text(value.task) || !iso(value.boundAt)) fail("MOVIE_MENTOR_PROVIDER_OPERATION_RECORD_INVALID", "Durable provider operation identity is malformed.");
  const providerTarget = normalizeMovieMentorProviderTarget(value.providerTarget);
  if (!Object.prototype.hasOwnProperty.call(value, "providerModel") || value.providerModel === undefined) fail("MOVIE_MENTOR_PROVIDER_OPERATION_MODEL_AUTHORITY_ABSENT", "Durable provider operation is missing explicit provider-model authority; absence may not be normalized into null.", { providerCallId: text(value.providerCallId) || null });
  const providerModel = value.providerModel === null ? null : normalizeMovieMentorProviderModel(value.providerModel, { provider: providerTarget.provider });
  const reconstructionInputDigest = text(value.reconstructionInputDigest) || null;
  const reconstructionInputBoundAt = value.reconstructionInputBoundAt ? iso(value.reconstructionInputBoundAt) : null;
  if ((reconstructionInputDigest && !reconstructionInputBoundAt) || (!reconstructionInputDigest && reconstructionInputBoundAt)) fail("MOVIE_MENTOR_PROVIDER_RECONSTRUCTION_INPUT_RECORD_INVALID", "Durable provider reconstruction input provenance is malformed.");
  return Object.freeze({ providerCallId: text(value.providerCallId), executionId: text(value.executionId), slotId: text(value.slotId), task: text(value.task), providerTarget, providerModel, boundAt: iso(value.boundAt), reconstructionInputDigest, reconstructionInput: reconstructionInputDigest ? clone(value.reconstructionInput) : null, reconstructionInputBoundAt });
}

function sameIdentity(record, candidate) {
  return text(record?.providerCallId) === text(candidate?.providerCallId) && text(record?.executionId) === text(candidate?.executionId) && text(record?.slotId) === text(candidate?.slotId) && text(record?.task) === text(candidate?.task);
}

function createMovieMentorProviderOperationMongoStore({ mongoModel = null, connect = ensureConnection, readPhysicalIndexes = null } = {}) {
  const storeModel = () => mongoModel || getModel();
  let physicalUniqueIndexReadinessPromise = null;

  async function readIndexes() {
    if (typeof readPhysicalIndexes === "function") return readPhysicalIndexes({ collection: COLLECTION, model: storeModel() });
    const currentModel = storeModel();
    if (typeof currentModel?.collection?.indexes === "function") return currentModel.collection.indexes();
    fail("MOVIE_MENTOR_PROVIDER_OPERATION_PHYSICAL_AUTHORITY_UNAVAILABLE", "Provider operation store cannot inspect physical Mongo indexes.", { retryable: true, boundary: PHYSICAL_AUTHORITY_BOUNDARY });
  }

  async function ready() {
    if (!mongoModel) await connect();
    if (!physicalUniqueIndexReadinessPromise) {
      physicalUniqueIndexReadinessPromise = Promise.resolve().then(readIndexes).then((indexes) => { assertPhysicalUniqueIndexes(indexes); return true; }).catch((error) => { physicalUniqueIndexReadinessPromise = null; throw error; });
    }
    await physicalUniqueIndexReadinessPromise;
  }

  async function readOperation(providerCallId) {
    await ready();
    const row = await storeModel().findOne({ providerCallId: text(providerCallId) }).lean().exec();
    return row ? normalize(row) : null;
  }

  async function bindOperation(input = {}) {
    await ready();
    const providerTarget = normalizeMovieMentorProviderTarget(input.providerTarget);
    const providerModel = normalizeMovieMentorProviderModel(input.providerModel, { provider: providerTarget.provider });
    const candidate = { domain: DOMAIN, schema: SCHEMA, providerCallId: text(input.providerCallId), executionId: text(input.executionId), slotId: text(input.slotId), task: text(input.task), providerTarget, providerModel, boundAt: new Date(input.boundAt) };
    if (!candidate.providerCallId || !candidate.executionId || !candidate.slotId || !candidate.task || Number.isNaN(candidate.boundAt.getTime())) fail("MOVIE_MENTOR_PROVIDER_OPERATION_BINDING_INVALID", "Provider operation identity requires complete immutable call and target provenance.");
    try { return normalize(await storeModel().create(candidate)); }
    catch (error) {
      if (error?.code !== 11000) throw error;
      const existing = await readOperation(candidate.providerCallId);
      if (!existing || !sameIdentity(existing, candidate)) fail("MOVIE_MENTOR_PROVIDER_OPERATION_IDENTITY_CONFLICT", "Provider operation ID is already bound to a different call universe.");
      return existing;
    }
  }

  async function bindReconstructionInput({ providerCallId, executionId, slotId, task, reconstructionInputDigest, reconstructionInput, boundAt } = {}) {
    await ready();
    const callId = text(providerCallId); const digest = text(reconstructionInputDigest); const timestamp = new Date(boundAt);
    if (!callId || !text(executionId) || !text(slotId) || !text(task) || !digest || reconstructionInput === undefined || Number.isNaN(timestamp.getTime())) fail("MOVIE_MENTOR_PROVIDER_RECONSTRUCTION_INPUT_BINDING_INVALID", "Provider reconstruction input requires complete immutable call, digest, payload and time provenance.");
    const identity = { providerCallId: callId, executionId: text(executionId), slotId: text(slotId), task: text(task) };
    const existing = await readOperation(callId);
    if (!existing || !sameIdentity(existing, identity)) fail("MOVIE_MENTOR_PROVIDER_RECONSTRUCTION_INPUT_OPERATION_INVALID", "Provider reconstruction input may bind only to the exact durable provider operation universe.");
    if (existing.reconstructionInputDigest) return existing;
    const result = await storeModel().updateOne({ providerCallId: callId, executionId: identity.executionId, slotId: identity.slotId, task: identity.task, $or: [{ reconstructionInputDigest: null }, { reconstructionInputDigest: { $exists: false } }] }, { $set: { reconstructionInputDigest: digest, reconstructionInput: clone(reconstructionInput), reconstructionInputBoundAt: timestamp } }).exec();
    const durable = await readOperation(callId);
    if (!durable?.reconstructionInputDigest) fail("MOVIE_MENTOR_PROVIDER_RECONSTRUCTION_INPUT_NOT_DURABLE", "Provider reconstruction input did not become durable.", { modifiedCount: result?.modifiedCount ?? null });
    return durable;
  }

  return Object.freeze({ readOperation, bindOperation, bindReconstructionInput });
}

function getMovieMentorProviderOperationMongoStoreStatus() {
  const configured = Boolean(mongoUri());
  return Object.freeze({ version: VERSION, domain: DOMAIN, schema: SCHEMA, collection: COLLECTION, configured, durable: configured, immutableProviderTarget: true, immutableProviderModel: true, immutableReconstructionInput: true, reconstructionInputBoundBeforeUnknownCapable: true, recoveryIdentity: "provider-adapter-route-fingerprint-recovery-mode", physicalUniqueIndexReadiness: true, physicalAuthorityBoundary: PHYSICAL_AUTHORITY_BOUNDARY, requiredPhysicalUniqueIndexes: REQUIRED_UNIQUE_INDEXES });
}

export { VERSION as MOVIE_MENTOR_PROVIDER_OPERATION_MONGO_STORE_VERSION, DOMAIN as MOVIE_MENTOR_PROVIDER_OPERATION_MONGO_STORE_DOMAIN, createMovieMentorProviderOperationMongoStore, getMovieMentorProviderOperationMongoStoreStatus };
export default createMovieMentorProviderOperationMongoStore;
