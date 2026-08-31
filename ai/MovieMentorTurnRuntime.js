import crypto from "node:crypto";
import { createTurnContextEnvelope } from "./MovieMentorTurnContextControl.js";
import { orchestrateMovieMentorTurn } from "./MovieMentorTurnOrchestrator.js";
import { interpretMovieMentorSemantics } from "./MovieMentorSemanticInterpreter.js";
import { executeMovieMentorSpecialistWorkOrder, LIVE_AGENT_IDS, MOVIE_MENTOR_SPECIALIST_EXECUTOR_VERSION, SPECIALIST_CONTRACT_VERSION } from "./MovieMentorSpecialistExecutor.js";
import { synthesizeMovieMentorResponse } from "./MovieMentorSynthesisEngine.js";
import { buildCurrentCreatorTruthView } from "./MovieMentorCreatorTruthViewControl.js";
import { readAuthoritativeTurnSource, readAuthoritativeRevision, readAuthoritativeCreatorState } from "./MovieMentorCreatorStateStore.js";

const MOVIE_MENTOR_TURN_RUNTIME_VERSION = "2.6.0";
const s = (value) => (typeof value === "string" ? value.trim() : "");

function clone(value) {
  if (value === undefined) return undefined;
  try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
}

function messageFrom(input) {
  return s(input?.input?.message || input?.message || "");
}

function identityFrom(input) {
  return {
    projectId: s(input?.projectId || input?.context?.projectId) || null,
    creatorSessionId: s(input?.creatorSessionId || input?.context?.creatorSessionId) || null,
  };
}

function runtimeError(code, message, extras = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extras);
  return error;
}

function buildRequestDigest({ creatorMessage, projectId, options } = {}) {
  return crypto.createHash("sha256").update(JSON.stringify({
    creatorMessage: s(creatorMessage),
    projectId: s(projectId),
    options: clone(options || {}),
  })).digest("hex");
}

function findProviderEvidence(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return null;
  seen.add(value);
  const externalEffectId = s(value.responseId || value.providerResponseId || value.externalEffectId);
  if (externalEffectId) return { externalEffectId, provider: s(value.provider) || "unknown-provider" };
  for (const child of Object.values(value)) {
    const found = findProviderEvidence(child, seen);
    if (found) return found;
  }
  return null;
}

function assertRuntimeServerAuthority({ serverAuthority = null, requestedProjectId = null } = {}) {
  const principalId = s(serverAuthority?.principalId);
  const projectId = s(serverAuthority?.projectId);
  const requested = s(requestedProjectId);
  if (serverAuthority?.authenticated !== true || serverAuthority?.projectAuthorized !== true || !principalId || !projectId) {
    throw runtimeError(
      "MOVIE_MENTOR_INFERENCE_SERVER_AUTHORITY_REQUIRED",
      "Movie Mentor runtime requires explicit authenticated server-created principal and project authority before any durable replay, reservation or execution lookup.",
    );
  }
  if (requested && requested !== projectId) {
    throw runtimeError(
      "MOVIE_MENTOR_INFERENCE_SERVER_PROJECT_CONFLICT",
      "Requested project does not match the server-authorized project.",
      { requestedProjectId: requested, authorizedProjectId: projectId },
    );
  }
  return Object.freeze({ principalId, projectId });
}

function buildTurnEnvelopeFromDurableState({ creatorMessage, state } = {}) {
  if (!s(creatorMessage)) throw runtimeError("MOVIE_MENTOR_TURN_MESSAGE_REQUIRED", "A creator message is required for a Movie Mentor turn.");
  if (!state || typeof state !== "object") throw runtimeError("MOVIE_MENTOR_CREATOR_STATE_INVALID", "Durable creator state is required to build a Movie Mentor turn.");
  const currentCreatorTruth = buildCurrentCreatorTruthView(state.creatorConfirmedContext || []);
  return createTurnContextEnvelope({
    projectId: state.projectId || null,
    creatorSessionId: state.creatorSessionId || null,
    creatorMessage: s(creatorMessage),
    revision: {
      capturedRevision: state.revision,
      authoritativeRevision: state.revision,
      authorityReference: state.revisionAuthorityReference,
    },
    creatorState: {
      generation: state.creatorStateGeneration,
      fingerprint: state.creatorStateFingerprint,
      authorityReference: state.creatorAuthorityReference,
    },
    snapshotReference: state.snapshotReference,
    capturedAt: state.capturedAt,
    creatorConfirmedContext: clone(currentCreatorTruth),
    projectJourney: clone(state.projectJourney ?? null),
    memoryContext: clone(state.memoryContext ?? null),
    responseBlueprint: clone(state.responseBlueprint ?? null),
    communicationPlan: clone(state.communicationPlan ?? null),
  });
}

