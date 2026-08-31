import mongoose from "mongoose";

const VERSION = "1.0.1";
const DOMAIN = "iband.movie-mentor.journey-recovery-activation-lease-store";
const SCHEMA = 1;
const COLLECTION = "movie_mentor_journey_recovery_activation_lease";
const SERVICE_KEY = "movie-mentor-journey-recovery-activation";

let connectionPromise = null;
let model = null;

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function fail(code, message, extras = {}) { const error = new Error(message); error.code = code; Object.assign(error, extras); throw error; }
function mongoUri() { return text(process.env.MONGO_URI || process.env.MONGODB_URI || ""); }
function date(value) { if (value === null || value === undefined || value === "") return null; const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value); return Number.isNaN(parsed.getTime()) ? null : parsed; }
function iso(value) { const parsed = date(value); return parsed ? parsed.toISOString() : ""; }
function plain(record) { return record && typeof record.toObject === "function" ? record.toObject() : record; }

function getModel() {
  if (model) return model;
  const schema = new mongoose.Schema({
    domain: { type: String, required: true, immutable: true },
    schema: { type: Number, required: true, immutable: true },
    serviceKey: { type: String, required: true, immutable: true },
    processInstanceId: { type: String, required: true, trim: true },
    deploymentId: { type: String, required: true, trim: true },
    basePath: { type: String, required: true, trim: true },
    expectedIssuer: { type: String, required: true, trim: true },
    expectedAudience: { type: String, required: true, trim: true },
    status: { type: String, enum: ["active"], required: true },
    leaseGeneration: { type: Number, min: 1, required: true },
    leaseReference: { type: String, required: true, trim: true },
    fencingToken: { type: String, required: true, trim: true },
    acquiredAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  }, { collection: COLLECTION, timestamps: true, minimize: false, strict: true });
  schema.index({ serviceKey: 1 }, { unique: true });
  model = mongoose.models.MovieMentorJourneyRecoveryActivationLease || mongoose.model("MovieMentorJourneyRecoveryActivationLease", schema);
  return model;
}

async function ensureConnection() {
  const uri = mongoUri();
  if (!uri) fail("MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_MONGO_NOT_CONFIGURED", "Activation lease Mongo store requires MONGO_URI or MONGODB_URI.");
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 10 }).catch((error) => {
      connectionPromise = null;
      fail("MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_MONGO_UNAVAILABLE", `Activation lease Mongo store unavailable: ${error instanceof Error ? error.message : "Mongo connection failed."}`, { retryable: true });
    });
  }
  await connectionPromise;
  return mongoose.connection;
}

function inspectMovieMentorJourneyRecoveryActivationLease(record) {
  const value = plain(record);
  if (!value || typeof value !== "object" || Array.isArray(value)) return Object.freeze({ valid: false, reason: "record-not-object" });
  if (value.domain !== DOMAIN || value.schema !== SCHEMA || text(value.serviceKey) !== SERVICE_KEY) return Object.freeze({ valid: false, reason: "domain-schema-or-service-invalid" });
  if (text(value.status) !== "active") return Object.freeze({ valid: false, reason: "status-invalid" });
  const leaseGeneration = value.leaseGeneration;
  if (!Number.isSafeInteger(leaseGeneration) || leaseGeneration < 1) return Object.freeze({ valid: false, reason: "generation-invalid" });
  const required = ["processInstanceId", "deploymentId", "basePath", "expectedIssuer", "expectedAudience", "leaseReference", "fencingToken"];
  if (required.some((field) => !text(value[field]))) return Object.freeze({ valid: false, reason: "binding-or-fence-invalid" });
  const acquiredAt = iso(value.acquiredAt);
  const expiresAt = iso(value.expiresAt);
  if (!acquiredAt || !expiresAt || new Date(expiresAt).getTime() <= new Date(acquiredAt).getTime()) return Object.freeze({ valid: false, reason: "time-invalid" });
  return Object.freeze({ valid: true, leaseGeneration, acquiredAt, expiresAt });
}

function normalize(record) {
  if (!record) return null;
  const value = plain(record);
  const inspection = inspectMovieMentorJourneyRecoveryActivationLease(value);
  if (!inspection.valid) fail("MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_MONGO_RECORD_INVALID", "Durable activation lease record is malformed.", { reason: inspection.reason });
  return Object.freeze({
    processInstanceId: text(value.processInstanceId),
    deploymentId: text(value.deploymentId),
    basePath: text(value.basePath),
    expectedIssuer: text(value.expectedIssuer),
    expectedAudience: text(value.expectedAudience),
    status: "active",
    leaseGeneration: value.leaseGeneration,
    leaseReference: text(value.leaseReference),
    fencingToken: text(value.fencingToken),
    acquiredAt: inspection.acquiredAt,
    expiresAt: inspection.expiresAt,
  });
}

function candidate(record = {}) {
  const value = {
    domain: DOMAIN,
    schema: SCHEMA,
    serviceKey: SERVICE_KEY,
    processInstanceId: text(record.processInstanceId),
    deploymentId: text(record.deploymentId),
    basePath: text(record.basePath),
    expectedIssuer: text(record.expectedIssuer),
    expectedAudience: text(record.expectedAudience),
    status: text(record.status),
    leaseGeneration: record.leaseGeneration,
    leaseReference: text(record.leaseReference),
    fencingToken: text(record.fencingToken),
    acquiredAt: date(record.acquiredAt),
    expiresAt: date(record.expiresAt),
  };
  const inspection = inspectMovieMentorJourneyRecoveryActivationLease(value);
  if (!inspection.valid) fail("MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_MONGO_RECORD_INVALID", "Activation lease write candidate is malformed.", { reason: inspection.reason });
  return value;
}

