import express from "express";
import cors from "cors";
import { assembleMovieMentorJourneyRecoveryProductionBoot } from "./ai/MovieMentorJourneyRecoveryProductionBootAssembly.js";
import { createMovieMentorProductionAuthenticationComposition } from "./ai/MovieMentorProductionAuthenticationComposition.js";
import { createMovieMentorCreatorRequestAuthority } from "./ai/MovieMentorCreatorRequestAuthority.js";
import { createMovieMentorProductionBrowserOriginAuthority } from "./ai/MovieMentorProductionBrowserOriginAuthority.js";
import { createMovieMentorProductionInferenceSpendComposition } from "./ai/MovieMentorProductionInferenceSpendComposition.js";
import { mountMovieMentorProductionCommercialHttpIngress } from "./ai/MovieMentorProductionCommercialHttpIngress.js";
import { createMovieMentorTurnRouter } from "./movieMentorTurn.js";

const app = express();
const browserOriginAuthority = createMovieMentorProductionBrowserOriginAuthority();

// Door 5A.15: the provider webhook must see exact request bytes before any
// general JSON parser can transform them. Provider traffic is not browser-origin
// authority, and a successful browser redirect is never payment evidence.
let stripeClient = null;
if (process.env.MOVIE_MENTOR_STRIPE_SECRET_KEY) {
  try {
    const { default: Stripe } = await import("stripe");
    stripeClient = new Stripe(process.env.MOVIE_MENTOR_STRIPE_SECRET_KEY);
  } catch {
    stripeClient = null;
  }
}
const commercialMount=await mountMovieMentorProductionCommercialHttpIngress({app,stripe:stripeClient});
console.log(`[mount:${commercialMount.mounted ? "ok" : "closed"}] ${commercialMount.creatorBasePath} + ${commercialMount.stripeWebhookPath} (${commercialMount.reason})`);

app.use((req, res, next) => {
  const decision = browserOriginAuthority.authorizeRequest({
    origin: req.get("Origin") || null,
    path: req.path,
  });

  if (decision.allowed) return next();

  return res.status(403).json({
    success: false,
    code: "MOVIE_MENTOR_BROWSER_ORIGIN_NOT_AUTHORIZED",
    message: "This browser origin is not authorized for the requested Movie Mentor production surface.",
  });
});

app.use(cors(browserOriginAuthority.createCorsOptions()));
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
  const spendComposition = createMovieMentorProductionInferenceSpendComposition();
  if (spendComposition?.ready !== true || typeof spendComposition?.authority?.reserveTurn !== "function") {
    const reason = spendComposition?.reason || "production-inference-spend-authority-not-ready";
    console.log(`[mount:closed] /api/movie-mentor (${reason})`);
    return Object.freeze({ mounted: false, basePath: "/api/movie-mentor", reason });
  }
  const requestAuthority = createMovieMentorCreatorRequestAuthority({
    verifyCredential: authentication.verifyCredential,
    expectedIssuer: authentication.expectedIssuer,
    expectedAudience: authentication.expectedAudience,
  });
  const router = createMovieMentorTurnRouter({ requestAuthority, inferenceSpendAuthority: spendComposition.authority });
  app.use("/api/movie-mentor", router);
  console.log("[mount:ok] /api/movie-mentor <- authenticated creator gateway + durable inference spend authority");
  return Object.freeze({ mounted: true, basePath: "/api/movie-mentor", reason: "authenticated-budgeted-creator-gateway-mounted" });
}

await mountMovieMentorCreatorGateway();

// Door 5A.2: Semantic, Specialist and Synthesis are internal intelligence
// capabilities of the canonical authenticated Movie Mentor turn pipeline.
// Their standalone HTTP adapters intentionally receive no production mount.

// Door 5A.3: Production boot exposes only real, intentional capabilities.
// Legacy best-effort mounts for missing route modules are intentionally absent.

// Door 5A.4: Browser origin authority is explicit deployment configuration.
// Missing or invalid configuration grants no cross-origin browser authority to
// protected Movie Mentor production surfaces. CORS never substitutes for auth.

// Door 5A.5: Authentication and ownership do not grant inference-spend authority.
// The creator gateway mounts only with durable Mongo-backed spend composition,
// and every paid turn must reserve entitlement before orchestration begins.

const recoveryMount = await assembleMovieMentorJourneyRecoveryProductionBoot({ app });
console.log(`[mount:${recoveryMount.mounted ? "ok" : "closed"}] ${recoveryMount.basePath} (${recoveryMount.reason})`);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`iBand backend listening on ${PORT}`));