function resultResponse(canonical, settlement, { replayed = false } = {}) {
  return {
    ...clone(canonical.resultPayload),
    metadata: {
      ...(clone(canonical.resultPayload)?.metadata || {}),
      canonicalResult: {
        authorized: true,
        resultReference: canonical.resultReference,
        resultDigest: canonical.resultDigest,
        executionId: canonical.executionId,
        closureReference: canonical.closureReference,
        closureCertificateDigest: canonical.closureCertificateDigest,
        reservationId: canonical.reservationId,
        settlement: "consumed",
        settlementExecutionPhase: settlement?.executionPhase || null,
        settlementIdempotent: settlement?.idempotent === true,
        replayedFromDurableResult: replayed,
      },
    },
  };
}

function createFencedInferenceOrchestrationDeps({ execution, inferenceExecutionAuthority, deps = {}, onClaim = null } = {}) {
  const completeAuthority = execution?.authorized === true
    && typeof inferenceExecutionAuthority?.claimProviderCall === "function"
    && typeof inferenceExecutionAuthority?.beginProviderDispatch === "function"
    && typeof inferenceExecutionAuthority?.assertProviderDispatch === "function"
    && typeof inferenceExecutionAuthority?.contributeProviderEffectEvidence === "function";
  if (!completeAuthority) {
    throw runtimeError(
      "MOVIE_MENTOR_PROVIDER_EFFECT_AUTHORITY_REQUIRED",
      "Fenced orchestration requires durable provider-call admission, UNKNOWN-before-network authority, current dispatch fencing and durable provider-effect evidence capability.",
    );
  }

  const invoke = async (slotId, task, providerFunction) => {
    const decision = await inferenceExecutionAuthority.claimProviderCall({ execution, slotId, task });
    if (decision?.dispatchAuthorized !== true) {
      throw runtimeError("MOVIE_MENTOR_INFERENCE_PROVIDER_CALL_NOT_AUTHORIZED", "Provider call was not admitted under the current durable execution lease.", {
        reason: decision?.reason || "provider-call-not-authorized",
        slotId,
      });
    }
    onClaim?.(decision);

    const dispatch = await inferenceExecutionAuthority.beginProviderDispatch({ providerCall: decision });
    if (dispatch?.dispatchAuthorized !== true) {
      throw runtimeError("MOVIE_MENTOR_PROVIDER_EFFECT_DISPATCH_NOT_AUTHORIZED", "Provider dispatch requires durable UNKNOWN effect reality.", {
        reason: dispatch?.reason || "provider-effect-unknown-not-durable",
        providerCallId: decision.providerCallId,
      });
    }

    const current = await inferenceExecutionAuthority.assertProviderDispatch({ providerCall: decision });
    if (current?.dispatchAuthorized !== true) {
      throw runtimeError("MOVIE_MENTOR_INFERENCE_PROVIDER_DISPATCH_FENCED", "Provider dispatch authority was revoked before the irreversible provider boundary.", {
        reason: current?.reason || "provider-dispatch-fenced",
        providerCallId: decision.providerCallId,
      });
    }

    try {
      const result = await providerFunction();
      const evidence = findProviderEvidence(result);
      if (evidence) {
        await inferenceExecutionAuthority.contributeProviderEffectEvidence({
          providerCallId: decision.providerCallId,
          ...evidence,
          source: "provider-response",
        });
      }
      return result;
    } catch (error) {
      const evidence = findProviderEvidence(error?.providerEffectEvidence || null);
      if (evidence) {
        await inferenceExecutionAuthority.contributeProviderEffectEvidence({
          providerCallId: decision.providerCallId,
          ...evidence,
          source: "provider-error-evidence",
        });
      }
      throw error;
    }
  };

  const interpret = deps.interpretSemantics || interpretMovieMentorSemantics;
  const synthesize = deps.synthesizeResponse || synthesizeMovieMentorResponse;
  const executeWorkOrder = deps.executeSpecialistWorkOrder || executeMovieMentorSpecialistWorkOrder;

  return Object.freeze({
    async interpretSemantics(input) {
      return invoke("semantic", "movie-mentor-semantic", () => interpret(input));
    },
    async executeSpecialistPlan(plan = {}) {
      const contributions = [], skipped = [], failures = [], metadata = [];
      for (const workOrder of Array.isArray(plan?.workOrders) ? plan.workOrders : []) {
        const agentId = s(workOrder?.agentId);
        if (!LIVE_AGENT_IDS.has(agentId)) {
          skipped.push({ agentId: agentId || null, reason: "agent-not-live-yet" });
          continue;
        }
        try {
          const result = await invoke(agentId, `movie-mentor-specialist:${agentId}`, () => executeWorkOrder(clone(workOrder), deps.specialistDeps || {}));
          contributions.push(result.contribution);
          metadata.push({ agentId, metadata: clone(result.metadata || null) });
        } catch (error) {
          failures.push({
            agentId: agentId || null,
            code: error?.code || "SPECIALIST_EXECUTION_FAILED",
            message: error instanceof Error ? error.message : "Specialist execution failed.",
            validationIssues: Array.isArray(error?.validationIssues) ? error.validationIssues : [],
          });
        }
      }
      return {
        version: MOVIE_MENTOR_SPECIALIST_EXECUTOR_VERSION,
        contractVersion: SPECIALIST_CONTRACT_VERSION,
        status: failures.length ? "partial" : "completed",
        contributions,
        skipped,
        failures,
        metadata,
        authority: {
          providerCallsRequireDurableExecutionClaim: true,
          providerDispatchRequiresDurableUnknown: true,
          providerDispatchRequiresCurrentExecutionFence: true,
          creatorTruthDominates: true,
          specialistsRemainProvisional: true,
        },
        liveAgents: [...LIVE_AGENT_IDS],
      };
    },
    async synthesizeResponse(input) {
      return invoke("synthesis", "movie-mentor-synthesis", () => synthesize(input));
    },
  });
}

