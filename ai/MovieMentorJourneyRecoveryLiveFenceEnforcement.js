const VERSION = "1.0.0";
const DOMAIN = "iband.movie-mentor.journey-recovery-live-fence-enforcement";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function freeze(value) {
  return Object.freeze(value);
}

function safeInstant(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function normalizeEvidence(evidence = {}) {
  const normalized = {
    authorized: evidence?.authorized === true,
    processInstanceId: text(evidence?.processInstanceId),
    deploymentId: text(evidence?.deploymentId),
    basePath: text(evidence?.basePath),
    expectedIssuer: text(evidence?.expectedIssuer),
    expectedAudience: text(evidence?.expectedAudience),
    activationEpoch: text(evidence?.activationEpoch),
    activationReference: text(evidence?.activationReference),
    fencingToken: text(evidence?.fencingToken),
    expiresAt: safeInstant(evidence?.expiresAt)?.toISOString() || "",
    authorizationSource: text(evidence?.authorizationSource),
  };

  if (
    !normalized.authorized ||
    !normalized.processInstanceId ||
    !normalized.deploymentId ||
    !normalized.basePath ||
    !normalized.expectedIssuer ||
    !normalized.expectedAudience ||
    !normalized.activationEpoch ||
    !normalized.activationReference ||
    !normalized.fencingToken ||
    !normalized.expiresAt
  ) {
    fail(
      "MOVIE_MENTOR_RECOVERY_LIVE_FENCE_EVIDENCE_REQUIRED",
      "Live recovery fence enforcement requires complete authorized lease evidence."
    );
  }

  return freeze(normalized);
}

function sameLeaseIdentity(left, right) {
  return (
    left.processInstanceId === right.processInstanceId &&
    left.deploymentId === right.deploymentId &&
    left.basePath === right.basePath &&
    left.expectedIssuer === right.expectedIssuer &&
    left.expectedAudience === right.expectedAudience &&
    left.activationEpoch === right.activationEpoch &&
    left.activationReference === right.activationReference &&
    left.fencingToken === right.fencingToken
  );
}

function createMovieMentorJourneyRecoveryLiveFenceEnforcement({
  activationEvidence,
  renewActivation,
  assertFence,
  now = () => new Date(),
  setTimer = (fn, delay) => setTimeout(fn, delay),
  clearTimer = (timer) => clearTimeout(timer),
  minimumRenewalDelayMs = 1_000,
  maximumRenewalDelayMs = 20_000,
} = {}) {
  if (typeof renewActivation !== "function" || typeof assertFence !== "function") {
    fail(
      "MOVIE_MENTOR_RECOVERY_LIVE_FENCE_AUTHORITY_REQUIRED",
      "Live recovery fence enforcement requires certified renewal and fence assertion authority."
    );
  }
  if (!Number.isSafeInteger(minimumRenewalDelayMs) || minimumRenewalDelayMs < 1) {
    fail(
      "MOVIE_MENTOR_RECOVERY_LIVE_FENCE_RENEWAL_DELAY_INVALID",
      "Live recovery fence minimum renewal delay must be a positive safe integer."
    );
  }
  if (!Number.isSafeInteger(maximumRenewalDelayMs) || maximumRenewalDelayMs < minimumRenewalDelayMs) {
    fail(
      "MOVIE_MENTOR_RECOVERY_LIVE_FENCE_RENEWAL_DELAY_INVALID",
      "Live recovery fence maximum renewal delay must be a safe integer at least as large as the minimum delay."
    );
  }

  let currentEvidence = normalizeEvidence(activationEvidence);
  let state = "authorized";
  let reason = "activation-lease-live";
  let timer = null;
  let renewalInFlight = false;
  let stopped = false;

  function close(nextReason) {
    state = "closed";
    reason = text(nextReason) || "activation-lease-authority-lost";
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
  }

  function authorityRequest(evidence = currentEvidence) {
    return freeze({
      processInstanceId: evidence.processInstanceId,
      deploymentId: evidence.deploymentId,
      basePath: evidence.basePath,
      expectedIssuer: evidence.expectedIssuer,
      expectedAudience: evidence.expectedAudience,
      activationEpoch: evidence.activationEpoch,
      activationReference: evidence.activationReference,
      fencingToken: evidence.fencingToken,
    });
  }

  function renewalDelay() {
    const at = safeInstant(now());
    const expiry = safeInstant(currentEvidence.expiresAt);
    if (!at || !expiry) {
      close("activation-lease-clock-invalid");
      return null;
    }
    const remaining = expiry.getTime() - at.getTime();
    if (remaining <= 0) {
      close("activation-lease-expired");
      return null;
    }
    const halfLife = Math.floor(remaining / 2);
    return Math.max(minimumRenewalDelayMs, Math.min(maximumRenewalDelayMs, halfLife));
  }

  function scheduleRenewal() {
    if (stopped || state !== "authorized" || timer !== null) return;
    const delay = renewalDelay();
    if (delay === null) return;
    timer = setTimer(async () => {
      timer = null;
      await renewNow();
    }, delay);
  }

  async function renewNow() {
    if (stopped || state !== "authorized") {
      return freeze({ authorized: false, reason });
    }
    if (renewalInFlight) {
      return freeze({ authorized: false, reason: "activation-lease-renewal-in-flight" });
    }

    renewalInFlight = true;
    const before = currentEvidence;
    try {
      const renewed = await renewActivation(authorityRequest(before));
      if (!renewed || renewed.authorized !== true) {
        close(renewed?.reason || "activation-lease-renewal-not-authorized");
        return freeze({ authorized: false, reason });
      }

      const normalized = normalizeEvidence(renewed);
      if (!sameLeaseIdentity(before, normalized)) {
        close("activation-lease-renewal-binding-conflict");
        return freeze({ authorized: false, reason });
      }

      const beforeExpiry = safeInstant(before.expiresAt);
      const renewedExpiry = safeInstant(normalized.expiresAt);
      if (!beforeExpiry || !renewedExpiry || renewedExpiry.getTime() <= beforeExpiry.getTime()) {
        close("activation-lease-renewal-did-not-advance-expiry");
        return freeze({ authorized: false, reason });
      }

      currentEvidence = normalized;
      reason = "activation-lease-renewed";
      scheduleRenewal();
      return currentEvidence;
    } catch {
      close("activation-lease-renewal-uncertain");
      return freeze({ authorized: false, reason });
    } finally {
      renewalInFlight = false;
    }
  }

  async function assertCurrentAuthority() {
    if (stopped || state !== "authorized") {
      return freeze({ authorized: false, reason });
    }

    try {
      const asserted = await assertFence(authorityRequest());
      if (!asserted || asserted.authorized !== true) {
        close(asserted?.reason || "activation-lease-fenced");
        return freeze({ authorized: false, reason });
      }

      const normalized = normalizeEvidence(asserted);
      if (!sameLeaseIdentity(currentEvidence, normalized)) {
        close("activation-lease-fence-binding-conflict");
        return freeze({ authorized: false, reason });
      }

      currentEvidence = normalized;
      reason = "activation-lease-fence-asserted";
      return currentEvidence;
    } catch {
      close("activation-lease-fence-uncertain");
      return freeze({ authorized: false, reason });
    }
  }

  function guardRouter(router) {
    if (typeof router !== "function") {
      fail(
        "MOVIE_MENTOR_RECOVERY_LIVE_FENCE_ROUTER_REQUIRED",
        "Live recovery fence enforcement requires an Express-compatible recovery router."
      );
    }

    return async function movieMentorJourneyRecoveryLiveFenceGuard(req, res, next) {
      const authority = await assertCurrentAuthority();
      if (!authority.authorized) {
        if (res && typeof res.status === "function" && typeof res.json === "function") {
          return res.status(503).json({
            success: false,
            code: "MOVIE_MENTOR_RECOVERY_ACTIVATION_AUTHORITY_LOST",
            message: "Journey recovery is temporarily unavailable because live activation authority is not proven.",
          });
        }
        return undefined;
      }
      return router(req, res, next);
    };
  }

  function start() {
    if (!stopped && state === "authorized") scheduleRenewal();
    return getStatus();
  }

  function stop() {
    stopped = true;
    close("activation-lease-lifecycle-stopped");
    return getStatus();
  }

  function getStatus() {
    return freeze({
      version: VERSION,
      domain: DOMAIN,
      state,
      reason,
      authorized: !stopped && state === "authorized",
      renewalInFlight,
      timerScheduled: timer !== null,
      activationEpoch: currentEvidence.activationEpoch,
      activationReference: currentEvidence.activationReference,
      fencingToken: currentEvidence.fencingToken,
      expiresAt: currentEvidence.expiresAt,
    });
  }

  return freeze({
    start,
    stop,
    renewNow,
    assertCurrentAuthority,
    guardRouter,
    getStatus,
  });
}

export {
  VERSION as MOVIE_MENTOR_JOURNEY_RECOVERY_LIVE_FENCE_ENFORCEMENT_VERSION,
  DOMAIN as MOVIE_MENTOR_JOURNEY_RECOVERY_LIVE_FENCE_ENFORCEMENT_DOMAIN,
  createMovieMentorJourneyRecoveryLiveFenceEnforcement,
};

export default createMovieMentorJourneyRecoveryLiveFenceEnforcement;
