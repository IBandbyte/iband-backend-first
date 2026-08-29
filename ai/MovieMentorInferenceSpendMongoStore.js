import mongoose from "mongoose";

const VERSION = "1.0.0";
const DOMAIN = "iband.movie-mentor.inference-spend";
const SCHEMA = 1;
const ENTITLEMENT_COLLECTION = "movie_mentor_inference_entitlement";
const RESERVATION_COLLECTION = "movie_mentor_inference_spend_reservation";

let connectionPromise = null;
let entitlementModel = null;
let reservationModel = null;

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function units(value) { return Number.isSafeInteger(value) && value > 0 ? value : null; }
function mongoUri() { return text(process.env.MONGO_URI || process.env.MONGODB_URI || ""); }
function fail(code, message, extras = {}) { const error = new Error(message); error.code = code; Object.assign(error, extras); throw error; }
function plain(record) { return record && typeof record.toObject === "function" ? record.toObject() : record; }

function getModels() {
  if (entitlementModel && reservationModel) return { entitlementModel, reservationModel };
  const entitlementSchema = new mongoose.Schema({
    domain: { type: String, required: true, immutable: true },
    schema: { type: Number, required: true, immutable: true },
    principalId: { type: String, required: true, trim: true, immutable: true },
    status: { type: String, enum: ["active", "suspended"], required: true },
    remainingUnits: { type: Number, min: 0, required: true },
    reservedUnits: { type: Number, min: 0, required: true },
    consumedUnits: { type: Number, min: 0, required: true },
    entitlementRevision: { type: Number, min: 1, required: true },
  }, { collection: ENTITLEMENT_COLLECTION, timestamps: true, minimize: false, strict: true });
  entitlementSchema.index({ principalId: 1 }, { unique: true });

  const reservationSchema = new mongoose.Schema({
    domain: { type: String, required: true, immutable: true },
    schema: { type: Number, required: true, immutable: true },
    reservationId: { type: String, required: true, trim: true, immutable: true },
    principalId: { type: String, required: true, trim: true, immutable: true },
    projectId: { type: String, required: true, trim: true, immutable: true },
    operation: { type: String, required: true, trim: true, immutable: true },
    units: { type: Number, min: 1, required: true, immutable: true },
    entitlementRevision: { type: Number, min: 1, required: true, immutable: true },
    status: { type: String, enum: ["reserved"], required: true, immutable: true },
    reservedAt: { type: Date, required: true, immutable: true },
  }, { collection: RESERVATION_COLLECTION, timestamps: true, minimize: false, strict: true });
  reservationSchema.index({ reservationId: 1 }, { unique: true });
  reservationSchema.index({ principalId: 1, projectId: 1, reservedAt: -1 });

  entitlementModel = mongoose.models.MovieMentorInferenceEntitlement || mongoose.model("MovieMentorInferenceEntitlement", entitlementSchema);
  reservationModel = mongoose.models.MovieMentorInferenceSpendReservation || mongoose.model("MovieMentorInferenceSpendReservation", reservationSchema);
  return { entitlementModel, reservationModel };
}

async function ensureConnection() {
  const uri = mongoUri();
  if (!uri) fail("MOVIE_MENTOR_INFERENCE_SPEND_STORE_NOT_CONFIGURED", "Inference spend store requires MONGO_URI or MONGODB_URI.");
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 10 }).catch((error) => {
      connectionPromise = null;
      fail("MOVIE_MENTOR_INFERENCE_SPEND_AUTHORITY_UNAVAILABLE", `Inference spend store unavailable: ${error instanceof Error ? error.message : "Mongo connection failed."}`, { retryable: true });
    });
  }
  await connectionPromise;
  return mongoose.connection;
}

function normalizeReservation(record) {
  const value = plain(record);
  if (!value || value.domain !== DOMAIN || value.schema !== SCHEMA || !text(value.reservationId) || !text(value.principalId) || !text(value.projectId) || !text(value.operation) || !units(value.units) || !Number.isSafeInteger(value.entitlementRevision) || value.entitlementRevision < 1 || text(value.status) !== "reserved") {
    fail("MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_INVALID", "Durable inference spend reservation is malformed.");
  }
  return Object.freeze({
    reservationId: text(value.reservationId), principalId: text(value.principalId), projectId: text(value.projectId),
    operation: text(value.operation), units: value.units, entitlementRevision: value.entitlementRevision,
    status: "reserved", reservedAt: value.reservedAt ? new Date(value.reservedAt).toISOString() : null,
  });
}