async function openLiveExecution({ input, creatorMessage, durableProjectId, reservation, serverAuthority, inferenceExecutionAuthority, deps, requestDigest = null } = {}) {
  const creatorTurnId = s(input?.creatorTurnId);
  if (!creatorTurnId) throw runtimeError("MOVIE_MENTOR_CREATOR_TURN_ID_REQUIRED", "Live paid inference requires a stable creatorTurnId supplied before the first transport attempt.");
  const ownerId = s(deps.createExecutionOwnerId?.()) || `turn-owner-${crypto.randomUUID()}`;
  const digest = s(requestDigest) || buildRequestDigest({ creatorMessage, projectId: durableProjectId, options: input?.options || {} });
  const opened = await inferenceExecutionAuthority.openExecution({
    creatorTurnId,
    principalId: s(serverAuthority?.principalId),
    projectId: durableProjectId,
    reservationId: s(reservation?.reservationId),
    requestDigest: digest,
    ownerId,
  });
  if (opened?.authorized !== true) throw runtimeError("MOVIE_MENTOR_INFERENCE_EXECUTION_OPEN_DENIED", "Durable inference execution could not be opened.");
  if (s(opened.phase) !== "active") {
    throw runtimeError("MOVIE_MENTOR_INFERENCE_EXECUTION_RECOVERY_REQUIRED", "Existing creator turn is no longer executable and must converge through durable recovery.", {
      phase: s(opened.phase), executionId: opened.executionId, retryable: true,
    });
  }
  if (s(opened.ownerId) === ownerId) {
    const current = await inferenceExecutionAuthority.assertFence(opened);
    if (current?.authorized !== true) throw runtimeError("MOVIE_MENTOR_INFERENCE_EXECUTION_LEASE_NOT_AUTHORIZED", "New inference execution does not hold a current durable lease.");
    return current;
  }
  const acquired = await inferenceExecutionAuthority.acquireExecution({ executionId: opened.executionId, ownerId });
  if (acquired?.authorized !== true) {
    throw runtimeError("MOVIE_MENTOR_INFERENCE_EXECUTION_LEASE_NOT_AUTHORIZED", "Inference execution lease is not currently owned by this turn attempt.", {
      reason: acquired?.reason || "lease-not-authorized",
    });
  }
  return acquired;
}

