import express from "express";
import cors from "cors";
import { assembleMovieMentorJourneyRecoveryProductionBoot } from "./ai/MovieMentorJourneyRecoveryProductionBootAssembly.js";
import { createMovieMentorProductionAuthenticationComposition } from "./ai/MovieMentorProductionAuthenticationComposition.js";
import { createMovieMentorCreatorRequestAuthority } from "./ai/MovieMentorCreatorRequestAuthority.js";
import { createMovieMentorTurnRouter } from "./movieMentorTurn.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => res.json({ ok: true, service: "iband-backend-first" }));
app.get("/health", (_req, res) => res.json({ ok: true }));

async function mountMovieMentorCreatorGateway() {
  const authentication = createMovieMentorProductionAuthenticationComposition();
  if (authentication?.ready !== true || typeof authentication?.verifyCredential !== "function") {
    const reason = authentication?.reason || "production-authentication-not-ready";
    console.log(`[mount:closed] /api/movie-mentor (${reason})`);
    return Object.freeze({ mounted: false, basePath: "/api/movie-mentor", reason });
  }
  const requestAuthority = createMovieMentorCreatorRequestAuthority({
    verifyCredential: authentication.verifyCredential,
    expectedIssuer: authentication.expectedIssuer,
    expectedAudience: authentication.expectedAudience,
  });
  const router = createMovieMentorTurnRouter({ requestAuthority });
  app.use("/api/movie-mentor", router);
  console.log("[mount:ok] /api/movie-mentor <- authenticated creator gateway");
  return Object.freeze({ mounted: true, basePath: "/api/movie-mentor", reason: "authenticated-creator-gateway-mounted" });
}

await mountMovieMentorCreatorGateway();

// Door 5A.2: Semantic, Specialist and Synthesis are internal intelligence
// capabilities of the canonical authenticated Movie Mentor turn pipeline.
// Their standalone HTTP adapters intentionally receive no production mount.

// Door 5A.3: Production boot exposes only real, intentional capabilities.
// Legacy best-effort mounts for missing route modules are intentionally absent.

const recoveryMount = await assembleMovieMentorJourneyRecoveryProductionBoot({ app });
console.log(`[mount:${recoveryMount.mounted ? "ok" : "closed"}] ${recoveryMount.basePath} (${recoveryMount.reason})`);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`iBand backend listening on ${PORT}`));
