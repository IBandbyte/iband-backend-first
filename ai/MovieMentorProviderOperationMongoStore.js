import mongoose from "mongoose";
import { normalizeMovieMentorProviderTarget } from "./MovieMentorProviderTargetAuthority.js";

const VERSION = "1.0.0";
const DOMAIN = "iband.movie-mentor.provider-operation-reality";
const SCHEMA = 1;
const COLLECTION = "movie_mentor_provider_operation_reality";
let connectionPromise = null;
let model = null;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function plain(value) {
  return value && typeof value.toObject === "function" ? value.toObject() : value;
}

function iso(value) {
  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function fail(code, message, extras = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extras);
  throw error;
}

function mongoUri() {
  return text(process.env.MONGO_URI || process.env.MONGODB_URI || "");
}

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
    boundAt: { type: Date, required: true, immutable: true },
  }, { collection: COLLECTION, timestamps: true, strict: true, minimize: false });
  schema.index({ providerCallId: 1 }, { unique: true });
  schema.index({ executionId: 1, slotId: 1 });
  model = mongoose.models.MovieMentorProviderOperationReality
    || mongoose.model("MovieMentorProviderOperationReality", schema);
  return model;
}

async function ensureConnection() {
  const uri = mongoUri();
  if (!uri) fail("MOVIE_MENTOR_PROVIDER_OPERATION_MONGO_NOT_CONFIGURED", "Provider operation identity requires MONGO_URI or MONGODB_URI.");
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 10 }).catch((error) => {
      connectionPromise = null;
      fail(
        "MOVIE_MENTOR_PROVIDER_OPERATION_MONGO_UNAVAILABLE",
        `Provider operation Mongo store unavailable: ${error instanceof Error ? error.message : "Mongo connection failed."}`,
        { retryable: true },
      );
    });
  }
  await connectionPromise;
  return mongoose.connection;
}

function normalize(record) {
  if (!record) return null;
  const value = plain(record);
  if (
    value.domain !== DOMAIN
    || value.schema !== SCHEMA
    || !text(value.providerCallId)
    || !text(value.executionId)
    || !text(value.slotId)
    || !text(value.task)
    || !iso(value.boundAt)
  ) {
    fail("MOVIE_MENTOR_PROVIDER_OPERATION_RECORD_INVALID", "Durable provider operation identity is malformed.");
  }
  return Object.freeze({
    providerCallId: text(value.providerCallId),
    executionId: text(value.executionId),
    slotId: text(value.slotId),
    task: text(value.task),
    providerTarget: normalizeMovieMentorProviderTarget(value.providerTarget),
    boundAt: iso(value.boundAt),
  });
}

function sameIdentity(record, candidate) {
  return text(record?.providerCallId) === text(candidate?.providerCallId)
    && text(record?.executionId) === text(candidate?.executionId)
    && text(record?.slotId) === text(candidate?.slotId)
    && text(record?.task) === text(candidate?.task);
}

function createMovieMentorProviderOperationMongoStore({ mongoModel = null, connect = ensureConnection } = {}) {
  const storeModel = () => mongoModel || getModel();
  async function ready() {
    if (!mongoModel) await connect();
  }

  async function readOperation(providerCallId) {
    await ready();
    const row = await storeModel().findOne({ providerCallId: text(providerCallId) }).lean().exec();
    return row ? normalize(row) : null;
  }

  async function bindOperation(input = {}) {
    await ready();
    const candidate = {
      domain: DOMAIN,
      schema: SCHEMA,
      providerCallId: text(input.providerCallId),
      executionId: text(input.executionId),
      slotId: text(input.slotId),
      task: text(input.task),
      providerTarget: normalizeMovieMentorProviderTarget(input.providerTarget),
      boundAt: new Date(input.boundAt),
    };
    if (
      !candidate.providerCallId
      || !candidate.executionId
      || !candidate.slotId
      || !candidate.task
      || Number.isNaN(candidate.boundAt.getTime())
    ) {
      fail("MOVIE_MENTOR_PROVIDER_OPERATION_BINDING_INVALID", "Provider operation identity requires complete immutable call and target provenance.");
    }
    try {
      return normalize(await storeModel().create(candidate));
    } catch (error) {
      if (error?.code !== 11000) throw error;
      const existing = await readOperation(candidate.providerCallId);
      if (!existing || !sameIdentity(existing, candidate)) {
        fail("MOVIE_MENTOR_PROVIDER_OPERATION_IDENTITY_CONFLICT", "Provider operation ID is already bound to a different call universe.");
      }
      return existing;
    }
  }

  return Object.freeze({ readOperation, bindOperation });
}

function getMovieMentorProviderOperationMongoStoreStatus() {
  const configured = Boolean(mongoUri());
  return Object.freeze({
    version: VERSION,
    domain: DOMAIN,
    schema: SCHEMA,
    collection: COLLECTION,
    configured,
    durable: configured,
    immutableProviderTarget: true,
    recoveryIdentity: "provider-adapter-route-fingerprint-recovery-mode",
  });
}

export {
  VERSION as MOVIE_MENTOR_PROVIDER_OPERATION_MONGO_STORE_VERSION,
  DOMAIN as MOVIE_MENTOR_PROVIDER_OPERATION_MONGO_STORE_DOMAIN,
  createMovieMentorProviderOperationMongoStore,
  getMovieMentorProviderOperationMongoStoreStatus,
};

export default createMovieMentorProviderOperationMongoStore;
