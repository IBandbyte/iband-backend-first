import mongoose from "mongoose";

const MOVIE_MENTOR_PROJECT_OWNERSHIP_REGISTRY_VERSION = "1.0.0";
const MOVIE_MENTOR_PROJECT_OWNERSHIP_COLLECTION = "movie_mentor_project_ownership";
const MOVIE_MENTOR_PROJECT_OWNERSHIP_DOMAIN = "iband.movie-mentor.project-ownership";
const MOVIE_MENTOR_PROJECT_OWNERSHIP_SCHEMA = 1;

let connectionPromise = null;
let model = null;

function s(value) { return typeof value === "string" ? value.trim() : ""; }
function n(value) { return Number.isSafeInteger(value) && value >= 0 ? value : null; }
function clone(value) { if (value === undefined) return undefined; try { return JSON.parse(JSON.stringify(value)); } catch { return value; } }
function mongoUri() { return s(process.env.MONGO_URI || process.env.MONGODB_URI || ""); }
function fail(code, message, extras = {}) { const error = new Error(message); error.code = code; Object.assign(error, extras); throw error; }

function getModel() {
  if (model) return model;
  const schema = new mongoose.Schema({
    domain: { type: String, required: true, immutable: true },
    schema: { type: Number, required: true, immutable: true },
    projectId: { type: String, trim: true, required: true, immutable: true, index: true },
    ownerPrincipalId: { type: String, trim: true, required: true, immutable: true, index: true },
    ownershipRevision: { type: Number, min: 1, required: true },
    ownershipReference: { type: String, trim: true, required: true, immutable: true },
    establishmentAuthorityId: { type: String, trim: true, required: true, immutable: true },
    establishmentSource: { type: String, trim: true, required: true, immutable: true },
    status: { type: String, enum: ["active"], default: "active", required: true },
    establishedAt: { type: Date, required: true, immutable: true },
  }, { collection: MOVIE_MENTOR_PROJECT_OWNERSHIP_COLLECTION, timestamps: true, minimize: false, strict: true });
  schema.index({ projectId: 1 }, { unique: true });
  model = mongoose.models.MovieMentorProjectOwnership || mongoose.model("MovieMentorProjectOwnership", schema);
  return model;
}

async function ensureConnection() {
  const uri = mongoUri();
  if (!uri) fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_STORE_NOT_CONFIGURED", "Project ownership registry requires MONGO_URI or MONGODB_URI.");
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 10 }).catch((error) => {
      connectionPromise = null;
      fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_STORE_UNAVAILABLE", `Project ownership registry unavailable: ${error instanceof Error ? error.message : "Mongo connection failed."}`, { retryable: true });
    });
  }
  await connectionPromise;
  return mongoose.connection;
}

function inspectMovieMentorProjectOwnership(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return Object.freeze({ valid: false, reason: "record-not-object" });
  if (record.domain !== MOVIE_MENTOR_PROJECT_OWNERSHIP_DOMAIN || record.schema !== MOVIE_MENTOR_PROJECT_OWNERSHIP_SCHEMA) return Object.freeze({ valid: false, reason: "domain-or-schema-invalid" });
  const projectId = s(record.projectId);
  const ownerPrincipalId = s(record.ownerPrincipalId);
  const ownershipRevision = n(record.ownershipRevision);
  const ownershipReference = s(record.ownershipReference);
  const establishmentAuthorityId = s(record.establishmentAuthorityId);
  if (!projectId || !ownerPrincipalId || ownershipRevision === null || ownershipRevision < 1 || !ownershipReference || !establishmentAuthorityId || s(record.status) !== "active") return Object.freeze({ valid: false, reason: "required-field-invalid" });
  return Object.freeze({ valid: true, projectId, ownerPrincipalId, ownershipRevision, ownershipReference, establishmentAuthorityId, status: "active" });
}

