import { createMovieMentorInferenceExecutionMongoStore, getMovieMentorInferenceExecutionMongoStoreStatus } from "./MovieMentorInferenceExecutionMongoStore.js";
import { createMovieMentorInferenceExecutionLeaseAuthority } from "./MovieMentorInferenceExecutionLeaseAuthority.js";
import { createMovieMentorProviderEffectMongoStore, getMovieMentorProviderEffectMongoStoreStatus } from "./MovieMentorProviderEffectMongoStore.js";
import { createMovieMentorProviderEffectAuthority } from "./MovieMentorProviderEffectAuthority.js";

const VERSION = "1.1.0";

function createMovieMentorProductionInferenceExecutionComposition({ store = null, effectStore = null } = {}) {
  const status = store ? { configured: true, readiness: "injected" } : getMovieMentorInferenceExecutionMongoStoreStatus();
  if (status.configured !== true) return Object.freeze({ ready: false, reason: "inference-execution-store-not-configured", version: VERSION, authority: null, storeStatus: status });
  try {
    const durableStore = store || createMovieMentorInferenceExecutionMongoStore();
    const leaseAuthority = createMovieMentorInferenceExecutionLeaseAuthority({ store: durableStore });
    const effectStatus = effectStore ? { configured: true, readiness: "injected" } : getMovieMentorProviderEffectMongoStoreStatus();
    if (effectStatus.configured !== true && !store) return Object.freeze({ ready: false, reason: "provider-effect-store-not-configured", version: VERSION, authority: null, storeStatus: status, effectStoreStatus: effectStatus });
    if (effectStatus.configured !== true) return Object.freeze({ ready: true, reason: "durable-inference-execution-authority-composed-without-injected-effect-store", version: VERSION, authority: leaseAuthority, storeStatus: status, effectStoreStatus: effectStatus });
    const providerEffectAuthority = createMovieMentorProviderEffectAuthority({ store: effectStore || createMovieMentorProviderEffectMongoStore() });
    const authority = Object.freeze({ ...leaseAuthority, beginProviderDispatch: providerEffectAuthority.beginDispatch, contributeProviderEffectEvidence: providerEffectAuthority.contributeEvidence, readProviderEffectReality: providerEffectAuthority.readReality });
    return Object.freeze({ ready: true, reason: "durable-inference-execution-and-provider-effect-authority-composed", version: VERSION, authority, storeStatus: status, effectStoreStatus: effectStatus });
  } catch (error) {
    return Object.freeze({ ready: false, reason: error?.code || "inference-execution-composition-failed", version: VERSION, authority: null, storeStatus: status });
  }
}

export { VERSION as MOVIE_MENTOR_PRODUCTION_INFERENCE_EXECUTION_COMPOSITION_VERSION, createMovieMentorProductionInferenceExecutionComposition };
export default createMovieMentorProductionInferenceExecutionComposition;
