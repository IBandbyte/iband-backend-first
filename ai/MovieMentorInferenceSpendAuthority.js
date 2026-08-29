import crypto from "node:crypto";

const VERSION = "1.0.0";
const DOMAIN = "iband.movie-mentor.inference-spend-authority";
const OPERATION = "movie-mentor-turn";
const DEFAULT_TURN_UNITS = 1;

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function fail(code, message, extras = {}) { const error = new Error(message); error.code = code; Object.assign(error, extras); throw error; }

function createMovieMentorInferenceSpendAuthority({ store = null, createReservationId = () => crypto.randomUUID() } = {}) {
  if (typeof store?.reserve !== "function") fail("MOVIE_MENTOR_INFERENCE_SPEND_AUTHORITY_REQUIRED", "Inference spend authority requires a durable atomic reservation store.");

  async function reserveTurn({ serverAuthority = null, projectId = null, units = DEFAULT_TURN_UNITS } = {}) {
    const principalId = text(serverAuthority?.principalId);
    const authorizedProjectId = text(serverAuthority?.projectId);
    const durableProjectId = text(projectId);
    if (!principalId) fail("MOVIE_MENTOR_INFERENCE_SPEND_PRINCIPAL_REQUIRED", "Authenticated principal authority is required before paid inference.");
    if (!authorizedProjectId || !durableProjectId) fail("MOVIE_MENTOR_INFERENCE_SPEND_PROJECT_REQUIRED", "Authorized and durable project identity are required before paid inference.");
    if (authorizedProjectId !== durableProjectId) fail("MOVIE_MENTOR_INFERENCE_SPEND_PROJECT_CONFLICT", "Authenticated project authority does not match durable creator state.");
    if (serverAuthority?.authenticated !== true || serverAuthority?.projectAuthorized !== true) fail("MOVIE_MENTOR_INFERENCE_SPEND_AUTHORITY_REQUIRED", "Paid inference requires server-created authenticated project authority.");
    if (!Number.isSafeInteger(units) || units < 1) fail("MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_INVALID", "Inference spend units must be a positive safe integer.");

    const reservationId = text(createReservationId());
    if (!reservationId) fail("MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_INVALID", "Server reservation identity could not be created.");
    const decision = await store.reserve({ reservationId, principalId, projectId: durableProjectId, operation: OPERATION, units });
    if (decision?.granted !== true) fail("MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_DENIED", "Creator has no active inference entitlement with sufficient reserved capacity.", { retryable: false, reason: decision?.reason || "reservation-denied" });
    const reservation = decision.reservation;
    if (!reservation || text(reservation.reservationId) !== reservationId || text(reservation.principalId) !== principalId || text(reservation.projectId) !== durableProjectId || text(reservation.operation) !== OPERATION || reservation.units !== units || text(reservation.status) !== "reserved") {
      fail("MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_INVALID", "Durable inference spend reservation does not bind the requested creator, project and operation.");
    }
    return Object.freeze({ authorized: true, domain: DOMAIN, reservationId, principalId, projectId: durableProjectId, operation: OPERATION, units, entitlementRevision: reservation.entitlementRevision ?? null, idempotent: decision.idempotent === true });
  }

  return Object.freeze({ reserveTurn });
}

export { VERSION as MOVIE_MENTOR_INFERENCE_SPEND_AUTHORITY_VERSION, DOMAIN as MOVIE_MENTOR_INFERENCE_SPEND_AUTHORITY_DOMAIN, OPERATION as MOVIE_MENTOR_INFERENCE_SPEND_OPERATION, DEFAULT_TURN_UNITS as MOVIE_MENTOR_INFERENCE_SPEND_DEFAULT_TURN_UNITS, createMovieMentorInferenceSpendAuthority };
export default createMovieMentorInferenceSpendAuthority;