function normalize(record) {
  if (!record) return null;
  const plain = typeof record.toObject === "function" ? record.toObject() : record;
  const inspection = inspectMovieMentorProjectOwnership(plain);
  if (!inspection.valid) fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_RECORD_INVALID", "Project ownership registry record is malformed.", { reason: inspection.reason });
  return Object.freeze({
    domain: MOVIE_MENTOR_PROJECT_OWNERSHIP_DOMAIN,
    schema: MOVIE_MENTOR_PROJECT_OWNERSHIP_SCHEMA,
    projectId: inspection.projectId,
    ownerPrincipalId: inspection.ownerPrincipalId,
    ownershipRevision: inspection.ownershipRevision,
    ownershipReference: inspection.ownershipReference,
    establishmentAuthorityId: inspection.establishmentAuthorityId,
    establishmentSource: s(plain.establishmentSource),
    status: "active",
    establishedAt: plain.establishedAt ? new Date(plain.establishedAt).toISOString() : null,
    updatedAt: plain.updatedAt ? new Date(plain.updatedAt).toISOString() : null,
  });
}

async function readMovieMentorProjectOwnership({ projectId } = {}) {
  await ensureConnection();
  const pid = s(projectId);
  if (!pid) fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_PROJECT_REQUIRED", "Project ownership read requires projectId.");
  const record = await getModel().findOne({ projectId: pid }).lean().exec();
  return record ? normalize(record) : null;
}

async function createMovieMentorProjectOwnership(record = {}) {
  await ensureConnection();
  const candidate = {
    domain: MOVIE_MENTOR_PROJECT_OWNERSHIP_DOMAIN,
    schema: MOVIE_MENTOR_PROJECT_OWNERSHIP_SCHEMA,
    projectId: s(record.projectId),
    ownerPrincipalId: s(record.ownerPrincipalId),
    ownershipRevision: 1,
    ownershipReference: s(record.ownershipReference),
    establishmentAuthorityId: s(record.establishmentAuthorityId),
    establishmentSource: s(record.establishmentSource),
    status: "active",
    establishedAt: record.establishedAt ? new Date(record.establishedAt) : new Date(),
  };
  if (!candidate.projectId || !candidate.ownerPrincipalId || !candidate.ownershipReference || !candidate.establishmentAuthorityId || !candidate.establishmentSource || Number.isNaN(candidate.establishedAt.getTime())) {
    fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_RECORD_INVALID", "Project ownership establishment is missing required server evidence.");
  }
  try {
    return normalize(await getModel().create(candidate));
  } catch (error) {
    if (error?.code === 11000) fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_ALREADY_EXISTS", "Project ownership already exists and cannot be replaced by establishment replay.");
    throw error;
  }
}

