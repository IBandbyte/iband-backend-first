const VERSION = "0.1.0";
function s(value) { return typeof value === "string" ? value.trim() : ""; }
function fail(code, message) { const error = new Error(message); error.code = code; throw error; }

/**
 * Unmounted, read-only authority. Authentication must be earned by a trusted
 * upstream verifier; this boundary will not derive identity from client input.
 * The supplied ownership authority must use durable server-side ownership.
 * This module does not grant publication or creator-state mutation authority.
 */
function createMovieMentorCreatorStateReadAuthority({ ownershipAuthority, readCreatorState } = {}) {
  if (typeof ownershipAuthority?.authorizeProject !== "function") {
    fail("MOVIE_MENTOR_CREATOR_READ_OWNERSHIP_AUTHORITY_REQUIRED", "A durable project ownership authority is required.");
  }
  if (typeof readCreatorState !== "function") {
    fail("MOVIE_MENTOR_CREATOR_READ_STORE_REQUIRED", "An authoritative creator-state read function is required.");
  }
  async function read({ principal = null, projectId = null } = {}) {
    const pid = s(projectId);
    const principalId = s(principal?.principalId);
    if (!pid || !principalId || principal?.authenticated !== true) {
      return Object.freeze({ authorized: false, reason: "authentication-required" });
    }
    const ownership = await ownershipAuthority.authorizeProject({ principal, projectId: pid });
    if (ownership?.authorized !== true || s(ownership.projectId) !== pid ||
        !s(ownership.ownershipRef) ||
        !Number.isSafeInteger(ownership.ownershipRevision) || ownership.ownershipRevision < 1) {
      return Object.freeze({ authorized: false, reason: "project-ownership-required" });
    }
    const state = await readCreatorState({ projectId: pid });
    if (s(state?.projectId) !== pid ||
        !Number.isSafeInteger(state.revision) || state.revision < 1 ||
        !Number.isSafeInteger(state.creatorStateGeneration) || state.creatorStateGeneration < 1) {
      fail("MOVIE_MENTOR_CREATOR_READ_INVALID_STATE", "Authoritative creator state has invalid project or revision identity.");
    }
    return Object.freeze({ authorized: true, state: Object.freeze({ ...state }) });
  }
  return Object.freeze({ version: VERSION, read });
}
export { createMovieMentorCreatorStateReadAuthority };
export default createMovieMentorCreatorStateReadAuthority;
