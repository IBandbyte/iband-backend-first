// Owner-authorized, read-only creator state recovery boundary.
// No HTTP mount or database write is performed by this module.
const clean = value => typeof value === "string" ? value.trim() : "";
function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
const EXPOSED_FIELDS = Object.freeze([
  "projectId", "revision", "creatorStateGeneration", "creatorStateFingerprint",
  "revisionAuthorityReference", "creatorAuthorityReference", "snapshotReference",
  "creatorConfirmedContext", "projectJourney", "memoryContext",
  "responseBlueprint", "communicationPlan"
]);
function createMovieMentorCreatorStateRecoveryHandler({ requestAuthority, readAuthoritativeState } = {}) {
  if (typeof requestAuthority?.authorize !== "function") fail("MOVIE_MENTOR_RECOVERY_AUTHORITY_REQUIRED", "Recovery requires creator request authority.");
  if (typeof readAuthoritativeState !== "function") fail("MOVIE_MENTOR_RECOVERY_READER_REQUIRED", "Recovery requires authoritative state reader.");
  return async function recover({ request, projectId } = {}) {
    const pid = clean(projectId);
    if (!pid) fail("MOVIE_MENTOR_CREATOR_PROJECT_REQUIRED", "Recovery requires project identity.");
    const first = await requestAuthority.authorize({ request, projectId: pid });
    if (first?.authorized !== true || clean(first.projectId) !== pid || !clean(first.principalId)) fail("MOVIE_MENTOR_CREATOR_PROJECT_NOT_AUTHORIZED", "Recovery project ownership not proven.");
    const state = await readAuthoritativeState({ projectId: pid });
    if (!state) fail("MOVIE_MENTOR_CREATOR_STATE_NOT_FOUND", "No authoritative creator state was found.");
    if (clean(state.projectId) !== pid) fail("MOVIE_MENTOR_CREATOR_STATE_IDENTITY_CONFLICT", "Recovered state belongs to a different project.");
    if (!Number.isSafeInteger(state.revision) || state.revision < 1 || !Number.isSafeInteger(state.creatorStateGeneration) || state.creatorStateGeneration < 1) fail("MOVIE_MENTOR_CREATOR_STATE_REVISION_INVALID", "Recovered creator state has invalid revision or generation.");
    const second = await requestAuthority.authorize({ request, projectId: pid });
    if (second?.authorized !== true || clean(second.projectId) !== pid || clean(second.principalId) !== clean(first.principalId)) fail("MOVIE_MENTOR_CREATOR_PROJECT_NOT_AUTHORIZED", "Recovery ownership changed before exposure.");
    const response = {};
    for (const key of EXPOSED_FIELDS) if (Object.hasOwn(state, key)) response[key] = structuredClone(state[key]);
    return Object.freeze(response);
  };
}
export { createMovieMentorCreatorStateRecoveryHandler, EXPOSED_FIELDS };
export default createMovieMentorCreatorStateRecoveryHandler;