async function acquireExistingExecution({ existing, inferenceExecutionAuthority, deps } = {}) {
  const ownerId = s(deps.createExecutionOwnerId?.()) || `turn-owner-${crypto.randomUUID()}`;
  if (s(existing?.phase) !== "active") {
    throw runtimeError("MOVIE_MENTOR_INFERENCE_EXECUTION_RECOVERY_REQUIRED", "Existing creator turn is not executable.", {
      phase: s(existing?.phase), executionId: existing?.executionId, retryable: true,
    });
  }
  const acquired = await inferenceExecutionAuthority.acquireExecution({ executionId: existing.executionId, ownerId });
  if (acquired?.authorized !== true) {
    throw runtimeError("MOVIE_MENTOR_INFERENCE_EXECUTION_LEASE_NOT_AUTHORIZED", "Existing inference execution lease cannot currently be acquired.", {
      reason: acquired?.reason || "lease-not-authorized", executionId: existing.executionId, retryable: true,
    });
  }
  return acquired;
}

async function replayTerminalTurn({ existing, inferenceExecutionAuthority, settlementAuthority } = {}) {
  if (!["closed", "finalized", "settled"].includes(s(existing?.phase))) return null;
  const canonical = await inferenceExecutionAuthority.readCanonicalResult({ executionId: existing.executionId });
  if (canonical?.authorized !== true || canonical?.committed !== true) return null;
  const settlement = await settlementAuthority.reconcile({ executionId: existing.executionId });
  if (settlement?.authorized !== true || settlement?.settled !== true || settlement?.outcome !== "consumed" || settlement?.executionPhase !== "settled") {
    throw runtimeError("MOVIE_MENTOR_INFERENCE_SETTLEMENT_RECONCILIATION_PENDING", "Durable canonical result exists but settlement has not converged.", {
      executionId: existing.executionId, retryable: true,
    });
  }
  return resultResponse(canonical, settlement, { replayed: true });
}

async function recoverStagedResultTurn({ existing, inferenceExecutionAuthority, settlementAuthority } = {}) {
  if (!["closing", "closed", "finalized", "settled"].includes(s(existing?.phase))) return null;
  const candidate = await inferenceExecutionAuthority.readResultCandidate(existing.executionId);
  if (!candidate) {
    throw runtimeError("MOVIE_MENTOR_RESULT_CANDIDATE_RECOVERY_REQUIRED", "Non-executable inference universe has no durable staged result candidate.", {
      executionId: existing.executionId, phase: existing.phase, retryable: true,
    });
  }
  const closure = await inferenceExecutionAuthority.reconcileExecutionClosure({ executionId: existing.executionId });
  if (closure?.closed !== true || closure?.authorized !== true) {
    throw runtimeError("MOVIE_MENTOR_INFERENCE_EXECUTION_CLOSURE_PENDING", "Staged result exists but current provider reality cannot yet close.", {
      executionId: existing.executionId, reason: closure?.reason || "closure-pending", retryable: true,
    });
  }
  let canonical = await inferenceExecutionAuthority.readCanonicalResult({ executionId: existing.executionId });
  if (canonical?.authorized !== true || canonical?.committed !== true) {
    canonical = await inferenceExecutionAuthority.commitCanonicalResult({ closure, result: candidate.resultPayload });
  }
  if (canonical?.authorized !== true || canonical?.committed !== true) {
    throw runtimeError("MOVIE_MENTOR_CANONICAL_RESULT_COMMIT_INVALID", "Recovered staged result could not become canonical.", {
      executionId: existing.executionId, retryable: true,
    });
  }
  const settlement = await settlementAuthority.reconcile({ executionId: existing.executionId });
  if (settlement?.authorized !== true || settlement?.settled !== true || settlement?.outcome !== "consumed" || settlement?.executionPhase !== "settled") {
    throw runtimeError("MOVIE_MENTOR_INFERENCE_SETTLEMENT_RECONCILIATION_PENDING", "Recovered canonical result has not converged to settlement.", {
      executionId: existing.executionId, retryable: true,
    });
  }
  return resultResponse(canonical, settlement, { replayed: true });
}

