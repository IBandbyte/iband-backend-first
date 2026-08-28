import assert from "node:assert/strict";
import http from "node:http";
import express from "express";

import { createMovieMentorJourneyRecoveryExpressRouter } from "../ai/MovieMentorJourneyRecoveryExpressRouterFactory.js";
import { createMovieMentorJourneyRecoveryHttpTransportAdapter } from "../ai/MovieMentorJourneyRecoveryHttpTransportAdapter.js";

function expectCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code);
}

function base(overrides = {}) {
  return {
    verifyCredential: async () => ({ verified: true }),
    expectedIssuer: "https://issuer.example.test",
    expectedAudience: "iband.movie-mentor",
    ...overrides,
  };
}

async function withServer(router, run) {
  const app = express();
  app.use(express.json());
  app.use("/api/movie-mentor-recovery", router);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

console.log("3C.5E.4B — recovery Express router factory torture");

expectCode(
  () => createMovieMentorJourneyRecoveryExpressRouter(base({ verifyCredential: null })),
  "MOVIE_MENTOR_JOURNEY_RECOVERY_EXPRESS_VERIFIER_REQUIRED",
);
expectCode(
  () => createMovieMentorJourneyRecoveryExpressRouter(base({ verifyCredential: "secret" })),
  "MOVIE_MENTOR_JOURNEY_RECOVERY_EXPRESS_VERIFIER_REQUIRED",
);
expectCode(
  () => createMovieMentorJourneyRecoveryExpressRouter(base({ expectedIssuer: " " })),
  "MOVIE_MENTOR_JOURNEY_RECOVERY_EXPRESS_ISSUER_REQUIRED",
);
expectCode(
  () => createMovieMentorJourneyRecoveryExpressRouter(base({ expectedAudience: " " })),
  "MOVIE_MENTOR_JOURNEY_RECOVERY_EXPRESS_AUDIENCE_REQUIRED",
);
expectCode(
  () => createMovieMentorJourneyRecoveryExpressRouter(base({ routerFactory: null })),
  "MOVIE_MENTOR_JOURNEY_RECOVERY_EXPRESS_ROUTER_FACTORY_REQUIRED",
);

let verifierCalls = 0;
let requestAuthorityArgs = null;
let publicationArgs = null;
let publishCalls = 0;
let publicationInput = null;

const verifyCredential = async () => {
  verifierCalls += 1;
  return { verified: true };
};

const router = createMovieMentorJourneyRecoveryExpressRouter(
  base({
    verifyCredential,
    expectedIssuer: "  https://issuer.example.test  ",
    expectedAudience: "  iband.movie-mentor  ",
    createRequestAuthority: (args) => {
      requestAuthorityArgs = args;
      return Object.freeze({ authorize: async () => ({ authorized: true }) });
    },
    createPublicationBoundary: (args) => {
      publicationArgs = args;
      return Object.freeze({
        publish: async (input) => {
          publishCalls += 1;
          publicationInput = input;
          return Object.freeze({
            recoveryStatus: "created",
            projectId: input.projectId,
            recoveryRevision: 1,
            recoveryGeneration: 1,
            lineageId: "lineage-1",
            authorityGeneration: 7,
            progressionRevision: 11,
            envelopeFingerprint: "fp-1",
            capturedAt: "2026-08-28T17:00:00.000Z",
          });
        },
      });
    },
    createHttpAdapter: createMovieMentorJourneyRecoveryHttpTransportAdapter,
  }),
);

assert.equal(typeof router, "function");
assert.equal(verifierCalls, 0, "router construction must not verify a credential");
assert.equal(requestAuthorityArgs.verifyCredential, verifyCredential);
assert.equal(requestAuthorityArgs.expectedIssuer, "https://issuer.example.test");
assert.equal(requestAuthorityArgs.expectedAudience, "iband.movie-mentor");
assert.equal(publicationArgs.requestAuthority.authorize instanceof Function, true);

await withServer(router, async (origin) => {
  const response = await fetch(
    `${origin}/api/movie-mentor-recovery/route-project-7/recovery`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer externally-verifiable-token",
      },
      body: JSON.stringify({
        expectedRecoveryRevision: 0,
        envelope: { domain: "test-envelope" },
        principalId: "forged-owner",
        admin: true,
        trustMeBro: true,
      }),
    },
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.projectId, "route-project-7");
  assert.equal(publishCalls, 1);
  assert.equal(publicationInput.projectId, "route-project-7");
  assert.equal(publicationInput.request.headers.authorization, "Bearer externally-verifiable-token");
  assert.equal(publicationInput.expectedRecoveryRevision, 0);
  assert.deepEqual(publicationInput.envelope, { domain: "test-envelope" });
});

// The route parameter remains the only router-selected project identity. The
// real 3C.5E.3 adapter independently rejects body projectId before publication.
await withServer(router, async (origin) => {
  const before = publishCalls;
  const response = await fetch(
    `${origin}/api/movie-mentor-recovery/route-project-8/recovery`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: "body-project-attacker",
        expectedRecoveryRevision: 0,
        envelope: { domain: "perfect-looking-envelope" },
      }),
    },
  );

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.code, "MOVIE_MENTOR_RECOVERY_INVALID_REQUEST");
  assert.equal(publishCalls, before, "body project injection must never reach publication");
});

// Unexpected adapter exceptions are converted to a generic response and do not
// expose internal messages or stack text through Express.
const throwingRouter = createMovieMentorJourneyRecoveryExpressRouter(
  base({
    createRequestAuthority: () => ({ authorize: async () => ({ authorized: true }) }),
    createPublicationBoundary: () => ({ publish: async () => ({}) }),
    createHttpAdapter: () => ({
      handle: async () => {
        throw new Error("database password=zorg and secret stack trace");
      },
    }),
  }),
);

await withServer(throwingRouter, async (origin) => {
  const response = await fetch(
    `${origin}/api/movie-mentor-recovery/route-project-9/recovery`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expectedRecoveryRevision: 0, envelope: {} }),
    },
  );
  assert.equal(response.status, 500);
  const text = await response.text();
  assert.match(text, /MOVIE_MENTOR_RECOVERY_INTERNAL_ERROR/);
  assert.doesNotMatch(text, /password|zorg|stack trace/i);
});

// The factory returns an unmounted router; unrelated application paths do not
// magically become recovery endpoints.
await withServer(router, async (origin) => {
  const response = await fetch(`${origin}/api/not-recovery/route-project-7/recovery`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ expectedRecoveryRevision: 0, envelope: {} }),
  });
  assert.equal(response.status, 404);
});

console.log("✓ verifier, issuer and audience are mandatory factory inputs");
console.log("✓ router construction never performs credential verification");
console.log("✓ route-selected :projectId is forwarded separately from the body");
console.log("✓ body projectId injection is rejected before publication");
console.log("✓ forged body identity/admin claims acquire no router authority");
console.log("✓ Bearer evidence remains on the original request for certified auth");
console.log("✓ unexpected Express-boundary failures are sanitized");
console.log("✓ factory creates an unmounted router and changes no server route table");
console.log("3C.5E.4B torture: GREEN");
