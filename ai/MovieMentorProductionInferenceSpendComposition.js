import { createMovieMentorInferenceSpendAuthority } from "./MovieMentorInferenceSpendAuthority.js";
import { createMovieMentorInferenceSpendMongoStore, getMovieMentorInferenceSpendMongoStoreStatus } from "./MovieMentorInferenceSpendMongoStore.js";

const VERSION = "1.1.0";
const ATOMICITY = "mongo-transaction";
const SETTLEMENT = "external-durable-current-reality-authority-only";

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

function rejected(reason, status) {
  return Object.freeze({ ready: false, reason, version: VERSION, authority: null, storeStatus: status });
}

function createMovieMentorProductionInferenceSpendComposition({ store = null } = {}) {
  const injectedStore = Boolean(store);
  const status = injectedStore ? ownedStatus(store) : getMovieMentorInferenceSpendMongoStoreStatus();

  if (injectedStore && !capabilityProven(status)) {
    return rejected("inference-spend-injected-capability-not-proven", status);
  }
  if (status?.configured !== true) {
    return rejected("inference-spend-store-not-configured", status);
  }
  if (!capabilityProven(status)) {
    return rejected("inference-spend-capability-not-proven", status);
  }

  try {
    const durableStore = store || createMovieMentorInferenceSpendMongoStore();
    const authority = createMovieMentorInferenceSpendAuthority({ store: durableStore });
    return Object.freeze({ ready: true, reason: "durable-inference-spend-authority-composed", version: VERSION, authority, storeStatus: status });
  } catch (error) {
    return rejected(error?.code || "inference-spend-composition-failed", status);
  }
}

export { VERSION as MOVIE_MENTOR_PRODUCTION_INFERENCE_SPEND_COMPOSITION_VERSION, createMovieMentorProductionInferenceSpendComposition };
export default createMovieMentorProductionInferenceSpendComposition;
