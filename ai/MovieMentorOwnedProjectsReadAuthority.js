import mongoose from "mongoose";
import { inspectMovieMentorProjectOwnership, MOVIE_MENTOR_PROJECT_OWNERSHIP_COLLECTION } from "./MovieMentorProjectOwnershipRegistry.js";

function s(value) { return typeof value === "string" ? value.trim() : ""; }

// Read-only, owner-filtered durable discovery. No client-controlled principal,
// no collection mutation, no process-local fallback.
async function readMovieMentorOwnedProjects({ principal } = {}) {
  const ownerPrincipalId = s(principal?.principalId);
  if (principal?.authenticated !== true || !ownerPrincipalId) {
    return Object.freeze({ authorized: false, projects: [] });
  }
  if (mongoose.connection.readyState !== 1) {
    throw new Error("Durable project ownership database is unavailable.");
  }
  const records = await mongoose.connection
    .collection(MOVIE_MENTOR_PROJECT_OWNERSHIP_COLLECTION)
    .find({ ownerPrincipalId, status: "active" }, { projection: { _id: 0, projectId: 1, ownerPrincipalId: 1, ownershipRevision: 1, ownershipReference: 1, domain: 1, schema: 1, establishmentAuthorityId: 1, establishmentSource: 1, establishedAt: 1, status: 1 } })
    .sort({ projectId: 1 })
    .limit(100)
    .toArray();
  const projects = [];
  const seen = new Set();
  for (const record of records) {
    const proof = inspectMovieMentorProjectOwnership(record);
    if (!proof.valid || proof.ownerPrincipalId !== ownerPrincipalId || !s(record.projectId) || seen.has(record.projectId)) {
      throw new Error("Durable owned-project identity or authority is invalid.");
    }
    seen.add(record.projectId);
    projects.push(Object.freeze({ projectId: record.projectId }));
  }
  return Object.freeze({ authorized: true, projects: Object.freeze(projects) });
}
export { readMovieMentorOwnedProjects };
export default readMovieMentorOwnedProjects;
