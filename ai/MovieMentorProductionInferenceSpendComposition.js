import { createMovieMentorInferenceSpendAuthority } from "./MovieMentorInferenceSpendAuthority.js";
import { createMovieMentorInferenceSpendMongoStore, getMovieMentorInferenceSpendMongoStoreStatus } from "./MovieMentorInferenceSpendMongoStore.js";

const VERSION = "1.3.0";
const DOMAIN = "iband.movie-mentor.production-inference-spend-composition";
const ATOMICITY = "mongo-transaction";
const SETTLEMENT = "external-durable-current-reality-authority-only";
const ownedCompositionProofs = new WeakMap();

function ownedStatus(store) {
  if (typeof store?.getStatus !== "function") return null;
  try {
    const status = store.getStatus();
    return status && typeof status === "object" ? status : null;
  } catch {
    return null;
  }
}

function capabilityProven(status) {
  return status?.configured === true &&
    status?.atomicity === ATOMICITY &&
    status?.settlement === SETTLEMENT &&
    status?.durableReservationRead === true &&
    status?.genericSettlementCapability === false &&
    status?.processLocalFallback === false;
}

function isMovieMentorProductionInferenceSpendOwnerProof(composition, status) {
  return Boolean(composition && status && ownedCompositionProofs.get(composition) === status && composition.status === status && typeof composition.getStatus === "function" && composition.getStatus() === status);
}

function rejected(reason, storeStatus) {
  return Object.freeze({ ready: false, reason, version: VERSION, authority: null, storeStatus, status: null, getStatus: () => null });
}

function createMovieMentorProductionInferenceSpendComposition({ store = null } = {}) {
  const injectedStore = Boolean(store);
  const storeStatus = injectedStore ? ownedStatus(store) : getMovieMentorInferenceSpendMongoStoreStatus();

  if (injectedStore && !capabilityProven(storeStatus)) {
    return rejected("inference-spend-injected-capability-not-proven", storeStatus);
  }
  if (storeStatus?.configured !== true) {
    return rejected("inference-spend-store-not-configured", storeStatus);
  }
  if (!capabilityProven(storeStatus)) {
    return rejected("inference-spend-capability-not-proven", storeStatus);
  }

  try {
    const durableStore = store || createMovieMentorInferenceSpendMongoStore();
    const authority = createMovieMentorInferenceSpendAuthority({ store: durableStore });
    const status = Object.freeze({
      domain: DOMAIN,
      version: VERSION,
      production: true,
      ready: true,
      durableStoreProvenanceRequired: true,
      storeStatus,
      reserveTurn: true,
      durableReservationRead: true,
      processLocalFallback: false
    });
    const composition = Object.freeze({
      ready: true,
      reason: "durable-inference-spend-authority-composed",
      version: VERSION,
      authority,
      storeStatus,
      status,
      getStatus() { return status; }
    });
    ownedCompositionProofs.set(composition, status);
    return composition;
  } catch (error) {
    return rejected(error?.code || "inference-spend-composition-failed", storeStatus);
  }
}

export {
  VERSION as MOVIE_MENTOR_PRODUCTION_INFERENCE_SPEND_COMPOSITION_VERSION,
  DOMAIN as MOVIE_MENTOR_PRODUCTION_INFERENCE_SPEND_COMPOSITION_DOMAIN,
  createMovieMentorProductionInferenceSpendComposition,
  isMovieMentorProductionInferenceSpendOwnerProof
};
export default createMovieMentorProductionInferenceSpendComposition;
