import express from "express";

const MOVIE_MENTOR_PROJECTS_GATEWAY_VERSION = "1.0.0";
const FORBIDDEN_CLIENT_AUTHORITY_FIELDS = Object.freeze(["principalId", "ownerPrincipalId", "authorityId", "verified", "type", "establishmentAuthority", "ownershipReference", "ownershipRevision"]);

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function statusFor(error) {
  const code = text(error?.code);
  if (code === "MOVIE_MENTOR_AUTH_CREDENTIAL_REQUIRED" || code === "MOVIE_MENTOR_AUTH_BEARER_REQUIRED" || code.includes("AUTH_EXPIRED") || code.includes("AUTH_REVOKED") || code.includes("AUTH_VERIFICATION")) return 401;
  if (code.includes("HIJACK") || code.includes("NOT_AUTHORIZED")) return 403;
  if (code.includes("ALREADY_EXISTS") || code.includes("REPLAY_CONFLICT") || code.includes("ESTABLISHMENT_CONFLICT")) return 409;
  if (code.includes("STORE_NOT_CONFIGURED") || code.includes("STORE_UNAVAILABLE") || code.includes("PHYSICAL_AUTHORITY_UNAVAILABLE") || code.includes("AUTHORITY_REQUIRED")) return 503;
  if (code.includes("IDENTITY_INVALID") || code.includes("PROJECT_REQUIRED") || code.includes("BINDING_REQUIRED") || code.includes("CLIENT_AUTHORITY_FORBIDDEN")) return 422;
  return 502;
}
function failure(res, error) { const code = text(error?.code) || "MOVIE_MENTOR_NATIVE_PROJECT_CREATION_FAILED"; return res.status(statusFor(error)).json({ success: false, code, message: error instanceof Error ? error.message : "Movie Mentor project creation failed." }); }
function assertNoClientAuthority(body = {}) {
  const forbidden = FORBIDDEN_CLIENT_AUTHORITY_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(body, field));
  if (forbidden.length) { const error = new Error("Native project creation accepts project identity only; authentication and ownership authority are server-derived."); error.code = "MOVIE_MENTOR_NATIVE_PROJECT_CREATION_CLIENT_AUTHORITY_FORBIDDEN"; error.fields = forbidden; throw error; }
}
function createMovieMentorProjectsRouter({ nativeProjectCreationAuthority = null } = {}) {
  if (typeof nativeProjectCreationAuthority?.establishFromRequest !== "function") { const error = new Error("Movie Mentor project ingress requires native project creation authority."); error.code = "MOVIE_MENTOR_NATIVE_PROJECT_CREATION_AUTHORITY_REQUIRED"; throw error; }
  const router = express.Router();
  router.post("/projects", async (req, res) => {
    try {
      const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
      assertNoClientAuthority(body);
      const result = await nativeProjectCreationAuthority.establishFromRequest({ request: req, projectId: body.projectId, identity: body.identity });
      const created = result?.status === "established" || result?.status === "established-after-race" || result?.status === "established-after-ack-loss";
      return res.status(created ? 201 : 200).json({ success: true, status: result.status, projectId: result.projectId, identity: result.identity, ownership: result.ownership, metadata: { projectsGatewayVersion: MOVIE_MENTOR_PROJECTS_GATEWAY_VERSION } });
    } catch (error) { return failure(res, error); }
  });
  return router;
}

export { MOVIE_MENTOR_PROJECTS_GATEWAY_VERSION, FORBIDDEN_CLIENT_AUTHORITY_FIELDS, assertNoClientAuthority, createMovieMentorProjectsRouter };
export default createMovieMentorProjectsRouter;
