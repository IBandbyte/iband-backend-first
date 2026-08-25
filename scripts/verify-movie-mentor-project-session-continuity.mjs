import assert from "node:assert/strict";
import { buildCreatorStateIdentityQuery } from "../ai/MovieMentorCreatorStateStore.js";

assert.deepEqual(
  buildCreatorStateIdentityQuery({ projectId: "movie-project-1", creatorSessionId: "session-a" }),
  { projectId: "movie-project-1" },
  "Project identity must outrank a working-session identity when both are present."
);

assert.deepEqual(
  buildCreatorStateIdentityQuery({ projectId: "movie-project-1", creatorSessionId: "session-b" }),
  { projectId: "movie-project-1" },
  "A new working session must resolve the same durable project reality."
);

assert.deepEqual(
  buildCreatorStateIdentityQuery({ creatorSessionId: "session-only" }),
  { creatorSessionId: "session-only" },
  "Session identity remains a fallback only when no project identity exists."
);

assert.throws(
  () => buildCreatorStateIdentityQuery({}),
  (error) => error?.code === "MOVIE_MENTOR_CREATOR_STATE_IDENTITY_REQUIRED"
);

console.log("Movie Mentor project/session continuity verification: PASS");
