import assert from "node:assert/strict";
import { createMovieMentorJourneyRecoveryExpressRouter } from "../ai/MovieMentorJourneyRecoveryExpressRouterFactory.js";

console.log("5A.29 — Journey recovery idempotent historical re-exposure authority torture");

function makeRouter() {
  let postHandler = null;
  return {
    post(path, handler) {
      assert.equal(path, "/:projectId/recovery");
      postHandler = handler;
    },
    handler() {
      assert.equal(typeof postHandler, "function");
      return postHandler;
    },
  };
}

async function runCase({ revokeBeforeExposure }) {
  const router = makeRouter();
  let ownershipCurrent = true;
  let authorizeCalls = 0;
  let successfulExposures = 0;
  let forbiddenExposures = 0;

  const requestAuthority = Object.freeze({
    async authorize({ projectId }) {
      authorizeCalls += 1;
      if (!ownershipCurrent) return Object.freeze({ authorized: false, reason: "ownership-revoked" });
      return Object.freeze({
        authorized: true,
        principalId: "principal-owner",
        projectId,
        ownershipRef: `ownership:${projectId}`,
      });
    },
  });

  const httpAdapter = Object.freeze({
    async handle({ projectId }) {
      // This represents a fully valid historical checkpoint returned by the
      // recovery transition's idempotent path. No durable mutation occurs.
      const transport = Object.freeze({
        statusCode: 200,
        body: Object.freeze({
          success: true,
          status: "idempotent",
          projectId,
          recoveryRevision: 7,
          recoveryGeneration: 7,
          lineageId: "lineage-1",
          authorityGeneration: 11,
          progressionRevision: 19,
          envelopeFingerprint: "fingerprint-existing-checkpoint",
          capturedAt: "2026-09-05T23:00:00.000Z",
        }),
      });
      if (revokeBeforeExposure) ownershipCurrent = false;
      return transport;
    },
  });

  const express = {
    Router() {
      return router;
    },
  };

  const built = createMovieMentorJourneyRecoveryExpressRouter({
    express,
    verifyCredential: async () => ({ authenticated: true, principalId: "principal-owner" }),
    requestAuthority,
    publicationBoundary: Object.freeze({ publish: async () => { throw new Error("not used by injected adapter"); } }),
    httpAdapter,
  });

  const req = {
    params: { projectId: "project-1" },
    body: { expectedRecoveryRevision: 7, envelope: {} },
  };
  const res = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      if (this.statusCode === 200 && body?.success === true) successfulExposures += 1;
      if (this.statusCode === 403 && body?.success === false) forbiddenExposures += 1;
      return body;
    },
  };

  await built.handler()(req, res);
  return { authorizeCalls, successfulExposures, forbiddenExposures, statusCode: res.statusCode };
}

const current = await runCase({ revokeBeforeExposure: false });
assert.equal(current.successfulExposures, 1, "current ownership must allow the valid idempotent recovery result to be exposed");
assert.equal(current.statusCode, 200);
assert.equal(current.authorizeCalls, 1, "successful idempotent HTTP exposure must ask current request authority exactly once at the final router boundary");
console.log("✓ valid idempotent recovery remains exposable while current ownership survives");

const revoked = await runCase({ revokeBeforeExposure: true });
assert.equal(revoked.successfulExposures, 0, "ownership revoked after idempotent historical recovery resolution but before HTTP emission must expose zero successful recovery responses");
assert.equal(revoked.statusCode, 403, "revoked idempotent historical recovery exposure must fail closed");
assert.equal(revoked.forbiddenExposures, 1, "revoked idempotent historical recovery must emit the sanitized forbidden response");
assert.equal(revoked.authorizeCalls, 1, "idempotent history must independently re-earn current ownership at exposure");
console.log("✓ idempotent historical recovery cannot borrow old ownership authority for later creator-facing exposure");

console.log("\nJourney recovery idempotent historical re-exposure authority torture passed.");
