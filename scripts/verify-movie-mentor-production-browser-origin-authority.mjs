import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createMovieMentorProductionBrowserOriginAuthority,
  parseAllowedOrigins,
} from "../ai/MovieMentorProductionBrowserOriginAuthority.js";

console.log("5A.4 — production browser origin authority torture");

const server = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
const envExample = fs.readFileSync(new URL("../.env.example", import.meta.url), "utf8");

const authority = createMovieMentorProductionBrowserOriginAuthority({
  rawOrigins: "https://app.example.com, https://preview.example.com/",
});

assert.equal(authority.ready, true, "explicit valid origin configuration must be ready");
assert.deepEqual(authority.allowedOrigins, ["https://app.example.com", "https://preview.example.com"]);
assert.equal(authority.isOriginAllowed("https://app.example.com"), true, "explicit production origin must be allowed");
assert.equal(authority.isOriginAllowed("https://app.example.com/"), true, "trailing slash must normalize without broadening authority");
assert.equal(authority.isOriginAllowed("https://evil.example.com"), false, "unknown origin must be rejected");
assert.equal(authority.isOriginAllowed("http://app.example.com"), false, "scheme changes must not inherit authority");
assert.equal(authority.isOriginAllowed("https://app.example.com.evil.test"), false, "hostname suffix tricks must not inherit authority");

const wildcard = parseAllowedOrigins("*");
assert.equal(wildcard.ready, false, "wildcard browser authority must fail closed");
assert.deepEqual(wildcard.allowedOrigins, [], "invalid configuration must grant zero origin authority");

const malformed = createMovieMentorProductionBrowserOriginAuthority({
  rawOrigins: "https://app.example.com, definitely-not-an-origin",
});
assert.equal(malformed.ready, false, "partially malformed configuration must fail closed as a whole");
assert.equal(malformed.isOriginAllowed("https://app.example.com"), false, "valid entries inside malformed configuration must not retain authority");

const blank = createMovieMentorProductionBrowserOriginAuthority({ rawOrigins: "" });
assert.equal(blank.ready, true, "blank configuration must produce a valid deny-all browser authority");
assert.equal(blank.configured, false, "blank configuration must remain explicitly unconfigured");
assert.equal(blank.isOriginAllowed("https://app.example.com"), false, "blank configuration must grant zero browser origins");

assert.equal(
  authority.authorizeRequest({ path: "/api/movie-mentor/turn" }).allowed,
  true,
  "requests without Origin must not be misclassified as browser requests"
);
assert.equal(
  authority.authorizeRequest({ origin: "https://evil.example.com", path: "/health" }).allowed,
  true,
  "public health surface must remain outside protected browser-origin authority"
);
assert.equal(
  authority.authorizeRequest({ origin: "https://evil.example.com", path: "/api/movie-mentor/turn" }).allowed,
  false,
  "unknown browser origin must be blocked from canonical Movie Mentor production surface"
);
assert.equal(
  authority.authorizeRequest({ origin: "https://evil.example.com", path: "/api/movie-mentor-recovery/session" }).allowed,
  false,
  "unknown browser origin must be blocked from certified recovery production surface"
);
assert.equal(
  authority.authorizeRequest({ origin: "https://app.example.com", path: "/api/movie-mentor/turn" }).allowed,
  true,
  "explicit browser authority must admit protected canonical surface"
);

const corsOptions = authority.createCorsOptions();
assert.ok(corsOptions.allowedHeaders.includes("Authorization"), "Authorization header must survive permitted preflight");
assert.ok(corsOptions.allowedHeaders.includes("Content-Type"), "Content-Type header must survive permitted preflight");
assert.ok(corsOptions.methods.includes("OPTIONS"), "preflight method must remain supported");

let allowedCors = null;
corsOptions.origin("https://app.example.com", (_err, value) => { allowedCors = value; });
assert.equal(allowedCors, true, "CORS callback must allow explicitly authorized origin");
let deniedCors = null;
corsOptions.origin("https://evil.example.com", (_err, value) => { deniedCors = value; });
assert.equal(deniedCors, false, "CORS callback must deny unknown origin");
let noOriginCors = null;
corsOptions.origin(undefined, (_err, value) => { noOriginCors = value; });
assert.equal(noOriginCors, false, "non-browser request must not receive synthetic CORS authority");

assert.equal(
  authority.authorizeRequest({
    origin: "https://evil.example.com",
    path: "/api/movie-mentor/turn",
    host: "app.example.com",
    referer: "https://app.example.com/",
  }).allowed,
  false,
  "Host or Referer evidence must never manufacture origin authority"
);

assert.match(server, /createMovieMentorProductionBrowserOriginAuthority/, "production boot must compose browser origin authority explicitly");
assert.equal(server.includes("app.use(cors());"), false, "naked universal cors() must never return");
assert.match(server, /browserOriginAuthority\.authorizeRequest/, "protected browser requests must pass explicit origin authority");
assert.match(server, /MOVIE_MENTOR_BROWSER_ORIGIN_NOT_AUTHORIZED/, "denied protected browser requests must fail closed explicitly");
assert.match(server, /cors\(browserOriginAuthority\.createCorsOptions\(\)\)/, "CORS must be driven by explicit origin authority");
assert.match(server, /app\.use\("\/api\/movie-mentor", router\)/, "canonical authenticated creator gateway must remain mounted");
assert.match(server, /createMovieMentorProductionAuthenticationComposition/, "creator authentication composition must remain present");
assert.match(server, /createMovieMentorCreatorRequestAuthority/, "creator project ownership authority must remain present");
assert.match(server, /assembleMovieMentorJourneyRecoveryProductionBoot/, "certified recovery assembly must remain present");

for (const forbidden of [
  "/api/movie-mentor-semantic",
  "/api/movie-mentor-specialists",
  "/api/movie-mentor-synthesis",
  "/api/ai-mentor",
  "/api/mentor",
  "/api/generate",
  "/api/studio",
  "mountRoute(",
]) {
  assert.equal(server.includes(forbidden), false, `${forbidden} must remain absent from production boot`);
}

assert.match(envExample, /^MOVIE_MENTOR_ALLOWED_BROWSER_ORIGINS=$/m, "safe env contract must declare explicit browser-origin authority input");
assert.equal(envExample.includes("MOVIE_MENTOR_ALLOWED_BROWSER_ORIGINS=*"), false, "env example must never normalize wildcard authority");

console.log("✓ explicit allowed browser origins normalize and authorize exactly");
console.log("✓ unknown, malformed and wildcard origins fail closed");
console.log("✓ blank configuration grants zero cross-origin browser authority");
console.log("✓ Host, Referer and deployment discovery cannot manufacture authority");
console.log("✓ no-Origin server-to-server requests remain outside the browser-origin boundary");
console.log("✓ Authorization and Content-Type remain available to permitted preflight");
console.log("✓ canonical creator authentication and recovery assembly remain intact");
console.log("✓ 5A.2 intelligence isolation and 5A.3 dead-mount elimination remain intact");
console.log("LAW: browser origin authority must be explicit production configuration");
console.log("LAW: deployment discovery is evidence, never authority");
console.log("LAW: CORS never substitutes for authentication and authentication never manufactures CORS authority");
console.log("5A.4 torture: GREEN");
