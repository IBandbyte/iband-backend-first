import express from "express";
import { createMovieMentorCreatorStateRecoveryProductionComposition } from "./MovieMentorCreatorStateRecoveryProductionComposition.js";
import { readMovieMentorOwnedProjects } from "./MovieMentorOwnedProjectsReadAuthority.js";

function s(value) { return typeof value === "string" ? value.trim() : ""; }
function createMovieMentorCreatorStateReadExpressRouter({
  authentication, ownershipAuthority, readCreatorState,
  discoverOwnedProjects = readMovieMentorOwnedProjects,
} = {}) {
  const composition = createMovieMentorCreatorStateRecoveryProductionComposition({
    authentication, ownershipAuthority, readCreatorState,
  });
  if (typeof discoverOwnedProjects !== "function") throw new TypeError("Durable owner-filtered project discovery required.");
  const router = express.Router();
  router.get("/state/recovery/:projectId", async (req, res) => {
    const result = await composition.handle({
      method: req.method,
      params: { projectId: req.params.projectId },
      headers: { authorization: req.get("authorization") || "" },
    });
    return res.status(result.status).json(result.body);
  });
  router.get("/projects/owned", async (req, res) => {
    const authorization = s(req.get("authorization"));
    if (!/^Bearer\s+\S+$/i.test(authorization)) return res.status(401).json({ success: false, code: "AUTHENTICATION_REQUIRED" });
    let proof;
    try {
      proof = await authentication.verifyCredential({
        credential: authorization.replace(/^Bearer\s+/i, ""),
        expectedIssuer: authentication.expectedIssuer,
        expectedAudience: authentication.expectedAudience,
      });
    } catch { return res.status(401).json({ success: false, code: "AUTHENTICATION_FAILED" }); }
    if (proof?.verified !== true || proof?.active !== true || proof?.revoked !== false || !s(proof.subject))
      return res.status(401).json({ success: false, code: "AUTHENTICATION_FAILED" });
    try {
      const result = await discoverOwnedProjects({ principal: { authenticated: true, principalId: proof.subject } });
      if (result?.authorized !== true || !Array.isArray(result.projects))
        return res.status(403).json({ success: false, code: "PROJECT_ACCESS_DENIED" });
      return res.status(200).json({ success: true, projects: result.projects });
    } catch { return res.status(503).json({ success: false, code: "PROJECT_DISCOVERY_UNAVAILABLE" }); }
  });
  return router;
}
export { createMovieMentorCreatorStateReadExpressRouter };
export default createMovieMentorCreatorStateReadExpressRouter;
