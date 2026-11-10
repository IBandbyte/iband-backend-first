import express from "express";
import { createMovieMentorCreatorStateRecoveryProductionComposition } from "./MovieMentorCreatorStateRecoveryProductionComposition.js";

// Unmounted read-only Express adapter. Server startup must separately prove
// authentication ownership and canonical Mongo readiness before mounting.
function createMovieMentorCreatorStateRecoveryExpressRouter({
  authentication, ownershipAuthority, readCreatorState,
} = {}) {
  const composition = createMovieMentorCreatorStateRecoveryProductionComposition({
    authentication, ownershipAuthority, readCreatorState,
  });
  const router = express.Router();
  router.get("/state/recovery/:projectId", async (req, res) => {
    const result = await composition.handle({
      method: req.method,
      params: { projectId: req.params.projectId },
      headers: { authorization: req.get("authorization") || "" },
    });
    return res.status(result.status).json(result.body);
  });
  return router;
}
export { createMovieMentorCreatorStateRecoveryExpressRouter };
export default createMovieMentorCreatorStateRecoveryExpressRouter;
