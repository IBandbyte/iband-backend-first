import crypto from "node:crypto";

const VERSION = "1.0.0";
const DOMAIN = "iband.movie-mentor.journey-recovery-activation-lease";

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function freeze(value) { return Object.freeze(value); }
function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
function instant(value) { const date = value instanceof Date ? new Date(value) : new Date(value); if (Number.isNaN(date.getTime())) fail("MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_TIME_INVALID", "Activation lease time is invalid."); return date; }
function sameBinding(record, request) { return text(record?.processInstanceId) === request.processInstanceId && text(record?.deploymentId) === request.deploymentId && text(record?.basePath) === request.basePath && text(record?.expectedIssuer) === request.expectedIssuer && text(record?.expectedAudience) === request.expectedAudience; }
function active(record, at) { return record && text(record.status || "active") === "active" && instant(record.expiresAt).getTime() > at.getTime(); }
function evidence(record) { return freeze({ authorized: true, processInstanceId: text(record.processInstanceId), deploymentId: text(record.deploymentId), basePath: text(record.basePath), expectedIssuer: text(record.expectedIssuer), expectedAudience: text(record.expectedAudience), activationEpoch: String(record.leaseGeneration), activationReference: text(record.leaseReference), fencingToken: text(record.fencingToken), leaseGeneration: record.leaseGeneration, expiresAt: instant(record.expiresAt).toISOString(), authorizationSource: DOMAIN }); }

export function createMovieMentorJourneyRecoveryActivationLeaseAuthority({ readLease, createLease, replaceLease, now = () => new Date(), leaseMs = 60_000, randomId = () => crypto.randomUUID() } = {}) {
  if (typeof readLease !== "function" || typeof createLease !== "function" || typeof replaceLease !== "function") fail("MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_STORE_REQUIRED", "Activation lease authority requires durable read/create/replace dependencies.");
  if (!Number.isSafeInteger(leaseMs) || leaseMs <= 0) fail("MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_DURATION_INVALID", "Activation lease duration must be a positive safe integer.");

  async function rereadExact(request, generation, reference) { const durable = await readLease(); return durable && sameBinding(durable, request) && durable.leaseGeneration === generation && text(durable.leaseReference) === reference ? durable : null; }

  return freeze({
    async authorizeActivation(input = {}) {
      const request = freeze({ processInstanceId: text(input.processInstanceId), deploymentId: text(input.deploymentId), basePath: text(input.basePath), expectedIssuer: text(input.expectedIssuer), expectedAudience: text(input.expectedAudience) });
      if (Object.values(request).some((value) => !value)) return freeze({ authorized: false, reason: "activation-lease-binding-incomplete" });
      const at = instant(now());
      let current = await readLease();

      if (active(current, at)) {
        if (!sameBinding(current, request)) return freeze({ authorized: false, reason: "activation-lease-held-by-another-process", holderProcessInstanceId: text(current.processInstanceId), activationEpoch: String(current.leaseGeneration) });
        return evidence(current);
      }

      const previousGeneration = current?.leaseGeneration;
      if (current && (!Number.isSafeInteger(previousGeneration) || previousGeneration < 1)) fail("MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_RECORD_INVALID", "Durable activation lease generation is invalid.");
      const generation = current ? previousGeneration + 1 : 1;
      const reference = `recovery-activation-${randomId()}`;
      const fencingToken = `recovery-fence-${generation}-${randomId()}`;
      const next = freeze({ ...request, status: "active", leaseGeneration: generation, leaseReference: reference, fencingToken, acquiredAt: at.toISOString(), expiresAt: new Date(at.getTime() + leaseMs).toISOString() });
      try {
        current = current ? await replaceLease(next, { expectedLeaseGeneration: previousGeneration, expectedLeaseReference: text(current.leaseReference) }) : await createLease(next);
      } catch (error) {
        const exact = await rereadExact(request, generation, reference);
        if (exact) return evidence(exact);
        throw error;
      }
      if (!current) { const exact = await rereadExact(request, generation, reference); if (exact) return evidence(exact); return freeze({ authorized: false, reason: "activation-lease-race-lost" }); }
      return evidence(current);
    },

    async renewActivation({ processInstanceId, deploymentId, basePath, expectedIssuer, expectedAudience, activationEpoch, activationReference, fencingToken } = {}) {
      const request = freeze({ processInstanceId: text(processInstanceId), deploymentId: text(deploymentId), basePath: text(basePath), expectedIssuer: text(expectedIssuer), expectedAudience: text(expectedAudience) });
      const current = await readLease();
      const generation = Number(activationEpoch);
      const at = instant(now());
      if (!current || !sameBinding(current, request) || current.leaseGeneration !== generation || text(current.leaseReference) !== text(activationReference) || text(current.fencingToken) !== text(fencingToken)) return freeze({ authorized: false, reason: "activation-lease-fenced" });
      if (!active(current, at)) return freeze({ authorized: false, reason: "activation-lease-expired" });
      const next = freeze({ ...current, expiresAt: new Date(at.getTime() + leaseMs).toISOString() });
      try { const written = await replaceLease(next, { expectedLeaseGeneration: generation, expectedLeaseReference: text(current.leaseReference), expectedExpiresAt: instant(current.expiresAt).toISOString() }); if (!written) return freeze({ authorized: false, reason: "activation-lease-renewal-race-lost" }); return evidence(written); }
      catch (error) { const durable = await readLease(); if (durable && sameBinding(durable, request) && durable.leaseGeneration === generation && text(durable.leaseReference) === text(current.leaseReference) && instant(durable.expiresAt).getTime() > instant(current.expiresAt).getTime()) return evidence(durable); throw error; }
    },

    async assertFence({ processInstanceId, activationEpoch, activationReference, fencingToken } = {}) {
      const current = await readLease();
      const at = instant(now());
      if (!active(current, at) || text(current.processInstanceId) !== text(processInstanceId) || current.leaseGeneration !== Number(activationEpoch) || text(current.leaseReference) !== text(activationReference) || text(current.fencingToken) !== text(fencingToken)) return freeze({ authorized: false, reason: "activation-lease-fenced" });
      return evidence(current);
    },
  });
}

export { VERSION as MOVIE_MENTOR_JOURNEY_RECOVERY_ACTIVATION_LEASE_AUTHORITY_VERSION, DOMAIN as MOVIE_MENTOR_JOURNEY_RECOVERY_ACTIVATION_LEASE_DOMAIN };
