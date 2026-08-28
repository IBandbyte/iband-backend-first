import assert from "node:assert/strict";

import {
  inspectMovieMentorJourneyRecoveryRouteMountDependencies,
  mountMovieMentorJourneyRecoveryRouteIfReady,
} from "../ai/MovieMentorJourneyRecoveryRouteMountDependencyGate.js";

function base(overrides = {}) {
  return {
    verifyCredential: async () => ({ verified: true }),
    expectedIssuer: "https://issuer.example.test",
    expectedAudience: "iband.movie-mentor",
    createRouter: () => ({ kind: "certified-recovery-router" }),
    mountRouter: () => {},
    ...overrides,
  };
}

function assertClosed(options, reason) {
  let factoryCalls = 0;
  let mountCalls = 0;

  const result = mountMovieMentorJourneyRecoveryRouteIfReady({
    ...base(),
    ...options,
    createRouter:
      Object.prototype.hasOwnProperty.call(options, "createRouter")
        ? options.createRouter
        : () => {
            factoryCalls += 1;
            return { kind: "router" };
          },
    mountRouter:
      Object.prototype.hasOwnProperty.call(options, "mountRouter")
        ? options.mountRouter
        : () => {
            mountCalls += 1;
          },
  });

  assert.equal(result.mountable, false);
  assert.equal(result.mounted, false);
  assert.equal(result.reason, reason);
  assert.equal(factoryCalls, 0, "closed gate must not construct router");
  assert.equal(mountCalls, 0, "closed gate must not mount router");
  assert.ok(Object.isFrozen(result));
}

console.log("3C.5E.4A — recovery route mount dependency gate torture");

assertClosed({ verifyCredential: null }, "verifier-unavailable");
assertClosed({ verifyCredential: "jwt-secret" }, "verifier-unavailable");
assertClosed({ verifyCredential: true }, "verifier-unavailable");
assertClosed({ expectedIssuer: null }, "issuer-unconfigured");
assertClosed({ expectedIssuer: "   " }, "issuer-unconfigured");
assertClosed({ expectedAudience: null }, "audience-unconfigured");
assertClosed({ expectedAudience: "   " }, "audience-unconfigured");
assertClosed({ createRouter: null }, "router-factory-unavailable");
assertClosed({ mountRouter: null }, "route-mounter-unavailable");

// Request/body-shaped claims are not dependencies and cannot open the gate.
assertClosed(
  {
    verifyCredential: null,
    request: {
      body: {
        authenticated: true,
        admin: true,
        principalId: "owner",
        trustMeBro: true,
      },
    },
  },
  "verifier-unavailable",
);

// Environment-shaped values are equally irrelevant unless application wiring
// deliberately turns real provider infrastructure into the required functions.
assertClosed(
  {
    verifyCredential: null,
    env: {
      AUTH: "true",
      JWT_SECRET: "definitely-not-a-verifier",
      MOVIE_MENTOR_AUTH_VERIFIER: "enabled",
    },
  },
  "verifier-unavailable",
);

let verifierCalls = 0;
let factoryCalls = 0;
let mountCalls = 0;
let receivedFactoryArgs = null;
let mountedRouter = null;

const verifyCredential = async () => {
  verifierCalls += 1;
  return { verified: true };
};

const result = mountMovieMentorJourneyRecoveryRouteIfReady(
  base({
    verifyCredential,
    createRouter: (args) => {
      factoryCalls += 1;
      receivedFactoryArgs = args;
      return Object.freeze({ kind: "certified-recovery-router" });
    },
    mountRouter: (router) => {
      mountCalls += 1;
      mountedRouter = router;
    },
  }),
);

assert.equal(result.mountable, true);
assert.equal(result.mounted, true);
assert.equal(factoryCalls, 1);
assert.equal(mountCalls, 1);
assert.equal(verifierCalls, 0, "mount gate must never verify a credential itself");
assert.equal(receivedFactoryArgs.verifyCredential, verifyCredential);
assert.equal(receivedFactoryArgs.expectedIssuer, "https://issuer.example.test");
assert.equal(receivedFactoryArgs.expectedAudience, "iband.movie-mentor");
assert.equal(mountedRouter.kind, "certified-recovery-router");
assert.ok(Object.isFrozen(result));

// A factory that produces no router cannot reach the mounter.
let noRouterMountCalls = 0;
const noRouter = mountMovieMentorJourneyRecoveryRouteIfReady(
  base({
    createRouter: () => null,
    mountRouter: () => {
      noRouterMountCalls += 1;
    },
  }),
);
assert.equal(noRouter.mountable, false);
assert.equal(noRouter.mounted, false);
assert.equal(noRouter.reason, "router-factory-produced-no-router");
assert.equal(noRouterMountCalls, 0);

// Inspection itself is side-effect free.
let inspectVerifierCalls = 0;
let inspectFactoryCalls = 0;
let inspectMountCalls = 0;
const inspection = inspectMovieMentorJourneyRecoveryRouteMountDependencies(
  base({
    verifyCredential: async () => {
      inspectVerifierCalls += 1;
    },
    createRouter: () => {
      inspectFactoryCalls += 1;
    },
    mountRouter: () => {
      inspectMountCalls += 1;
    },
  }),
);
assert.equal(inspection.mountable, true);
assert.equal(inspection.mounted, false);
assert.equal(inspectVerifierCalls, 0);
assert.equal(inspectFactoryCalls, 0);
assert.equal(inspectMountCalls, 0);
assert.ok(Object.isFrozen(inspection));

console.log("✓ missing verifier cannot mount");
console.log("✓ strings, booleans, body claims and env flags cannot impersonate verifier");
console.log("✓ issuer and audience are mandatory explicit trust policy");
console.log("✓ router factory and mounter are mandatory capabilities");
console.log("✓ closed gate performs zero router construction and zero mounting");
console.log("✓ gate never verifies credentials itself");
console.log("✓ complete explicit dependency set alone is mountable");
console.log("3C.5E.4A torture: GREEN");
