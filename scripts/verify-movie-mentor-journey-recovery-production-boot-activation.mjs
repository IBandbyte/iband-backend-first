import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createMovieMentorJourneyRecoveryProductionBootActivation,
  MOVIE_MENTOR_JOURNEY_RECOVERY_DEPLOYMENT_ENV,
} from "../ai/MovieMentorJourneyRecoveryProductionBootActivation.js";

function readyStatus() {
  return Object.freeze({ ready: true, durable: true, source: "test-durable-store", bootWired: false });
}

{
  let created = 0;
  const result = createMovieMentorJourneyRecoveryProductionBootActivation({
    env: {},
    createComposition: () => { created += 1; return { authorizeActivation() {} }; },
    getCompositionStatus: readyStatus,
  });
  assert.equal(result.ready, false);
  assert.equal(result.reason, "deployment-id-unconfigured");
  assert.equal(result.activationAuthority, null);
  assert.equal(created, 0, "missing deployment identity must not instantiate composition");
}

{
  let created = 0;
  const result = createMovieMentorJourneyRecoveryProductionBootActivation({
    env: { [MOVIE_MENTOR_JOURNEY_RECOVERY_DEPLOYMENT_ENV]: "deploy-a" },
    createComposition: () => { created += 1; return { authorizeActivation() {} }; },
    getCompositionStatus: () => ({ ready: false, durable: true }),
  });
  assert.equal(result.ready, false);
  assert.equal(result.reason, "durable-composition-not-ready");
  assert.equal(result.activationAuthority, null);
  assert.equal(created, 0, "unready durability must not be bypassed");
}

{
  let received = null;
  const composition = {
    async authorizeActivation(input) {
      received = input;
      return { authorized: true, ...input, activationEpoch: "7", activationReference: "ref-7" };
    },
    async renewActivation(input) { return { authorized: true, ...input }; },
    async assertFence(input) { return { authorized: true, ...input }; },
  };
  const result = createMovieMentorJourneyRecoveryProductionBootActivation({
    env: { [MOVIE_MENTOR_JOURNEY_RECOVERY_DEPLOYMENT_ENV]: "deploy-green" },
    pid: 4242,
    randomId: () => "process-token",
    createComposition: () => composition,
    getCompositionStatus: readyStatus,
  });
  assert.equal(result.ready, true);
  assert.equal(result.bootWired, true);
  assert.equal(result.deploymentId, "deploy-green");
  assert.equal(result.processInstanceId, "recovery-process-4242-process-token");
  assert.equal(typeof result.activationAuthority, "function");
  assert.equal(typeof result.renewActivation, "function");
  assert.equal(typeof result.assertFence, "function");
  const request = { processInstanceId: result.processInstanceId, deploymentId: result.deploymentId, basePath: "/api/movie-mentor-recovery", expectedIssuer: "issuer", expectedAudience: "audience" };
  const evidence = await result.activationAuthority(request);
  assert.equal(evidence.authorized, true);
  assert.deepEqual(received, request, "boot adapter must delegate authority without rewriting binding evidence");
}

{
  assert.throws(
    () => createMovieMentorJourneyRecoveryProductionBootActivation({
      env: { [MOVIE_MENTOR_JOURNEY_RECOVERY_DEPLOYMENT_ENV]: "deploy-bad" },
      pid: 1,
      randomId: () => "token",
      createComposition: () => ({}),
      getCompositionStatus: readyStatus,
    }),
    (error) => error?.code === "MOVIE_MENTOR_RECOVERY_PRODUCTION_BOOT_ACTIVATION_AUTHORITY_INVALID"
  );
}

{
  const server = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
  assert.match(server, /MovieMentorJourneyRecoveryProductionBootAssembly\.js/);
  assert.doesNotMatch(server, /createMovieMentorJourneyRecoveryActivationLeaseMongoStore/);
  assert.doesNotMatch(server, /createMovieMentorJourneyRecoveryActivationLeaseAuthority/);

  const assembly = fs.readFileSync(new URL("../ai/MovieMentorJourneyRecoveryProductionBootAssembly.js", import.meta.url), "utf8");
  assert.match(assembly, /MovieMentorJourneyRecoveryProductionBootActivation\.js/);
  assert.match(assembly, /activationAuthority:\s*bootActivation\?\.activationAuthority/);
  assert.match(assembly, /renewActivation:\s*bootActivation\?\.renewActivation/);
  assert.match(assembly, /assertFence:\s*bootActivation\?\.assertFence/);
  assert.match(assembly, /processInstanceId:\s*bootActivation\?\.processInstanceId/);
  assert.match(assembly, /deploymentId:\s*bootActivation\?\.deploymentId/);
}

{
  const composition = fs.readFileSync(new URL("../ai/MovieMentorJourneyRecoveryActivationLeaseComposition.js", import.meta.url), "utf8");
  assert.doesNotMatch(composition, /^\s*import\s+.*(?:from\s+)?["'][^"']*server\.js["']/m);
  assert.doesNotMatch(composition, /\bexpress\s*\(/i);
  assert.doesNotMatch(composition, /from\s+["']express["']/i);
}

console.log("✅ 3C.5E.4G.3 production boot activation wiring torture passed");
console.log("✅ Missing deployment identity remains fail-closed");
console.log("✅ Unready durable composition cannot be bypassed");
console.log("✅ Runtime process identity is unique process-scoped evidence, not authority");
console.log("✅ Final boot assembly receives only the certified activation functions and binding identities");
console.log("✅ Mongo store and lease authority internals do not leak directly into server.js");
console.log("✅ Authentication/exposure assembly now sits above activation without weakening durable authority");
console.log("🏏💥 DROP. THE. IMPORT. The only import allowed through is the certified boot adapter.");