async function convergeExistingTurn({ existing, inferenceExecutionAuthority, settlementAuthority } = {}) {
  if (!existing?.found) return null;
  if (s(existing.phase) === "aborted") {
    throw runtimeError("MOVIE_MENTOR_INFERENCE_EXECUTION_ABORTED", "Creator turn was durably aborted before any provider claim; use a new creatorTurnId for a new attempt.", {
      executionId: existing.executionId, retryable: false,
    });
  }
  if (s(existing.phase) === "quarantined") {
    throw runtimeError("MOVIE_MENTOR_INFERENCE_EXECUTION_QUARANTINED", "Creator turn belongs to a durably quarantined inference universe whose current proof is revoked; historical settlement remains preserved but cannot authorize replay or new provider work.", {
      executionId: existing.executionId,
      quarantinedFromPhase: s(existing.quarantinedFromPhase) || null,
      reason: s(existing.quarantineReason) || "durable-inference-universe-quarantined",
      retryable: false,
    });
  }
  const replay = await replayTerminalTurn({ existing, inferenceExecutionAuthority, settlementAuthority });
  if (replay) return replay;
  const recovered = await recoverStagedResultTurn({ existing, inferenceExecutionAuthority, settlementAuthority });
  if (recovered) return recovered;
  if (s(existing.phase) !== "active") {
    throw runtimeError("MOVIE_MENTOR_INFERENCE_EXECUTION_RECOVERY_REQUIRED", "Creator turn already belongs to a non-executable durable universe.", {
      phase: s(existing.phase), executionId: existing.executionId, retryable: true,
    });
  }
  return null;
}

async function releaseFailedUnclaimedExecution({ execution, settlementAuthority, error } = {}) {
  if (typeof settlementAuthority?.releaseUnclaimed !== "function") {
    throw runtimeError("MOVIE_MENTOR_INFERENCE_RELEASE_AUTHORITY_REQUIRED", "Failed inference may release spend only through atomic durable zero-claim execution authority.", {
      cause: error, retryable: true, executionId: execution?.executionId || null,
    });
  }
  let release;
  try {
    release = await settlementAuthority.releaseUnclaimed({ executionId: execution?.executionId });
  } catch (releaseError) {
    throw runtimeError("MOVIE_MENTOR_INFERENCE_RELEASE_RECONCILIATION_UNCERTAIN", "Durable zero-claim release could not be proven; spend remains reserved.", {
      cause: releaseError, originalCause: error, retryable: true, executionId: execution?.executionId || null,
    });
  }
  if (release?.authorized !== true || release?.released !== true || release?.outcome !== "released") {
    throw runtimeError("MOVIE_MENTOR_INFERENCE_EXECUTION_UNRESOLVED", "Inference failed but durable zero-claim release authority was not established; spend remains reserved for reconciliation.", {
      cause: error,
      retryable: true,
      executionId: execution?.executionId || null,
      reason: release?.reason || "unclaimed-release-not-authoritative",
      providerCallsClaimed: Number.isSafeInteger(release?.providerCallsClaimed) ? release.providerCallsClaimed : null,
    });
  }
  return release;
}

async function releaseFreshUnboundReservation({ reservation, settlementAuthority, error = null } = {}) {
  if (typeof settlementAuthority?.releaseUnbound !== "function") {
    throw runtimeError("MOVIE_MENTOR_INFERENCE_UNBOUND_RELEASE_AUTHORITY_REQUIRED", "A fresh reservation may be restored only by atomic proof that no execution is bound to it.", {
      cause: error, retryable: true, reservationId: reservation?.reservationId || null,
    });
  }
  let release;
  try {
    release = await settlementAuthority.releaseUnbound({
      reservationId: reservation?.reservationId,
      principalId: reservation?.principalId,
      projectId: reservation?.projectId,
    });
  } catch (releaseError) {
    throw runtimeError("MOVIE_MENTOR_INFERENCE_UNBOUND_RELEASE_RECONCILIATION_UNCERTAIN", "Pre-execution release could not prove absence of a durable execution binding; spend remains reserved.", {
      cause: releaseError, originalCause: error, retryable: true, reservationId: reservation?.reservationId || null,
    });
  }
  if (release?.authorized !== true || release?.released !== true || release?.outcome !== "released") {
    throw runtimeError("MOVIE_MENTOR_INFERENCE_EXECUTION_BINDING_UNRESOLVED", "Reservation release was denied because durable execution binding absence was not established; spend remains reserved.", {
      cause: error,
      retryable: true,
      reservationId: reservation?.reservationId || null,
      executionId: release?.executionId || null,
      reason: release?.reason || "unbound-release-not-authoritative",
    });
  }
  return release;
}

