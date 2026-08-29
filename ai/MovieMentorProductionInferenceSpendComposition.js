import { createMovieMentorInferenceSpendAuthority } from "./MovieMentorInferenceSpendAuthority.js";
import { createMovieMentorInferenceSpendMongoStore, getMovieMentorInferenceSpendMongoStoreStatus } from "./MovieMentorInferenceSpendMongoStore.js";

const VERSION = "1.0.0";

function createMovieMentorProductionInferenceSpendComposition({ store = null } = {}) {
  const status = store ? { configured: true, readiness: "injected" } : getMovieMentorInferenceSpendMongoStoreStatus();
  if (status.configured !== true) return Object.freeze({ ready: false, reason: "inference-spend-store-not-configured", version: VERSION, authority: null, storeStatus: status });
  try {
    const durableStore = store || createMovieMentorInferenceSpendMongoStore();
    const authority = createMovieMentorInferenceSpendAuthority({ store: durableStore });
    return Object.freeze({ ready: true, reason: "durable-inference-spend-authority-composed", version: VERSION, authority, storeStatus: status });
  } catch (error) {
    return Object.freeze({ ready: false, reason: error?.code || "inference-spend-composition-failed", version: VERSION, authority: null, storeStatus: status });
  }
}

export { VERSION as MOVIE_MENTOR_PRODUCTION_INFERENCE_SPEND_COMPOSITION_VERSION, createMovieMentorProductionInferenceSpendComposition };
export default createMovieMentorProductionInferenceSpendComposition;
