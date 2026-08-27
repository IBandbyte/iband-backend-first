import mongoose from "mongoose";

const VERSION = "1.0.0";
const COLLECTION_NAME = "movie_mentor_legacy_migration_challenges";
let connectionPromise = null;
let model = null;

function s(v) { return typeof v === "string" ? v.trim() : ""; }
function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function err(code, message, { retryable = false } = {}) { const e = new Error(message); e.code = code; e.retryable = retryable; return e; }
function mongoUri() { return s(process.env.MONGO_URI || process.env.MONGODB_URI || ""); }

function getModel() {
  if (model) return model;
  const schema = new mongoose.Schema({
    challengeId: { type: String, required: true, trim: true },
    principalId: { type: String, required: true, trim: true },
    projectId: { type: String, required: true, trim: true },
    projectIdentity: { domain: { type: String, required: true, trim: true }, schema: { type: Number, required: true }, issuance: { type: String, required: true, trim: true } },
    nonce: { type: String, required: true, trim: true },
    issuedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: ["issued", "consumed", "revoked"], required: true },
    consumptionId: { type: String, trim: true, default: null },
    consumedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    terminalReason: { type: String, trim: true, default: null },
  }, { collection: COLLECTION_NAME, timestamps: true, minimize: false, strict: true });
  schema.index({ challengeId: 1 }, { unique: true });
  schema.index({ consumptionId: 1 }, { unique: true, sparse: true });
  schema.index({ expiresAt: 1 });
  model = mongoose.models.MovieMentorLegacyMigrationChallenge || mongoose.model("MovieMentorLegacyMigrationChallenge", schema);
  return model;
}

async function ensureConnection() {
  const uri = mongoUri();
  if (!uri) throw err("MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_STORE_NOT_CONFIGURED", "Legacy migration challenge store requires MONGO_URI or MONGODB_URI.");
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!connectionPromise) connectionPromise = mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 10 }).catch(error => { connectionPromise = null; throw err("MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_STORE_UNAVAILABLE", `Legacy migration challenge store unavailable: ${error instanceof Error ? error.message : "Mongo connection failed."}`, { retryable: true }); });
  await connectionPromise;
  return mongoose.connection;
}

function normalize(doc) {
  if (!doc) return null;
  const value = doc.toObject ? doc.toObject() : doc;
  if (!s(value.challengeId) || !s(value.principalId) || !s(value.projectId) || !s(value.nonce) || !s(value.status) || !value.issuedAt || !value.expiresAt) throw err("MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_STORE_RECORD_INVALID", "Legacy migration challenge record is malformed.");
  return { challengeId: s(value.challengeId), principalId: s(value.principalId), projectId: s(value.projectId), projectIdentity: clone(value.projectIdentity), nonce: s(value.nonce), issuedAt: new Date(value.issuedAt).toISOString(), expiresAt: new Date(value.expiresAt).toISOString(), status: s(value.status), consumptionId: s(value.consumptionId) || null, consumedAt: value.consumedAt ? new Date(value.consumedAt).toISOString() : null, revokedAt: value.revokedAt ? new Date(value.revokedAt).toISOString() : null, terminalReason: s(value.terminalReason) || null };
}

async function persistMovieMentorLegacyMigrationChallenge(challenge = {}) {
  await ensureConnection();
  const doc = { challengeId: s(challenge.challengeId), principalId: s(challenge.principalId), projectId: s(challenge.projectId), projectIdentity: clone(challenge.projectIdentity), nonce: s(challenge.nonce), issuedAt: new Date(challenge.issuedAt), expiresAt: new Date(challenge.expiresAt), status: "issued" };
  if (!doc.challengeId || !doc.principalId || !doc.projectId || !doc.nonce || Number.isNaN(doc.issuedAt.getTime()) || Number.isNaN(doc.expiresAt.getTime()) || doc.expiresAt <= doc.issuedAt) throw err("MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_STORE_RECORD_INVALID", "Legacy migration challenge creation is malformed.");
  try { return normalize(await getModel().create(doc)); }
  catch (error) { if (error?.code === 11000) throw err("MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_ALREADY_EXISTS", "Legacy migration challenge identity already exists."); throw error; }
}

async function readMovieMentorLegacyMigrationChallenge({ challengeId } = {}) {
  await ensureConnection(); const id = s(challengeId);
  if (!id) throw err("MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_ID_REQUIRED", "Challenge read requires challengeId.");
  const doc = await getModel().findOne({ challengeId: id }).lean().exec();
  if (!doc) throw err("MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_NOT_FOUND", "Legacy migration challenge does not exist.");
  return normalize(doc);
}

async function consumeMovieMentorLegacyMigrationChallenge({ challengeId, expectedStatus = "issued", principalId, projectId, consumptionId, consumedAt } = {}) {
  await ensureConnection();
  const id = s(challengeId), pid = s(principalId), project = s(projectId), cid = s(consumptionId), at = new Date(consumedAt);
  if (!id || expectedStatus !== "issued" || !pid || !project || !cid || Number.isNaN(at.getTime())) throw err("MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_CONSUME_INVALID", "Atomic challenge consumption requires exact issued coordinates and consumption identity.");
  let result;
  try { result = await getModel().findOneAndUpdate({ challengeId: id, status: "issued", principalId: pid, projectId: project, expiresAt: { $gt: at } }, { $set: { status: "consumed", consumptionId: cid, consumedAt: at, terminalReason: "attestation-eligibility" } }, { new: true, runValidators: true }).lean().exec(); }
  catch (error) { if (error?.code === 11000) return { consumed: false }; throw error; }
  return { consumed: Boolean(result), record: result ? normalize(result) : null };
}

async function revokeMovieMentorLegacyMigrationChallenge({ challengeId, revokedAt = new Date().toISOString(), reason = "revoked" } = {}) {
  await ensureConnection(); const id = s(challengeId), at = new Date(revokedAt);
  if (!id || Number.isNaN(at.getTime())) throw err("MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_REVOKE_INVALID", "Challenge revocation requires challengeId and valid time.");
  const result = await getModel().findOneAndUpdate({ challengeId: id, status: "issued" }, { $set: { status: "revoked", revokedAt: at, terminalReason: s(reason) || "revoked" } }, { new: true, runValidators: true }).lean().exec();
  return { revoked: Boolean(result), record: result ? normalize(result) : null };
}

function getMovieMentorLegacyMigrationChallengeStoreStatus() { const configured = Boolean(mongoUri()); return { version: VERSION, configured, readiness: configured ? "configured" : "configuration-required", collection: COLLECTION_NAME, atomicTerminalCAS: true, terminalStates: ["consumed", "revoked"], challengeIdUnique: true, consumptionIdUnique: true }; }

export { VERSION as MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_STORE_VERSION, COLLECTION_NAME as MOVIE_MENTOR_LEGACY_MIGRATION_CHALLENGE_COLLECTION, getMovieMentorLegacyMigrationChallengeStoreStatus, persistMovieMentorLegacyMigrationChallenge, readMovieMentorLegacyMigrationChallenge, consumeMovieMentorLegacyMigrationChallenge, revokeMovieMentorLegacyMigrationChallenge };
export default readMovieMentorLegacyMigrationChallenge;
