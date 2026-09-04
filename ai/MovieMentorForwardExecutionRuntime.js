import { runMovieMentorTurnWithCreatorStateConsumptionAuthority } from "./MovieMentorCreatorStateConsumptionRuntime.js";
import {
  assertMovieMentorForwardExecutionReacquisitionAuthority,
  assertMovieMentorForwardExecutionCreationAuthority,
} from "./MovieMentorForwardExecutionAuthority.js";

const MOVIE_MENTOR_FORWARD_EXECUTION_RUNTIME_VERSION = "1.2.0";
const s = (value) => (typeof value === "string" ? value.trim() : "");

function createForwardExecutionRuntimeDeps(deps = {}) {
  const base = deps.inferenceExecutionAuthority;
  const authority = deps.forwardExecutionAuthority;
  if (!base || typeof base.findExecutionByCreatorTurn !== "function" || typeof base.acquireExecution !== "function") throw Object.assign(new Error("Forward execution runtime requires durable execution lookup and reacquisition authority."), { code: "MOVIE_MENTOR_FORWARD_EXECUTION_DURABLE_AUTHORITY_REQUIRED" });
  if (typeof authority?.assertCurrentReacquisition !== "function") throw Object.assign(new Error("Forward execution runtime requires server-created current ownership authority for reacquisition."), { code: "MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_REQUIRED" });

  const historical = new Map();
  const guarded = { ...base };
  guarded.findExecutionByCreatorTurn = async (input = {}) => {
    const found = await base.findExecutionByCreatorTurn(input);
    if (found?.found && s(found?.executionId)) historical.set(s(found.executionId), structuredClone(found));
    return found;
  };
  if (typeof base.openExecution === "function") {
    if (typeof authority?.assertCurrentCreation !== "function") throw Object.assign(new Error("Fresh execution creation requires server-created current ownership authority."), { code: "MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_REQUIRED" });
    guarded.openExecution = async (input = {}) => base.openExecution({
      ...input,
      assertCurrentCreationAuthority: async (target = {}) => assertMovieMentorForwardExecutionCreationAuthority({ authority, ...target }),
    });
  }
  guarded.acquireExecution = async (input = {}) => {
    const executionId = s(input?.executionId);
    const existing = historical.get(executionId);
    if (!existing) throw Object.assign(new Error("Execution reacquisition cannot proceed without the exact durable historical execution observed by this runtime."), { code: "MOVIE_MENTOR_FORWARD_EXECUTION_HISTORY_REQUIRED", executionId: executionId || null });
    await assertMovieMentorForwardExecutionReacquisitionAuthority({
      authority,
      projectId: existing.projectId,
      creatorTurnId: existing.creatorTurnId,
      executionId: existing.executionId,
      leaseGeneration: existing.leaseGeneration,
      leaseReference: existing.leaseReference,
      fencingToken: existing.fencingToken,
    });
    return base.acquireExecution(input);
  };
  return { ...deps, inferenceExecutionAuthority: guarded };
}

async function runMovieMentorTurnWithForwardExecutionAuthority(input = {}, deps = {}) {
  return runMovieMentorTurnWithCreatorStateConsumptionAuthority(input, createForwardExecutionRuntimeDeps(deps));
}

export { MOVIE_MENTOR_FORWARD_EXECUTION_RUNTIME_VERSION, createForwardExecutionRuntimeDeps, runMovieMentorTurnWithForwardExecutionAuthority };
export default runMovieMentorTurnWithForwardExecutionAuthority;
