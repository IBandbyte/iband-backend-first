import mongoose from "mongoose";
import { isMovieMentorLegacyProjectOwnershipAdoptionAttestationOwnedProof } from "./MovieMentorLegacyProjectOwnershipAdoptionBoundary.js";

const MOVIE_MENTOR_PROJECT_OWNERSHIP_REGISTRY_VERSION = "1.4.0";
const MOVIE_MENTOR_PROJECT_OWNERSHIP_COLLECTION = "movie_mentor_project_ownership";
const MOVIE_MENTOR_PROJECT_OWNERSHIP_DOMAIN = "iband.movie-mentor.project-ownership";
const MOVIE_MENTOR_PROJECT_OWNERSHIP_SCHEMA = 1;
const MOVIE_MENTOR_PROJECT_OWNERSHIP_STORE_CAPABILITY_DOMAIN = "iband.movie-mentor.project-ownership-store";
const MOVIE_MENTOR_PROJECT_OWNERSHIP_AUTHORITY_CAPABILITY_DOMAIN = "iband.movie-mentor.project-ownership-authority";
const LEGACY_ADOPTION_ATTESTATION_DOMAIN = "iband.movie-mentor.legacy-ownership-adoption-attestation";
const LEGACY_ADOPTION_ATTESTATION_SCHEMA = 1;

let connectionPromise = null;
let model = null;

function s(value) { return typeof value === "string" ? value.trim() : ""; }
function n(value) { return Number.isSafeInteger(value) && value >= 0 ? value : null; }
function clone(value) { if (value === undefined) return undefined; try { return JSON.parse(JSON.stringify(value)); } catch { return value; } }
function mongoUri() { return s(process.env.MONGO_URI || process.env.MONGODB_URI || ""); }
function fail(code, message, extras = {}) { const error = new Error(message); error.code = code; Object.assign(error, extras); throw error; }

function getMovieMentorProjectOwnershipRegistryStatus() {
  const configured = Boolean(mongoUri());
  return Object.freeze({
    version: MOVIE_MENTOR_PROJECT_OWNERSHIP_REGISTRY_VERSION,
    domain: MOVIE_MENTOR_PROJECT_OWNERSHIP_STORE_CAPABILITY_DOMAIN,
    configured,
    readiness: configured ? "configured" : "configuration-required",
    collection: MOVIE_MENTOR_PROJECT_OWNERSHIP_COLLECTION,
    storage: "mongodb",
    durable: true,
    singleton: true,
    projectUnique: true,
    establishmentAuthorityUnique: true,
    createOnce: true,
    legacyAdoption: "certified-attestation-only",
    ownershipTransfer: false,
    processLocalFallback: false,
  });
}

function storeCapabilityProven(status) {
  return status?.domain === MOVIE_MENTOR_PROJECT_OWNERSHIP_STORE_CAPABILITY_DOMAIN &&
    status?.configured === true &&
    status?.storage === "mongodb" &&
    status?.durable === true &&
    status?.singleton === true &&
    status?.projectUnique === true &&
    status?.establishmentAuthorityUnique === true &&
    status?.createOnce === true &&
    status?.legacyAdoption === "certified-attestation-only" &&
    status?.ownershipTransfer === false &&
    status?.processLocalFallback === false;
}

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
  schema.index({ establishmentAuthorityId: 1 }, { unique: true });
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
    if (error?.code === 11000) fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_ALREADY_EXISTS", "Project ownership or its one-time establishment authority already exists and cannot be replayed.");
    throw error;
  }
}