function createMovieMentorProjectOwnershipAuthority({
  readOwnership = readMovieMentorProjectOwnership,
  createOwnership = createMovieMentorProjectOwnership,
  now = () => new Date().toISOString(),
} = {}) {
  async function establishNativeOwnership({ principal = null, projectId = null, establishmentAuthority = null } = {}) {
    const pid = s(projectId);
    const principalId = s(principal?.principalId || principal?.userId || principal?.id);
    if (!pid) fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_PROJECT_REQUIRED", "Native project ownership establishment requires projectId.");
    if (!principalId || principal?.authenticated !== true) fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_AUTHENTICATION_REQUIRED", "Native project ownership establishment requires a deterministically authenticated principal.");

    const authorityId = s(establishmentAuthority?.authorityId);
    if (establishmentAuthority?.verified !== true || s(establishmentAuthority?.type) !== "native-project-creation" || !authorityId) {
      fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_ESTABLISHMENT_AUTHORITY_REQUIRED", "Project ownership cannot be established from a client claim or bare projectId.");
    }
    if (s(establishmentAuthority.projectId) !== pid || s(establishmentAuthority.principalId) !== principalId) {
      fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_ESTABLISHMENT_CONFLICT", "Native project creation authority does not bind the same principal and project.");
    }

    const existing = await readOwnership({ projectId: pid });
    if (existing) {
      const inspection = inspectMovieMentorProjectOwnership(existing);
      if (!inspection.valid) fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_RECORD_INVALID", "Existing project ownership record is malformed.");
      if (inspection.ownerPrincipalId !== principalId) fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_HIJACK_REJECTED", "Project is already owned by another principal; native establishment cannot transfer ownership.", { projectId: pid });
      if (inspection.establishmentAuthorityId !== authorityId) fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_ESTABLISHMENT_REPLAY_CONFLICT", "Existing ownership was established by different trusted creation authority.");
      return Object.freeze({ status: "already-established", ownership: clone(existing) });
    }

    const ownershipReference = `movie-mentor-project-ownership:${pid}:${authorityId}`;
    try {
      const created = await createOwnership({
        projectId: pid,
        ownerPrincipalId: principalId,
        ownershipReference,
        establishmentAuthorityId: authorityId,
        establishmentSource: "native-project-creation",
        establishedAt: now(),
      });
      return Object.freeze({ status: "established", ownership: clone(created) });
    } catch (error) {
      if (error?.code !== "MOVIE_MENTOR_PROJECT_OWNERSHIP_ALREADY_EXISTS") throw error;
      const raced = await readOwnership({ projectId: pid });
      if (!raced) throw error;
      const inspection = inspectMovieMentorProjectOwnership(raced);
      if (inspection.valid && inspection.ownerPrincipalId === principalId && inspection.establishmentAuthorityId === authorityId) {
        return Object.freeze({ status: "established-after-race", ownership: clone(raced) });
      }
      fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_HIJACK_REJECTED", "Concurrent ownership establishment resolved to a different principal or authority.", { projectId: pid });
    }
  }

  async function authorizeProject({ principal = null, projectId = null } = {}) {
    const pid = s(projectId);
    const principalId = s(principal?.principalId || principal?.userId || principal?.id);
    if (!pid || !principalId || principal?.authenticated !== true) return Object.freeze({ authorized: false, projectId: pid || null });
    const ownership = await readOwnership({ projectId: pid });
    if (!ownership) return Object.freeze({ authorized: false, projectId: pid, reason: "ownership-not-established" });
    const inspection = inspectMovieMentorProjectOwnership(ownership);
    if (!inspection.valid) fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_RECORD_INVALID", "Project ownership authorization encountered malformed durable ownership.");
    if (inspection.ownerPrincipalId !== principalId) return Object.freeze({ authorized: false, projectId: pid, reason: "principal-not-owner" });
    return Object.freeze({
      authorized: true,
      projectId: pid,
      ownershipRef: inspection.ownershipReference,
      ownershipRevision: inspection.ownershipRevision,
      authorizationSource: "movie-mentor-project-ownership-registry",
    });
  }

  return Object.freeze({ establishNativeOwnership, authorizeProject });
}

function getMovieMentorProjectOwnershipRegistryStatus() {
  const configured = Boolean(mongoUri());
  return Object.freeze({
    version: MOVIE_MENTOR_PROJECT_OWNERSHIP_REGISTRY_VERSION,
    configured,
    readiness: configured ? "configured" : "configuration-required",
    collection: MOVIE_MENTOR_PROJECT_OWNERSHIP_COLLECTION,
    authority: "deterministic-project-ownership",
    createOnce: true,
    ownershipTransfer: false,
  });
}

export {
  MOVIE_MENTOR_PROJECT_OWNERSHIP_REGISTRY_VERSION,
  MOVIE_MENTOR_PROJECT_OWNERSHIP_COLLECTION,
  MOVIE_MENTOR_PROJECT_OWNERSHIP_DOMAIN,
  MOVIE_MENTOR_PROJECT_OWNERSHIP_SCHEMA,
  inspectMovieMentorProjectOwnership,
  readMovieMentorProjectOwnership,
  createMovieMentorProjectOwnership,
  createMovieMentorProjectOwnershipAuthority,
  getMovieMentorProjectOwnershipRegistryStatus,
};

export default createMovieMentorProjectOwnershipAuthority;