function sameIdentity(left, right) {
  return text(left.processInstanceId) === text(right.processInstanceId) &&
    text(left.deploymentId) === text(right.deploymentId) &&
    text(left.basePath) === text(right.basePath) &&
    text(left.expectedIssuer) === text(right.expectedIssuer) &&
    text(left.expectedAudience) === text(right.expectedAudience);
}

function createMovieMentorJourneyRecoveryActivationLeaseMongoStore({
  mongoModel = null,
  connect = ensureConnection,
} = {}) {
  const storeModel = () => mongoModel || getModel();

  async function ready() { if (!mongoModel) await connect(); }

  async function readLease() {
    await ready();
    const record = await storeModel().findOne({ serviceKey: SERVICE_KEY }).lean().exec();
    return record ? normalize(record) : null;
  }

  async function createLease(record = {}) {
    await ready();
    const next = candidate(record);
    if (next.leaseGeneration !== 1) fail("MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_MONGO_CREATE_GENERATION_INVALID", "First activation lease generation must be 1.");
    try {
      return normalize(await storeModel().create(next));
    } catch (error) {
      if (error?.code === 11000) return null;
      throw error;
    }
  }

  async function replaceLease(record = {}, expected = {}) {
    await ready();
    const next = candidate(record);
    const expectedGeneration = expected.expectedLeaseGeneration;
    const expectedReference = text(expected.expectedLeaseReference);
    const expectedExpiresAt = expected.expectedExpiresAt ? iso(expected.expectedExpiresAt) : "";
    if (!Number.isSafeInteger(expectedGeneration) || expectedGeneration < 1 || !expectedReference) fail("MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_MONGO_CAS_REQUIRED", "Activation lease replacement requires expected generation and reference.");

    const renewal = next.leaseGeneration === expectedGeneration;
    const takeover = next.leaseGeneration === expectedGeneration + 1;
    if (!renewal && !takeover) fail("MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_MONGO_GENERATION_TRANSITION_INVALID", "Activation lease generation may only remain stable for renewal or advance exactly once for takeover.");
    if (renewal && !expectedExpiresAt) fail("MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_MONGO_RENEWAL_EXPIRY_CAS_REQUIRED", "Activation lease renewal requires expected previous expiry.");

    const current = await storeModel().findOne({ serviceKey: SERVICE_KEY }).lean().exec();
    if (!current) return null;
    const normalizedCurrent = normalize(current);
    if (normalizedCurrent.leaseGeneration !== expectedGeneration || normalizedCurrent.leaseReference !== expectedReference) return null;
    if (expectedExpiresAt && normalizedCurrent.expiresAt !== expectedExpiresAt) return null;

    if (renewal) {
      if (!sameIdentity(normalizedCurrent, next) || next.leaseReference !== normalizedCurrent.leaseReference || next.fencingToken !== normalizedCurrent.fencingToken || iso(next.acquiredAt) !== normalizedCurrent.acquiredAt || new Date(next.expiresAt).getTime() <= new Date(normalizedCurrent.expiresAt).getTime()) {
        fail("MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_MONGO_RENEWAL_MUTATION_INVALID", "Renewal may only advance expiry while preserving holder and fencing identity.");
      }
    } else {
      if (next.leaseReference === normalizedCurrent.leaseReference || next.fencingToken === normalizedCurrent.fencingToken) fail("MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_MONGO_TAKEOVER_FENCE_REUSE", "Takeover must mint a new lease reference and fencing token.");
    }

    const filter = { serviceKey: SERVICE_KEY, leaseGeneration: expectedGeneration, leaseReference: expectedReference };
    if (expectedExpiresAt) filter.expiresAt = new Date(expectedExpiresAt);
    const written = await storeModel().findOneAndUpdate(filter, { $set: next }, { new: true, runValidators: true }).lean().exec();
    return written ? normalize(written) : null;
  }

  return Object.freeze({ readLease, createLease, replaceLease });
}

function getMovieMentorJourneyRecoveryActivationLeaseMongoStoreStatus() {
  const configured = Boolean(mongoUri());
  return Object.freeze({ version: VERSION, configured, readiness: configured ? "configured" : "configuration-required", collection: COLLECTION, serviceKey: SERVICE_KEY, singleton: true, cas: "generation-reference-expiry" });
}

export {
  VERSION as MOVIE_MENTOR_JOURNEY_RECOVERY_ACTIVATION_LEASE_MONGO_STORE_VERSION,
  DOMAIN as MOVIE_MENTOR_JOURNEY_RECOVERY_ACTIVATION_LEASE_MONGO_STORE_DOMAIN,
  SCHEMA as MOVIE_MENTOR_JOURNEY_RECOVERY_ACTIVATION_LEASE_MONGO_STORE_SCHEMA,
  COLLECTION as MOVIE_MENTOR_JOURNEY_RECOVERY_ACTIVATION_LEASE_MONGO_COLLECTION,
  SERVICE_KEY as MOVIE_MENTOR_JOURNEY_RECOVERY_ACTIVATION_LEASE_SERVICE_KEY,
  inspectMovieMentorJourneyRecoveryActivationLease,
  createMovieMentorJourneyRecoveryActivationLeaseMongoStore,
  getMovieMentorJourneyRecoveryActivationLeaseMongoStoreStatus,
};

export default createMovieMentorJourneyRecoveryActivationLeaseMongoStore;