function sameBinding(record, request) {
  return text(record.principalId) === request.principalId && text(record.projectId) === request.projectId && text(record.operation) === request.operation && record.units === request.units;
}

function createMovieMentorInferenceSpendMongoStore({
  models = null,
  connect = ensureConnection,
  startSession = () => mongoose.startSession(),
  now = () => new Date(),
} = {}) {
  const modelSet = () => models || getModels();
  async function ready() { if (!models) await connect(); }

  async function reserve(request = {}) {
    const normalized = {
      reservationId: text(request.reservationId), principalId: text(request.principalId), projectId: text(request.projectId),
      operation: text(request.operation), units: units(request.units),
    };
    if (!normalized.reservationId || !normalized.principalId || !normalized.projectId || !normalized.operation || !normalized.units) {
      fail("MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_INVALID", "Inference spend reservation requires reservationId, principalId, projectId, operation and positive units.");
    }
    await ready();
    const { entitlementModel: Entitlement, reservationModel: Reservation } = modelSet();
    const session = await startSession();
    let outcome = null;
    try {
      await session.withTransaction(async () => {
        const existing = await Reservation.findOne({ reservationId: normalized.reservationId }).session(session).lean().exec();
        if (existing) {
          const durable = normalizeReservation(existing);
          if (!sameBinding(durable, normalized)) fail("MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_CONFLICT", "Reservation identity is already bound to different inference spend authority.");
          outcome = Object.freeze({ granted: true, idempotent: true, reservation: durable });
          return;
        }

        const entitlement = await Entitlement.findOneAndUpdate(
          { principalId: normalized.principalId, domain: DOMAIN, schema: SCHEMA, status: "active", remainingUnits: { $gte: normalized.units } },
          { $inc: { remainingUnits: -normalized.units, reservedUnits: normalized.units, entitlementRevision: 1 } },
          { new: true, runValidators: true, session }
        ).lean().exec();
        if (!entitlement) {
          outcome = Object.freeze({ granted: false, reason: "no-active-entitlement-or-insufficient-units" });
          return;
        }

        const revision = entitlement.entitlementRevision;
        const created = await Reservation.create([{
          domain: DOMAIN, schema: SCHEMA, reservationId: normalized.reservationId, principalId: normalized.principalId,
          projectId: normalized.projectId, operation: normalized.operation, units: normalized.units,
          entitlementRevision: revision, status: "reserved", reservedAt: now(),
        }], { session });
        outcome = Object.freeze({ granted: true, idempotent: false, reservation: normalizeReservation(created[0]) });
      });
      if (!outcome) fail("MOVIE_MENTOR_INFERENCE_SPEND_AUTHORITY_UNAVAILABLE", "Inference spend transaction completed without a durable decision.", { retryable: true });
      return outcome;
    } catch (error) {
      if (error?.code?.startsWith?.("MOVIE_MENTOR_INFERENCE_SPEND_")) throw error;
      fail("MOVIE_MENTOR_INFERENCE_SPEND_AUTHORITY_UNAVAILABLE", `Inference spend reservation failed: ${error instanceof Error ? error.message : "transaction failed"}`, { retryable: true });
    } finally {
      await session.endSession();
    }
  }

  return Object.freeze({ reserve });
}

function getMovieMentorInferenceSpendMongoStoreStatus() {
  const configured = Boolean(mongoUri());
  return Object.freeze({ version: VERSION, configured, readiness: configured ? "configured" : "configuration-required", entitlementCollection: ENTITLEMENT_COLLECTION, reservationCollection: RESERVATION_COLLECTION, atomicity: "mongo-transaction", processLocalFallback: false });
}

export { VERSION as MOVIE_MENTOR_INFERENCE_SPEND_MONGO_STORE_VERSION, DOMAIN as MOVIE_MENTOR_INFERENCE_SPEND_DOMAIN, SCHEMA as MOVIE_MENTOR_INFERENCE_SPEND_SCHEMA, ENTITLEMENT_COLLECTION as MOVIE_MENTOR_INFERENCE_ENTITLEMENT_COLLECTION, RESERVATION_COLLECTION as MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_COLLECTION, createMovieMentorInferenceSpendMongoStore, getMovieMentorInferenceSpendMongoStoreStatus };
export default createMovieMentorInferenceSpendMongoStore;