async function runMovieMentorTurn(input = {}, deps = {}) {
  const creatorMessage = messageFrom(input);
  if (!creatorMessage) throw runtimeError("MOVIE_MENTOR_TURN_MESSAGE_REQUIRED", "A creator message is required for a Movie Mentor turn.");
  const creatorTurnId = s(input?.creatorTurnId);
  if (!creatorTurnId) throw runtimeError("MOVIE_MENTOR_CREATOR_TURN_ID_REQUIRED", "Live paid inference requires a stable creatorTurnId supplied before the first transport attempt.");
  const identity = identityFrom(input);
  if (!identity.projectId && !identity.creatorSessionId) throw runtimeError("MOVIE_MENTOR_CREATOR_STATE_IDENTITY_REQUIRED", "projectId or creatorSessionId is required for a durable Movie Mentor turn.");

  const readSource = deps.readAuthoritativeTurnSource || readAuthoritativeTurnSource;
  const revisionReader = deps.readAuthoritativeRevision || readAuthoritativeRevision;
  const stateReader = deps.readAuthoritativeCreatorState || readAuthoritativeCreatorState;
  const orchestrate = deps.orchestrateTurn || orchestrateMovieMentorTurn;
  const spendAuthority = deps.inferenceSpendAuthority;
  const inferenceExecutionAuthority = deps.inferenceExecutionAuthority;
  const settlementAuthority = deps.inferenceSettlementAuthority;

  if (typeof spendAuthority?.reserveTurn !== "function" || typeof spendAuthority?.readReservation !== "function") {
    throw runtimeError("MOVIE_MENTOR_INFERENCE_SPEND_AUTHORITY_REQUIRED", "Movie Mentor turn runtime requires durable reservation and rehydration authority.");
  }

  const executionEnabled = typeof inferenceExecutionAuthority?.findExecutionByCreatorTurn === "function"
    && typeof inferenceExecutionAuthority?.openExecution === "function"
    && typeof inferenceExecutionAuthority?.acquireExecution === "function"
    && typeof inferenceExecutionAuthority?.assertFence === "function"
    && typeof inferenceExecutionAuthority?.claimProviderCall === "function"
    && typeof inferenceExecutionAuthority?.beginProviderDispatch === "function"
    && typeof inferenceExecutionAuthority?.assertProviderDispatch === "function"
    && typeof inferenceExecutionAuthority?.contributeProviderEffectEvidence === "function";
  const closureEnabled = executionEnabled
    && typeof inferenceExecutionAuthority?.beginExecutionClosing === "function"
    && typeof inferenceExecutionAuthority?.reconcileExecutionClosure === "function";
  const candidateEnabled = closureEnabled
    && typeof inferenceExecutionAuthority?.stageResultCandidate === "function"
    && typeof inferenceExecutionAuthority?.readResultCandidate === "function";
  const resultEnabled = candidateEnabled
    && typeof inferenceExecutionAuthority?.commitCanonicalResult === "function"
    && typeof inferenceExecutionAuthority?.readCanonicalResult === "function";
  const settlementEnabled = resultEnabled
    && typeof settlementAuthority?.reconcile === "function"
    && typeof settlementAuthority?.releaseUnclaimed === "function"
    && typeof settlementAuthority?.releaseUnbound === "function";

  if (!executionEnabled) throw runtimeError("MOVIE_MENTOR_INFERENCE_EXECUTION_AUTHORITY_REQUIRED", "Paid Movie Mentor inference cannot run without complete durable creator-turn convergence, lease fencing and provider-effect dispatch authority.");
  if (!closureEnabled) throw runtimeError("MOVIE_MENTOR_INFERENCE_EXECUTION_CLOSURE_AUTHORITY_REQUIRED", "Paid Movie Mentor inference cannot run without durable closure authority.");
  if (!candidateEnabled) throw runtimeError("MOVIE_MENTOR_RESULT_CANDIDATE_AUTHORITY_REQUIRED", "Paid Movie Mentor inference cannot run without durable pre-closure result staging authority.");
  if (!resultEnabled) throw runtimeError("MOVIE_MENTOR_CANONICAL_RESULT_AUTHORITY_REQUIRED", "Paid Movie Mentor inference cannot run without durable canonical result authority.");
  if (!settlementEnabled) throw runtimeError("MOVIE_MENTOR_INFERENCE_SETTLEMENT_RECONCILIATION_AUTHORITY_REQUIRED", "Paid Movie Mentor inference cannot run without deterministic consume, unclaimed-release and unbound-release reconciliation authority.");

  const runtimeAuthority = assertRuntimeServerAuthority({ serverAuthority: deps.serverAuthority, requestedProjectId: identity.projectId });
  const principalId = runtimeAuthority.principalId;

  // A terminal durable universe must not depend on mutable creator-state availability.
  // When project identity is already server-authorized in the request, converge the exact creator-turn universe first.
  if (identity.projectId) {
    const earlyRequestDigest = buildRequestDigest({ creatorMessage, projectId: identity.projectId, options: input?.options || {} });
    const earlyExisting = await inferenceExecutionAuthority.findExecutionByCreatorTurn({
      creatorTurnId,
      principalId,
      projectId: identity.projectId,
      requestDigest: earlyRequestDigest,
    });
    if (earlyExisting?.found) {
      const terminal = await convergeExistingTurn({ earlyExisting, existing: earlyExisting, inferenceExecutionAuthority, settlementAuthority });
      if (terminal) return terminal;
    }
  }

  const state = await readSource(identity);
  const envelope = buildTurnEnvelopeFromDurableState({ creatorMessage, state });
  const durableProjectId = s(state?.projectId || envelope?.projectId);
  if (!durableProjectId) throw runtimeError("MOVIE_MENTOR_CREATOR_STATE_PROJECT_REQUIRED", "Durable creator state did not resolve a project identity.");
  if (durableProjectId !== runtimeAuthority.projectId) {
    throw runtimeError("MOVIE_MENTOR_INFERENCE_SERVER_PROJECT_CONFLICT", "Durable creator state project does not match the server-authorized project.", {
      durableProjectId,
      authorizedProjectId: runtimeAuthority.projectId,
    });
  }

  const requestDigest = buildRequestDigest({ creatorMessage, projectId: durableProjectId, options: input?.options || {} });
  let existing = await inferenceExecutionAuthority.findExecutionByCreatorTurn({ creatorTurnId, principalId, projectId: durableProjectId, requestDigest });
  if (existing?.found) {
    const terminal = await convergeExistingTurn({ existing, inferenceExecutionAuthority, settlementAuthority });
    if (terminal) return terminal;
  }

  let reservation;
  let execution;
  if (existing?.found) {
    reservation = await spendAuthority.readReservation({ reservationId: existing.reservationId, principalId, projectId: durableProjectId });
    if (reservation?.authorized !== true || reservation.status !== "reserved") {
      throw runtimeError("MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_REHYDRATION_INVALID", "Existing active execution does not bind a live reserved spend authority.", {
        executionId: existing.executionId,
        reservationStatus: reservation?.status || null,
      });
    }
    execution = await acquireExistingExecution({ existing, inferenceExecutionAuthority, deps });
  } else {
    reservation = await spendAuthority.reserveTurn({ serverAuthority: deps.serverAuthority, projectId: durableProjectId });
    if (reservation?.authorized !== true) throw runtimeError("MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_INVALID", "Movie Mentor inference spend reservation was not authoritative.");
    try {
      execution = await openLiveExecution({ input, creatorMessage, durableProjectId, reservation, serverAuthority: deps.serverAuthority, inferenceExecutionAuthority, deps, requestDigest });
    } catch (error) {
      const turnConflict = error?.code === "MOVIE_MENTOR_INFERENCE_EXECUTION_TURN_IDENTITY_CONFLICT";
      await releaseFreshUnboundReservation({ reservation, settlementAuthority, error });
      if (!turnConflict) throw error;

      existing = await inferenceExecutionAuthority.findExecutionByCreatorTurn({ creatorTurnId, principalId, projectId: durableProjectId, requestDigest });
      if (existing?.found) {
        const terminal = await convergeExistingTurn({ existing, inferenceExecutionAuthority, settlementAuthority });
        if (terminal) return terminal;
      }
      if (existing?.found && existing.phase === "active") {
        reservation = await spendAuthority.readReservation({ reservationId: existing.reservationId, principalId, projectId: durableProjectId });
        execution = await acquireExistingExecution({ existing, inferenceExecutionAuthority, deps });
      } else {
        throw error;
      }
    }
  }

  let orchestrationDeps = { readAuthoritativeRevision: revisionReader, readAuthoritativeCreatorState: stateReader };
  const fenced = createFencedInferenceOrchestrationDeps({ execution, inferenceExecutionAuthority, deps });
  orchestrationDeps = {
    ...orchestrationDeps,
    ...fenced,
    verifyTurnContext: deps.verifyTurnContext,
    resolveContinuationReferences: deps.resolveContinuationReferences,
    commitCreatorDecision: deps.commitCreatorDecision,
    readAuthoritativeTurnSource: deps.readAuthoritativeTurnSource,
    applyMovieMentorCreatorStateTransition: deps.applyMovieMentorCreatorStateTransition,
    writeAuthoritativeCreatorState: deps.writeAuthoritativeCreatorState,
  };

  let result;
  try {
    result = await orchestrate({ message: creatorMessage, authoritativeTurnContext: envelope, options: clone(input?.options || {}) }, orchestrationDeps);
  } catch (error) {
    // Process memory never decides release. Every orchestration failure asks durable execution reality whether zero claims still holds.
    await releaseFailedUnclaimedExecution({ execution, settlementAuthority, error });
    throw error;
  }

  const candidate = await inferenceExecutionAuthority.stageResultCandidate({ execution, resultPayload: result });
  if (!candidate?.candidateReference || candidate.resultDigest == null) {
    throw runtimeError("MOVIE_MENTOR_RESULT_CANDIDATE_STAGE_INVALID", "Successful orchestration was not durably staged before closure.", {
      executionId: execution.executionId, retryable: true,
    });
  }
  const closing = await inferenceExecutionAuthority.beginExecutionClosing({ execution });
  if (closing?.authorized !== true) {
    throw runtimeError("MOVIE_MENTOR_INFERENCE_EXECUTION_CLOSURE_NOT_AUTHORIZED", "Staged orchestration result could not surrender execution authority into durable closure.", {
      reason: closing?.reason || "closure-not-authorized", executionId: execution.executionId, retryable: true,
    });
  }
  const closure = await inferenceExecutionAuthority.reconcileExecutionClosure({ executionId: execution.executionId });
  if (closure?.closed !== true || closure?.authorized !== true) {
    throw runtimeError("MOVIE_MENTOR_INFERENCE_EXECUTION_CLOSURE_PENDING", "Execution is frozen but provider-effect reality is not terminally closable; staged result and spend remain durable for reconciliation.", {
      reason: closure?.reason || "closure-pending", phase: closure?.phase || "closing", executionId: execution.executionId, retryable: true,
    });
  }
  const canonical = await inferenceExecutionAuthority.commitCanonicalResult({ closure, result: candidate.resultPayload });
  if (canonical?.authorized !== true || canonical?.committed !== true) {
    throw runtimeError("MOVIE_MENTOR_CANONICAL_RESULT_COMMIT_INVALID", "Closed execution did not produce authoritative durable canonical result evidence.", {
      executionId: execution.executionId, retryable: true,
    });
  }
  const settlement = await settlementAuthority.reconcile({ executionId: execution.executionId });
  if (settlement?.authorized !== true || settlement?.settled !== true || settlement?.outcome !== "consumed" || settlement?.executionPhase !== "settled") {
    throw runtimeError("MOVIE_MENTOR_INFERENCE_SETTLEMENT_RECONCILIATION_PENDING", "Canonical result exists but deterministic creator debit has not converged; result remains durable and retryable.", {
      executionId: execution.executionId, reservationId: canonical.reservationId, retryable: true,
    });
  }
  return resultResponse(canonical, settlement);
}

export {
  MOVIE_MENTOR_TURN_RUNTIME_VERSION,
  buildRequestDigest,
  buildTurnEnvelopeFromDurableState,
  findProviderEvidence,
  assertRuntimeServerAuthority,
  createFencedInferenceOrchestrationDeps,
  openLiveExecution,
  acquireExistingExecution,
  replayTerminalTurn,
  recoverStagedResultTurn,
  convergeExistingTurn,
  releaseFailedUnclaimedExecution,
  releaseFreshUnboundReservation,
  runMovieMentorTurn,
};
export default runMovieMentorTurn;
