const VERSION = "0.1.0";
function s(value) { return typeof value === "string" ? value.trim() : ""; }
function respond(status, body) { return Object.freeze({ status, body: Object.freeze(body) }); }
function createMovieMentorCreatorStateRecoveryHttpHandler({ authenticate, readAuthority } = {}) {
  if (typeof authenticate !== "function" || typeof readAuthority?.read !== "function") {
    throw new TypeError("Authenticated creator-state recovery requires a credential verifier and owner-bound read authority.");
  }
  return async function handle(request = {}) {
    if (request.method !== "GET") return respond(405, { success: false, code: "METHOD_NOT_ALLOWED" });
    const projectId = s(request.params?.projectId);
    if (!projectId) return respond(400, { success: false, code: "PROJECT_REQUIRED" });
    const authorization = s(request.headers?.authorization);
    if (!authorization.startsWith("Bearer ") || !s(authorization.slice(7))) {
      return respond(401, { success: false, code: "AUTHENTICATION_REQUIRED" });
    }
    let principal;
    try {
      principal = await authenticate({ authorization });
    } catch {
      return respond(401, { success: false, code: "AUTHENTICATION_FAILED" });
    }
    if (principal?.authenticated !== true || !s(principal.principalId)) {
      return respond(401, { success: false, code: "AUTHENTICATION_FAILED" });
    }
    try {
      const result = await readAuthority.read({ principal, projectId });
      if (result?.authorized !== true) return respond(403, { success: false, code: "PROJECT_ACCESS_DENIED" });
      const state = result.state;
      if (s(state?.projectId) !== projectId ||
          !Number.isSafeInteger(state.revision) || state.revision < 1 ||
          !Number.isSafeInteger(state.creatorStateGeneration) || state.creatorStateGeneration < 1) {
        return respond(503, { success: false, code: "CREATOR_STATE_UNVERIFIED" });
      }
      return respond(200, { success: true, state: structuredClone(state) });
    } catch {
      return respond(503, { success: false, code: "CREATOR_STATE_READ_UNAVAILABLE" });
    }
  };
}
export { VERSION as MOVIE_MENTOR_CREATOR_STATE_RECOVERY_HTTP_HANDLER_VERSION, createMovieMentorCreatorStateRecoveryHttpHandler };
export default createMovieMentorCreatorStateRecoveryHttpHandler;
