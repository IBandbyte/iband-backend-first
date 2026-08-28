// MovieMentorJourneyRecoveryCrossProcessActivationBoundary.js
// Version: 1.1.0
//
// 3C.5E.4F / 4G.4 — Cross-Process Activation Reality + Live Fence Evidence
//
// A process-local WeakMap cannot prove service-level exposure reality across
// crashes, rolling deploys or overlapping instances. This boundary therefore
// requires an externally supplied activation authority before a process may
// conclude that it is allowed to expose the recovery route.
//
// 4G.4 additionally preserves the durable fencing token and lease expiry so a
// successful mount can never be mistaken for perpetual authority to remain live.
//
// Constitutional law:
//   Process-local absence is not proof of service-level absence.
//   Restart is not authority to remount.
//   Cross-process activation requires external reality evidence.
//   Mount authority must preserve the fence needed to prove continuing authority.

const DOMAIN = "iband.movie-mentor.journey-recovery-cross-process-activation";
const SCHEMA_VERSION = 2;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function freeze(value) {
  return Object.freeze(value);
}

function closed(reason) {
  return freeze({
    authorized: false,
    reason,
    domain: DOMAIN,
    schemaVersion: SCHEMA_VERSION,
  });
}

function validExpiry(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export async function authorizeMovieMentorJourneyRecoveryProcessActivation({
  processInstanceId = null,
  deploymentId = null,
  basePath = null,
  expectedIssuer = null,
  expectedAudience = null,
  authorizeActivation = null,
} = {}) {
  const processId = text(processInstanceId);
  const deployment = text(deploymentId);
  const path = text(basePath);
  const issuer = text(expectedIssuer);
  const audience = text(expectedAudience);

  if (typeof authorizeActivation !== "function") {
    return closed("cross-process-activation-authority-unavailable");
  }
  if (!processId) {
    return closed("process-instance-id-unconfigured");
  }
  if (!deployment) {
    return closed("deployment-id-unconfigured");
  }
  if (!path || !issuer || !audience) {
    return closed("activation-binding-incomplete");
  }

  const evidence = await authorizeActivation(
    freeze({
      processInstanceId: processId,
      deploymentId: deployment,
      basePath: path,
      expectedIssuer: issuer,
      expectedAudience: audience,
    })
  );

  if (!evidence || evidence.authorized !== true) {
    return closed("cross-process-activation-not-authorized");
  }

  if (
    text(evidence.processInstanceId) !== processId ||
    text(evidence.deploymentId) !== deployment ||
    text(evidence.basePath) !== path ||
    text(evidence.expectedIssuer) !== issuer ||
    text(evidence.expectedAudience) !== audience
  ) {
    return closed("cross-process-activation-binding-conflict");
  }

  const activationEpoch = text(evidence.activationEpoch);
  const activationReference = text(evidence.activationReference);
  const fencingToken = text(evidence.fencingToken);
  const expiresAt = validExpiry(evidence.expiresAt);
  if (!activationEpoch || !activationReference || !fencingToken || !expiresAt) {
    return closed("cross-process-activation-evidence-incomplete");
  }

  return freeze({
    authorized: true,
    reason: "cross-process-activation-authorized",
    processInstanceId: processId,
    deploymentId: deployment,
    basePath: path,
    expectedIssuer: issuer,
    expectedAudience: audience,
    activationEpoch,
    activationReference,
    fencingToken,
    expiresAt,
    authorizationSource:
      text(evidence.authorizationSource) || "external-cross-process-activation-authority",
    domain: DOMAIN,
    schemaVersion: SCHEMA_VERSION,
  });
}

export const MOVIE_MENTOR_JOURNEY_RECOVERY_CROSS_PROCESS_ACTIVATION_BOUNDARY =
  freeze({
    domain: DOMAIN,
    schemaVersion: SCHEMA_VERSION,
    law:
      "Process-local absence cannot authorize service-level remount; external process-bound activation evidence and its live fencing proof are required.",
  });
