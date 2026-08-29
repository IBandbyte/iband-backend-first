import { createMovieMentorInferenceExecutionMongoStore, getMovieMentorInferenceExecutionMongoStoreStatus } from "./MovieMentorInferenceExecutionMongoStore.js";
import { createMovieMentorInferenceExecutionLeaseAuthority } from "./MovieMentorInferenceExecutionLeaseAuthority.js";

const VERSION = "1.0.0";

function createMovieMentorProductionInferenceExecutionComposition({ store = null } = {}) {
  const status = store ? { configured: true, readiness: "injected" } : getMovieMentorInferenceExecutionMongoStoreStatus();
  if (status.configured !== true) return Object.freeze({ ready: false, reason: "inference-execution-store-not-configured", version: VERSION, authority: null, storeStatus: status });
  try {
    const durableStore = store || createMovieMentorInferenceExecutionMongoStore();
    const authority = createMovieMentorInferenceExecutionLeaseAuthority({ store: durableStore });
    return Object.freeze({ ready: true, reason: "durable-inference-execution-authority-composed", version: VERSION, authority, storeStatus: status });
  } catch (error) {
    return Object.freeze({ ready: false, reason: error?.code || "inference-execution-composition-failed", version: VERSION, authority: null, storeStatus: status });
  }
}

export { VERSION as MOVIE_MENTOR_PRODUCTION_INFERENCE_EXECUTION_COMPOSITION_VERSION, createMovieMentorProductionInferenceExecutionComposition };
export default createMovieMentorProductionInferenceExecutionComposition;