function createMovieMentorProjectOwnershipAuthority({
  readOwnership = readMovieMentorProjectOwnership,
  createOwnership = createMovieMentorProjectOwnership,
  now = () => new Date().toISOString(),
} = {}) {
  const moduleOwnedStore = readOwnership === readMovieMentorProjectOwnership && createOwnership === createMovieMentorProjectOwnership;
  const storeStatus = moduleOwnedStore
    ? getMovieMentorProjectOwnershipRegistryStatus()
    : Object.freeze({
        version: MOVIE_MENTOR_PROJECT_OWNERSHIP_REGISTRY_VERSION,
        domain: MOVIE_MENTOR_PROJECT_OWNERSHIP_STORE_CAPABILITY_DOMAIN,
        configured: false,
        readiness: "injected-functions-unproven",
        collection: MOVIE_MENTOR_PROJECT_OWNERSHIP_COLLECTION,
        storage: "unknown",
        durable: false,
        singleton: false,
        projectUnique: false,
        establishmentAuthorityUnique: false,
        createOnce: false,
        legacyAdoption: "unproven",
        ownershipTransfer: false,
        processLocalFallback: true,
      });
  const provenStore = storeCapabilityProven(storeStatus);
  const authorityStatus = Object.freeze({
    version: MOVIE_MENTOR_PROJECT_OWNERSHIP_REGISTRY_VERSION,
    domain: MOVIE_MENTOR_PROJECT_OWNERSHIP_AUTHORITY_CAPABILITY_DOMAIN,
    configured: provenStore,
    readiness: provenStore ? "store-proven" : "store-capability-not-proven",
    durable: provenStore,
    authorization: "durable-owner-match",
    createOnce: provenStore,
    projectUnique: provenStore,
    establishmentAuthorityUnique: provenStore,
    legacyAdoption: provenStore ? "certified-attestation-only" : "unproven",
    ownershipTransfer: false,
    processLocalFallback: !provenStore,
    store: storeStatus,
  });

  async function establishFromTrustedAuthority({ principalId, projectId, authorityId, establishmentSource }) {
    const existing = await readOwnership({ projectId });
    if (existing) {
      const inspection = inspectMovieMentorProjectOwnership(existing);
      if (!inspection.valid) fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_RECORD_INVALID", "Existing project ownership record is malformed.");
      if (inspection.ownerPrincipalId !== principalId) fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_HIJACK_REJECTED", "Project is already owned by another principal; establishment cannot transfer ownership.", { projectId });
      if (inspection.establishmentAuthorityId !== authorityId) fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_ESTABLISHMENT_REPLAY_CONFLICT", "Existing ownership was established by different trusted authority.");
      return Object.freeze({ status: "already-established", ownership: clone(existing) });
    }

    const ownershipReference = `movie-mentor-project-ownership:${projectId}:${authorityId}`;
    try {
      const created = await createOwnership({
        projectId,
        ownerPrincipalId: principalId,
        ownershipReference,
        establishmentAuthorityId: authorityId,
        establishmentSource,
        establishedAt: now(),
      });
      return Object.freeze({ status: "established", ownership: clone(created) });
    } catch (error) {
      let durable = null;
      try {
        durable = await readOwnership({ projectId });
      } catch {
        durable = null;
      }

      if (durable) {
        const inspection = inspectMovieMentorProjectOwnership(durable);
        if (!inspection.valid) fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_RECORD_INVALID", "Durable ownership reality is malformed after an ambiguous establishment result.");
        if (inspection.ownerPrincipalId === principalId && inspection.establishmentAuthorityId === authorityId) {
          return Object.freeze({
            status: error?.code === "MOVIE_MENTOR_PROJECT_OWNERSHIP_ALREADY_EXISTS" ? "established-after-race" : "established-after-ack-loss",
            ownership: clone(durable),
          });
        }
        if (inspection.ownerPrincipalId !== principalId) {
          fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_HIJACK_REJECTED", "Concurrent ownership establishment resolved to a different principal.", { projectId });
        }
        fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_ESTABLISHMENT_REPLAY_CONFLICT", "Concurrent ownership establishment resolved to a different one-time authority.", { projectId, authorityId });
      }

      if (error?.code === "MOVIE_MENTOR_PROJECT_OWNERSHIP_ALREADY_EXISTS") {
        fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_AUTHORITY_REPLAY_REJECTED", "One-time ownership establishment authority was consumed by another project or unresolved concurrent establishment.", { projectId, authorityId });
      }
      throw error;
    }
  }

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

    return establishFromTrustedAuthority({
      principalId,
      projectId: pid,
      authorityId,
      establishmentSource: "native-project-creation",
    });
  }

  async function adoptLegacyOwnership({ principal = null, projectId = null, adoptionAttestation = null } = {}) {
    const pid = s(projectId);
    const principalId = s(principal?.principalId || principal?.userId || principal?.id);
    if (!pid) fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_PROJECT_REQUIRED", "Legacy project ownership adoption requires projectId.");
    if (!principalId || principal?.authenticated !== true) fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_AUTHENTICATION_REQUIRED", "Legacy project ownership adoption requires a deterministically authenticated principal.");

    if (
      adoptionAttestation?.certified !== true ||
      s(adoptionAttestation?.domain) !== LEGACY_ADOPTION_ATTESTATION_DOMAIN ||
      adoptionAttestation?.schema !== LEGACY_ADOPTION_ATTESTATION_SCHEMA
    ) {
      fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_LEGACY_ATTESTATION_REQUIRED", "Legacy ownership adoption requires a certified migration attestation.");
    }
    if (!isMovieMentorLegacyProjectOwnershipAdoptionAttestationOwnedProof(adoptionAttestation)) {
      fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_LEGACY_ATTESTATION_NOT_OWNER_BOUND", "Legacy ownership adoption requires the exact attestation owned by the migration certification boundary.");
    }

    const adoptionId = s(adoptionAttestation.adoptionId);
    if (!adoptionId || s(adoptionAttestation.projectId) !== pid || s(adoptionAttestation.principalId) !== principalId) {
      fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_LEGACY_ATTESTATION_CONFLICT", "Legacy migration attestation does not bind the same authenticated principal and project.");
    }

    const identity = adoptionAttestation.projectIdentity;
    if (!identity || s(identity.domain) !== "iband.movie-mentor.project" || !Number.isSafeInteger(identity.schema) || !s(identity.issuance)) {
      fail("MOVIE_MENTOR_PROJECT_OWNERSHIP_LEGACY_IDENTITY_REQUIRED", "Legacy migration attestation must bind immutable project identity evidence.");
    }

    return establishFromTrustedAuthority({
      principalId,
      projectId: pid,
      authorityId: adoptionId,
      establishmentSource: "legacy-project-adoption",
    });
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

  return Object.freeze({ establishNativeOwnership, adoptLegacyOwnership, authorizeProject, getStatus: () => authorityStatus });
}

export {
  MOVIE_MENTOR_PROJECT_OWNERSHIP_REGISTRY_VERSION,
  MOVIE_MENTOR_PROJECT_OWNERSHIP_COLLECTION,
  MOVIE_MENTOR_PROJECT_OWNERSHIP_DOMAIN,
  MOVIE_MENTOR_PROJECT_OWNERSHIP_SCHEMA,
  MOVIE_MENTOR_PROJECT_OWNERSHIP_STORE_CAPABILITY_DOMAIN,
  MOVIE_MENTOR_PROJECT_OWNERSHIP_AUTHORITY_CAPABILITY_DOMAIN,
  inspectMovieMentorProjectOwnership,
  readMovieMentorProjectOwnership,
  createMovieMentorProjectOwnership,
  createMovieMentorProjectOwnershipAuthority,
  getMovieMentorProjectOwnershipRegistryStatus,
};

export default createMovieMentorProjectOwnershipAuthority;