import { runMovieMentorTurn } from "./MovieMentorTurnRuntime.js";
import { readAuthoritativeTurnSource } from "./MovieMentorCreatorStateStore.js";
import { assertMovieMentorCreatorStateConsumptionAuthority } from "./MovieMentorCreatorStateConsumptionAuthority.js";

const MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_RUNTIME_VERSION = "1.0.0";

function s(value) { return typeof value === "string" ? value.trim() : ""; }
function n(value) { return Number.isSafeInteger(value) && value >= 0 ? value : null; }
function fail(code, message, extras = {}) { const error = new Error(message); error.code = code; error.retryable = false; Object.assign(error, extras); throw error; }

function stateUniverseFrom(state = {}) {
  const universe = Object.freeze({
    projectId: s(state?.projectId),
    revision: n(state?.revision),
    creatorStateGeneration: n(state?.creatorStateGeneration),
    creatorStateFingerprint: s(state?.creatorStateFingerprint),
  });
  if (!universe.projectId || universe.revision === null || universe.creatorStateGeneration === null || universe.creatorStateGeneration < 1 || !universe.creatorStateFingerprint) {
    fail("MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_STATE_PROOF_REQUIRED", "Live creator-state consumption requires an exact durable project, revision, generation and fingerprint universe.");
  }
  return universe;
}

function providerDispatchUniverse({ providerCall = null, current = null } = {}) {
  const executionId = s(providerCall?.executionId || current?.executionId);
  const providerCallId = s(providerCall?.providerCallId || current?.providerCallId);
  if (!executionId || !providerCallId) {
    fail("MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_DISPATCH_BINDING_REQUIRED", "Current creator-state consumption proof must bind the exact provider execution and provider-call universe before network dispatch.");
  }
  return { executionId, providerCallId };
}

function createCreatorStateConsumptionRuntimeDeps(deps = {}) {
  const authority = deps.creatorStateConsumptionAuthority;
  if (typeof authority?.assertCurrentConsumption !== "function") {
    fail("MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_AUTHORITY_REQUIRED", "Live Movie Mentor runtime requires server-created creator-state consumption authority.");
  }

  const baseRead = deps.readAuthoritativeTurnSource || readAuthoritativeTurnSource;
  if (typeof baseRead !== "function") {
    fail("MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_READ_AUTHORITY_REQUIRED", "Creator-state consumption runtime requires an authoritative durable state reader.");
  }

  const baseExecutionAuthority = deps.inferenceExecutionAuthority;
  if (!baseExecutionAuthority || typeof baseExecutionAuthority.assertProviderDispatch !== "function") {
    fail("MOVIE_MENTOR_PROVIDER_EFFECT_AUTHORITY_REQUIRED", "Creator-state consumption runtime requires the durable provider dispatch authority it independently fences.");
  }

  let liveStateUniverse = null;

  const guardedReadAuthoritativeTurnSource = async (identity = {}) => {
    const state = await baseRead(identity);
    const universe = stateUniverseFrom(state);
    await assertMovieMentorCreatorStateConsumptionAuthority({
      authority,
      ...universe,
      stage: "state-promotion",
    });
    liveStateUniverse = universe;
    return state;
  };

  const guardedExecutionAuthority = new Proxy(baseExecutionAuthority, {
    get(target, property, receiver) {
      if (property === "assertProviderDispatch") {
        return async (args = {}) => {
          const method = Reflect.get(target, property, receiver);
          const current = await method.call(target, args);
          if (current?.dispatchAuthorized !== true) return current;
          if (!liveStateUniverse) {
            fail("MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_STATE_PROOF_REQUIRED", "Provider dispatch cannot consume creator context before an exact current durable state universe has crossed the live-turn boundary.");
          }
          const dispatchUniverse = providerDispatchUniverse({ providerCall: args?.providerCall, current });
          await assertMovieMentorCreatorStateConsumptionAuthority({
            authority,
            ...liveStateUniverse,
            ...dispatchUniverse,
            stage: "provider-dispatch",
          });
          return current;
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });

  return Object.freeze({
    ...deps,
    readAuthoritativeTurnSource: guardedReadAuthoritativeTurnSource,
    inferenceExecutionAuthority: guardedExecutionAuthority,
  });
}

async function runMovieMentorTurnWithCreatorStateConsumptionAuthority(input = {}, deps = {}) {
  return runMovieMentorTurn(input, createCreatorStateConsumptionRuntimeDeps(deps));
}

export {
  MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_RUNTIME_VERSION,
  stateUniverseFrom,
  providerDispatchUniverse,
  createCreatorStateConsumptionRuntimeDeps,
  runMovieMentorTurnWithCreatorStateConsumptionAuthority,
};
export default runMovieMentorTurnWithCreatorStateConsumptionAuthority;
