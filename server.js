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

// Provider signatures require exact bytes, so only the Stripe webhook is mounted
// before general browser-origin/CORS/JSON middleware. The creator commercial router
// is composed here but physically mounted below after those browser protections.
let stripeClient = null;
if (process.env.MOVIE_MENTOR_STRIPE_SECRET_KEY) {
  try { const { default: Stripe } = await import("stripe"); stripeClient = new Stripe(process.env.MOVIE_MENTOR_STRIPE_SECRET_KEY); } catch { stripeClient = null; }
}
const commercialMount=await mountMovieMentorProductionCommercialHttpIngress({app,stripe:stripeClient});
console.log(`[mount:${commercialMount.mounted ? "provider-ok" : "closed"}] ${commercialMount.stripeWebhookPath} (${commercialMount.reason})`);

app.use((req, res, next) => {
  const decision = browserOriginAuthority.authorizeRequest({origin: req.get("Origin") || null,path: req.path});
  if (decision.allowed) return next();
  return res.status(403).json({success:false,code:"MOVIE_MENTOR_BROWSER_ORIGIN_NOT_AUTHORIZED",message:"This browser origin is not authorized for the requested Movie Mentor production surface."});
});
app.use(cors(browserOriginAuthority.createCorsOptions()));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
if(commercialMount.mounted&&commercialMount.creatorRouter){ app.use(commercialMount.creatorBasePath,commercialMount.creatorRouter); console.log(`[mount:ok] ${commercialMount.creatorBasePath} <- browser-origin + CORS + JSON + authenticated durable commercial authority`); }

app.get("/", (_req, res) => res.json({ ok: true, service: "iband-backend-first" }));
app.get("/health", (_req, res) => res.json({ ok: true }));

async function mountMovieMentorCreatorGateway() {
  const authentication = createMovieMentorProductionAuthenticationComposition();
  if (authentication?.ready !== true || typeof authentication?.verifyCredential !== "function") { const reason = authentication?.reason || "production-authentication-not-ready"; console.log(`[mount:closed] /api/movie-mentor (${reason})`); return Object.freeze({ mounted: false, basePath: "/api/movie-mentor", reason }); }
  const spendComposition = createMovieMentorProductionInferenceSpendComposition();
  if (spendComposition?.ready !== true || typeof spendComposition?.authority?.reserveTurn !== "function") { const reason = spendComposition?.reason || "production-inference-spend-authority-not-ready"; console.log(`[mount:closed] /api/movie-mentor (${reason})`); return Object.freeze({ mounted: false, basePath: "/api/movie-mentor", reason }); }
  const requestAuthority = createMovieMentorCreatorRequestAuthority({verifyCredential: authentication.verifyCredential,expectedIssuer: authentication.expectedIssuer,expectedAudience: authentication.expectedAudience});
  const router = createMovieMentorTurnRouter({ requestAuthority, inferenceSpendAuthority: spendComposition.authority });
  app.use("/api/movie-mentor", router);console.log("[mount:ok] /api/movie-mentor <- authenticated creator gateway + durable inference spend authority");return Object.freeze({ mounted: true, basePath: "/api/movie-mentor", reason: "authenticated-budgeted-creator-gateway-mounted" });
}
await mountMovieMentorCreatorGateway();

// Internal Semantic/Specialist/Synthesis capabilities receive no standalone production mount.
// Production boot exposes only real, intentional capabilities; legacy best-effort mounts stay absent.
// Browser origin authority is explicit deployment configuration and never substitutes for auth.
// Authentication and ownership do not grant inference-spend authority.
const recoveryMount = await assembleMovieMentorJourneyRecoveryProductionBoot({ app });
console.log(`[mount:${recoveryMount.mounted ? "ok" : "closed"}] ${recoveryMount.basePath} (${recoveryMount.reason})`);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`iBand backend listening on ${PORT}`));

// 5A.17 exact-SHA certification anchor: raw provider ingress and protected creator commerce are deliberately split across the middleware boundary.
