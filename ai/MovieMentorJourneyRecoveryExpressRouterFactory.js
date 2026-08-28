import express from "express";

import { createMovieMentorJourneyRecoveryRequestAuthority } from "./MovieMentorJourneyRecoveryRequestAuthority.js";
import { createMovieMentorJourneyRecoveryPublicationBoundary } from "./MovieMentorJourneyRecoveryPublicationBoundary.js";
import { createMovieMentorJourneyRecoveryHttpTransportAdapter } from "./MovieMentorJourneyRecoveryHttpTransportAdapter.js";

const MOVIE_MENTOR_JOURNEY_RECOVERY_EXPRESS_ROUTER_FACTORY_VERSION = "1.0.0";

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function internalFailure() {
  return Object.freeze({
    statusCode: 500,
    body: Object.freeze({
      success: false,
      code: "MOVIE_MENTOR_RECOVERY_INTERNAL_ERROR",
      message: "Recovery publication failed.",
    }),
  });
}

/**
 * 3C.5E.4B — Recovery Express Router Factory
 *
 * Builds an UNMOUNTED Express router around the already-certified recovery
 * transport chain. This module does not decide whether the application is
 * allowed to mount the router; 3C.5E.4A owns that decision.
 *
 * Route-local project identity comes only from req.params.projectId. The body
 * is never consulted to choose a project and is passed unchanged to the
 * certified HTTP transport adapter, which rejects body projectId injection.
 */
function createMovieMentorJourneyRecoveryExpressRouter({
  verifyCredential = null,
  expectedIssuer = null,
  expectedAudience = null,
  now = () => new Date(),
  ownershipAuthority = undefined,
  applyRecoveryTransition = undefined,
  recoveryTransitionDeps = undefined,
  routerFactory = () => express.Router(),
  createRequestAuthority = createMovieMentorJourneyRecoveryRequestAuthority,
  createPublicationBoundary = createMovieMentorJourneyRecoveryPublicationBoundary,
  createHttpAdapter = createMovieMentorJourneyRecoveryHttpTransportAdapter,
} = {}) {
  if (typeof verifyCredential !== "function") {
    fail(
      "MOVIE_MENTOR_JOURNEY_RECOVERY_EXPRESS_VERIFIER_REQUIRED",
      "Recovery Express router requires an externally supplied credential verifier."
    );
  }

  const issuer = cleanString(expectedIssuer);
  if (!issuer) {
    fail(
      "MOVIE_MENTOR_JOURNEY_RECOVERY_EXPRESS_ISSUER_REQUIRED",
      "Recovery Express router requires an explicit expected issuer."
    );
  }

  const audience = cleanString(expectedAudience);
  if (!audience) {
    fail(
      "MOVIE_MENTOR_JOURNEY_RECOVERY_EXPRESS_AUDIENCE_REQUIRED",
      "Recovery Express router requires an explicit expected audience."
    );
  }

  if (typeof routerFactory !== "function") {
    fail(
      "MOVIE_MENTOR_JOURNEY_RECOVERY_EXPRESS_ROUTER_FACTORY_REQUIRED",
      "Recovery Express router requires a router factory."
    );
  }
  if (typeof createRequestAuthority !== "function") {
    fail(
      "MOVIE_MENTOR_JOURNEY_RECOVERY_EXPRESS_REQUEST_AUTHORITY_FACTORY_REQUIRED",
      "Recovery Express router requires the certified request-authority factory."
    );
  }
  if (typeof createPublicationBoundary !== "function") {
    fail(
      "MOVIE_MENTOR_JOURNEY_RECOVERY_EXPRESS_PUBLICATION_FACTORY_REQUIRED",
      "Recovery Express router requires the certified publication-boundary factory."
    );
  }
  if (typeof createHttpAdapter !== "function") {
    fail(
      "MOVIE_MENTOR_JOURNEY_RECOVERY_EXPRESS_HTTP_ADAPTER_FACTORY_REQUIRED",
      "Recovery Express router requires the certified HTTP-adapter factory."
    );
  }

  const requestAuthorityOptions = {
    verifyCredential,
    expectedIssuer: issuer,
    expectedAudience: audience,
    now,
  };
  if (ownershipAuthority !== undefined) {
    requestAuthorityOptions.ownershipAuthority = ownershipAuthority;
  }

  const requestAuthority = createRequestAuthority(requestAuthorityOptions);

  const publicationOptions = { requestAuthority };
  if (applyRecoveryTransition !== undefined) {
    publicationOptions.applyRecoveryTransition = applyRecoveryTransition;
  }
  if (recoveryTransitionDeps !== undefined) {
    publicationOptions.recoveryTransitionDeps = recoveryTransitionDeps;
  }

  const publicationBoundary = createPublicationBoundary(publicationOptions);
  const httpAdapter = createHttpAdapter({ publicationBoundary });

  if (typeof httpAdapter?.handle !== "function") {
    fail(
      "MOVIE_MENTOR_JOURNEY_RECOVERY_EXPRESS_HTTP_ADAPTER_INVALID",
      "Recovery Express router received an invalid HTTP transport adapter."
    );
  }

  const router = routerFactory();
  if (!router || typeof router.post !== "function") {
    fail(
      "MOVIE_MENTOR_JOURNEY_RECOVERY_EXPRESS_ROUTER_INVALID",
      "Recovery Express router factory did not produce an Express-compatible router."
    );
  }

  router.post("/:projectId/recovery", async (req, res) => {
    let transport;
    try {
      transport = await httpAdapter.handle({
        request: req,
        projectId: cleanString(req?.params?.projectId) || null,
      });
    } catch {
      transport = internalFailure();
    }

    const statusCode = Number.isInteger(transport?.statusCode)
      ? transport.statusCode
      : 500;
    const body = transport?.body && typeof transport.body === "object"
      ? transport.body
      : internalFailure().body;

    return res.status(statusCode).json(body);
  });

  return router;
}

export {
  MOVIE_MENTOR_JOURNEY_RECOVERY_EXPRESS_ROUTER_FACTORY_VERSION,
  createMovieMentorJourneyRecoveryExpressRouter,
};

export default createMovieMentorJourneyRecoveryExpressRouter;
