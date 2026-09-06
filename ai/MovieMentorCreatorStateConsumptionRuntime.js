import { runMovieMentorTurn } from "./MovieMentorTurnRuntime.js";
import { readAuthoritativeTurnSource } from "./MovieMentorCreatorStateStore.js";
import { assertMovieMentorCreatorStateConsumptionAuthority } from "./MovieMentorCreatorStateConsumptionAuthority.js";

const MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_RUNTIME_VERSION = "1.2.0";

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

function sameStateUniverse(left = null, right = null) {
  return Boolean(
    left &&
    right &&
    left.projectId === right.projectId &&
    left.revision === right.revision &&
    left.creatorStateGeneration === right.creatorStateGeneration &&
    left.creatorStateFingerprint === right.creatorStateFingerprint
  );
}

function providerDispatchUniverse({ providerCall = null, current = null } = {}) {
  const executionId = s(providerCall?.executionId || current?.executionId);
  const providerCallId = s(providerCall?.providerCallId || current?.providerCallId);
  if (!executionId || !providerCallId) {
    fail("MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_DISPATCH_BINDING_REQUIRED", "Current creator-state consumption proof must bind the exact provider execution and provider-call universe before network dispatch.");
  }
  return { executionId, providerCallId };
}

function resultCandidateUniverse({ execution = null, candidate = null } = {}) {
  const executionId = s(execution?.executionId || candidate?.executionId);
  if (!executionId) {
    fail("MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_RESULT_BINDING_REQUIRED", "Current creator-state consumption proof must bind the exact execution before a result becomes durable recovery reality.");
  }
  return { executionId };
}

function staleState(stage, promoted, current) {
  fail(
    "MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_STALE",
    `${stage === "result-candidate" ? "Result-candidate staging" : "Provider dispatch"} cannot consume a creator-state universe that is no longer the current durable project state.`,
    {
      stage,
      projectId: promoted.projectId,
      promotedRevision: promoted.revision,
      currentRevision: current.revision,
      promotedCreatorStateGeneration: promoted.creatorStateGeneration,
      currentCreatorStateGeneration: current.creatorStateGeneration,
    },
  );
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

  async function requireTrackedCurrentState(stage) {
    if (!liveStateUniverse) {
      fail(
        "MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_STATE_PROOF_REQUIRED",
        `${stage === "result-candidate" ? "Result-candidate staging" : "Provider dispatch"} cannot consume creator context before an exact current durable state universe has crossed the live-turn boundary.`,
      );
    }
    const latestState = await baseRead({ projectId: liveStateUniverse.projectId });
    const latestStateUniverse = stateUniverseFrom(latestState);
    if (!sameStateUniverse(latestStateUniverse, liveStateUniverse)) staleState(stage, liveStateUniverse, latestStateUniverse);
    return latestStateUniverse;
  }

  const guardedExecutionAuthority = new Proxy(baseExecutionAuthority, {
    get(target, property, receiver) {
      if (property === "assertProviderDispatch") {
        return async (args = {}) => {
          const method = Reflect.get(target, property, receiver);
          const current = await method.call(target, args);
          if (current?.dispatchAuthorized !== true) return current;
          const latestStateUniverse = await requireTrackedCurrentState("provider-dispatch");
          const dispatchUniverse = providerDispatchUniverse({ providerCall: args?.providerCall, current });
          await assertMovieMentorCreatorStateConsumptionAuthority({
            authority,
            ...latestStateUniverse,
            ...dispatchUniverse,
            stage: "provider-dispatch",
          });
          return current;
        };
      }
      if (property === "stageResultCandidate") {
        return async (args = {}) => {
          const method = Reflect.get(target, property, receiver);
          if (typeof method !== "function") {
            fail("MOVIE_MENTOR_RESULT_CANDIDATE_AUTHORITY_REQUIRED", "Creator-state consumption runtime requires durable result-candidate staging authority.");
          }
          const latestStateUniverse = await requireTrackedCurrentState("result-candidate");
          const resultUniverse = resultCandidateUniverse({ execution: args?.execution });
          await assertMovieMentorCreatorStateConsumptionAuthority({
            authority,
            ...latestStateUniverse,
            ...resultUniverse,
            stage: "result-candidate",
          });
          return method.call(target, args);
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
  sameStateUniverse,
  providerDispatchUniverse,
  resultCandidateUniverse,
  createCreatorStateConsumptionRuntimeDeps,
  runMovieMentorTurnWithCreatorStateConsumptionAuthority,
};
export default runMovieMentorTurnWithCreatorStateConsumptionAuthority;
