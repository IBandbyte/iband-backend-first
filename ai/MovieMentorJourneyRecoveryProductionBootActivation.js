import crypto from "node:crypto";
import {
  createMovieMentorJourneyRecoveryActivationLeaseComposition,
  getMovieMentorJourneyRecoveryActivationLeaseCompositionStatus,
} from "./MovieMentorJourneyRecoveryActivationLeaseComposition.js";

const VERSION = "1.1.0";
const DOMAIN = "iband.movie-mentor.journey-recovery-production-boot-activation";
const DEPLOYMENT_ENV = "MOVIE_MENTOR_RECOVERY_DEPLOYMENT_ID";

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function freeze(value) { return Object.freeze(value); }
function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
function closed(reason, extras = {}) {
  return freeze({
    ready: false,
    reason,
    activationAuthority: null,
    renewActivation: null,
    assertFence: null,
    processInstanceId: "",
    deploymentId: text(extras.deploymentId),
    version: VERSION,
    domain: DOMAIN,
    bootWired: true,
    ...extras,
  });
}

function createMovieMentorJourneyRecoveryProductionBootActivation({
  env = process.env,
  pid = process.pid,
  randomId = () => crypto.randomUUID(),
  createComposition = createMovieMentorJourneyRecoveryActivationLeaseComposition,
  getCompositionStatus = getMovieMentorJourneyRecoveryActivationLeaseCompositionStatus,
} = {}) {
  const deploymentId = text(env?.[DEPLOYMENT_ENV]);
  if (!deploymentId) return closed("deployment-id-unconfigured");
  if (typeof createComposition !== "function" || typeof getCompositionStatus !== "function") {
    fail("MOVIE_MENTOR_RECOVERY_PRODUCTION_BOOT_ACTIVATION_COMPOSITION_REQUIRED", "Production boot activation requires the certified composition factory and status inspector.");
  }
  const compositionStatus = getCompositionStatus();
  if (!compositionStatus?.ready || compositionStatus?.durable !== true) {
    return closed("durable-composition-not-ready", { deploymentId, compositionStatus: compositionStatus || null });
  }
  const processToken = text(randomId());
  if (!processToken) fail("MOVIE_MENTOR_RECOVERY_PRODUCTION_BOOT_ACTIVATION_PROCESS_ID_INVALID", "Production boot activation could not mint a process instance identity.");
  const processInstanceId = `recovery-process-${pid}-${processToken}`;
  const composition = createComposition();
  if (
    !composition ||
    typeof composition.authorizeActivation !== "function" ||
    typeof composition.renewActivation !== "function" ||
    typeof composition.assertFence !== "function"
  ) {
    fail("MOVIE_MENTOR_RECOVERY_PRODUCTION_BOOT_ACTIVATION_AUTHORITY_INVALID", "Certified composition did not expose complete authorize/renew/assert activation authority.");
  }
  return freeze({
    ready: true,
    reason: "certified-durable-composition-wired-for-boot",
    activationAuthority: composition.authorizeActivation.bind(composition),
    renewActivation: composition.renewActivation.bind(composition),
    assertFence: composition.assertFence.bind(composition),
    processInstanceId,
    deploymentId,
    version: VERSION,
    domain: DOMAIN,
    bootWired: true,
    compositionStatus,
  });
}

function getMovieMentorJourneyRecoveryProductionBootActivationStatus({ env = process.env } = {}) {
  const deploymentId = text(env?.[DEPLOYMENT_ENV]);
  const compositionStatus = getMovieMentorJourneyRecoveryActivationLeaseCompositionStatus();
  return freeze({ version: VERSION, domain: DOMAIN, ready: Boolean(deploymentId && compositionStatus?.ready && compositionStatus?.durable === true), deploymentConfigured: Boolean(deploymentId), compositionReady: Boolean(compositionStatus?.ready && compositionStatus?.durable === true), liveFenceWired: true, bootWired: true, deploymentEnv: DEPLOYMENT_ENV });
}

export {
  VERSION as MOVIE_MENTOR_JOURNEY_RECOVERY_PRODUCTION_BOOT_ACTIVATION_VERSION,
  DOMAIN as MOVIE_MENTOR_JOURNEY_RECOVERY_PRODUCTION_BOOT_ACTIVATION_DOMAIN,
  DEPLOYMENT_ENV as MOVIE_MENTOR_JOURNEY_RECOVERY_DEPLOYMENT_ENV,
  createMovieMentorJourneyRecoveryProductionBootActivation,
  getMovieMentorJourneyRecoveryProductionBootActivationStatus,
};

export default createMovieMentorJourneyRecoveryProductionBootActivation;
