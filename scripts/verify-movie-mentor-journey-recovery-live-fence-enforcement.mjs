import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createMovieMentorJourneyRecoveryLiveFenceEnforcement,
} from "../ai/MovieMentorJourneyRecoveryLiveFenceEnforcement.js";
import {
  authorizeMovieMentorJourneyRecoveryProcessActivation,
} from "../ai/MovieMentorJourneyRecoveryCrossProcessActivationBoundary.js";
import {
  createMovieMentorJourneyRecoveryProductionBootActivation,
} from "../ai/MovieMentorJourneyRecoveryProductionBootActivation.js";

console.log("[4G.4] production activation lease renewal + live fence torture starting");

const BASE = Object.freeze({
  authorized: true,
  processInstanceId: "process-a",
  deploymentId: "deployment-a",
  basePath: "/api/movie-mentor-recovery",
  expectedIssuer: "https://issuer.example",
  expectedAudience: "movie-mentor-recovery",
  activationEpoch: "7",
  activationReference: "activation-7",
  fencingToken: "fence-7-secret",
  expiresAt: "2026-08-28T18:01:00.000Z",
  authorizationSource: "durable-test-authority",
});

let nowMs = Date.parse("2026-08-28T18:00:00.000Z");
const scheduled = [];
const cleared = [];
let renewCalls = 0;
let assertCalls = 0;
let routerCalls = 0;

const live = createMovieMentorJourneyRecoveryLiveFenceEnforcement({
  activationEvidence: BASE,
  now: () => new Date(nowMs),
  setTimer: (fn, delay) => {
    const handle = { fn, delay, id: scheduled.length + 1 };
    scheduled.push(handle);
    return handle;
  },
  clearTimer: (handle) => cleared.push(handle?.id),
  renewActivation: async (request) => {
    renewCalls += 1;
    assert.equal(request.fencingToken, BASE.fencingToken);
    assert.equal(request.activationEpoch, BASE.activationEpoch);
    return Object.freeze({
      ...BASE,
      expiresAt: "2026-08-28T18:02:00.000Z",
    });
  },
  assertFence: async (request) => {
    assertCalls += 1;
    assert.equal(request.fencingToken, BASE.fencingToken);
    return Object.freeze({ ...BASE, expiresAt: "2026-08-28T18:02:00.000Z" });
  },
});

assert.equal(live.getStatus().authorized, true);
live.start();
assert.equal(scheduled.length, 1);
assert.equal(scheduled[0].delay, 20_000);

const renewed = await live.renewNow();
assert.equal(renewed.authorized, true);
assert.equal(renewCalls, 1);
assert.equal(live.getStatus().expiresAt, "2026-08-28T18:02:00.000Z");

const guarded = live.guardRouter(async () => {
  routerCalls += 1;
  return "router-ran";
});
const allowedResult = await guarded({}, {}, () => {});
assert.equal(allowedResult, "router-ran");
assert.equal(assertCalls, 1);
assert.equal(routerCalls, 1);

let takeoverFenceChecks = 0;
let takeoverRouterCalls = 0;
const takeover = createMovieMentorJourneyRecoveryLiveFenceEnforcement({
  activationEvidence: BASE,
  now: () => new Date(nowMs),
  renewActivation: async () => ({ ...BASE, expiresAt: "2026-08-28T18:02:00.000Z" }),
  assertFence: async () => {
    takeoverFenceChecks += 1;
    return Object.freeze({ authorized: false, reason: "activation-lease-fenced" });
  },
});
const takeoverResponse = {
  statusCode: null,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return body; },
};
await takeover.guardRouter(async () => { takeoverRouterCalls += 1; })({}, takeoverResponse, () => {});
assert.equal(takeoverFenceChecks, 1);
assert.equal(takeoverRouterCalls, 0);
assert.equal(takeoverResponse.statusCode, 503);
assert.equal(takeoverResponse.body.code, "MOVIE_MENTOR_RECOVERY_ACTIVATION_AUTHORITY_LOST");
assert.equal(takeover.getStatus().authorized, false);

let uncertainAssertCalls = 0;
const uncertain = createMovieMentorJourneyRecoveryLiveFenceEnforcement({
  activationEvidence: BASE,
  now: () => new Date(nowMs),
  renewActivation: async () => { throw new Error("write ACK lost and durable reality unresolved"); },
  assertFence: async () => { uncertainAssertCalls += 1; return BASE; },
});
const uncertainRenewal = await uncertain.renewNow();
assert.equal(uncertainRenewal.authorized, false);
assert.equal(uncertainRenewal.reason, "activation-lease-renewal-uncertain");
const uncertainResponse = {
  statusCode: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { return body; },
};
await uncertain.guardRouter(async () => { throw new Error("must never run"); })({}, uncertainResponse, () => {});
assert.equal(uncertainResponse.statusCode, 503);
assert.equal(uncertainAssertCalls, 0);

const stale = createMovieMentorJourneyRecoveryLiveFenceEnforcement({
  activationEvidence: BASE,
  now: () => new Date(nowMs),
  renewActivation: async () => ({
    ...BASE,
    activationEpoch: "8",
    activationReference: "activation-8",
    fencingToken: "fence-8-new-owner",
    expiresAt: "2026-08-28T18:02:00.000Z",
  }),
  assertFence: async () => BASE,
});
const staleRenewal = await stale.renewNow();
assert.equal(staleRenewal.authorized, false);
assert.equal(staleRenewal.reason, "activation-lease-renewal-binding-conflict");
assert.equal(stale.getStatus().authorized, false);

const expired = createMovieMentorJourneyRecoveryLiveFenceEnforcement({
  activationEvidence: BASE,
  now: () => new Date("2026-08-28T18:01:00.000Z"),
  setTimer: () => { throw new Error("expired authority must not schedule renewal"); },
  renewActivation: async () => BASE,
  assertFence: async () => ({ authorized: false, reason: "activation-lease-fenced" }),
});
expired.start();
assert.equal(expired.getStatus().authorized, false);
assert.equal(expired.getStatus().reason, "activation-lease-expired");

const boundaryEvidence = await authorizeMovieMentorJourneyRecoveryProcessActivation({
  processInstanceId: BASE.processInstanceId,
  deploymentId: BASE.deploymentId,
  basePath: BASE.basePath,
  expectedIssuer: BASE.expectedIssuer,
  expectedAudience: BASE.expectedAudience,
  authorizeActivation: async () => BASE,
});
assert.equal(boundaryEvidence.authorized, true);
assert.equal(boundaryEvidence.fencingToken, BASE.fencingToken);
assert.equal(boundaryEvidence.expiresAt, BASE.expiresAt);
assert.equal(boundaryEvidence.schemaVersion, 2);

const incompleteBoundary = await authorizeMovieMentorJourneyRecoveryProcessActivation({
  processInstanceId: BASE.processInstanceId,
  deploymentId: BASE.deploymentId,
  basePath: BASE.basePath,
  expectedIssuer: BASE.expectedIssuer,
  expectedAudience: BASE.expectedAudience,
  authorizeActivation: async () => ({
    ...BASE,
    fencingToken: "",
  }),
});
assert.equal(incompleteBoundary.authorized, false);
assert.equal(incompleteBoundary.reason, "cross-process-activation-evidence-incomplete");

const composition = Object.freeze({
  authorizeActivation: async () => BASE,
  renewActivation: async () => BASE,
  assertFence: async () => BASE,
});
const production = createMovieMentorJourneyRecoveryProductionBootActivation({
  env: { MOVIE_MENTOR_RECOVERY_DEPLOYMENT_ID: "deployment-a" },
  pid: 42,
  randomId: () => "process-token",
  getCompositionStatus: () => ({ ready: true, durable: true }),
  createComposition: () => composition,
});
assert.equal(production.ready, true);
assert.equal(typeof production.activationAuthority, "function");
assert.equal(typeof production.renewActivation, "function");
assert.equal(typeof production.assertFence, "function");
assert.equal(production.processInstanceId, "recovery-process-42-process-token");

const server = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
assert.match(server, /MovieMentorJourneyRecoveryProductionBootAssembly\.js/);
assert.doesNotMatch(server, /verifyCredential:\s*null/);
assert.doesNotMatch(server, /expectedIssuer:\s*null/);
assert.doesNotMatch(server, /expectedAudience:\s*null/);

const assembly = fs.readFileSync(new URL("../ai/MovieMentorJourneyRecoveryProductionBootAssembly.js", import.meta.url), "utf8");
assert.match(assembly, /MovieMentorJourneyRecoveryProductionBootActivation\.js/);
assert.match(assembly, /renewActivation:\s*bootActivation\?\.renewActivation/);
assert.match(assembly, /assertFence:\s*bootActivation\?\.assertFence/);
assert.match(assembly, /activationAuthority:\s*bootActivation\?\.activationAuthority/);

const bootMount = fs.readFileSync(new URL("../ai/MovieMentorJourneyRecoveryBootMountIntegration.js", import.meta.url), "utf8");
assert.match(bootMount, /liveFence\.guardRouter\(router\)/);
assert.match(bootMount, /liveFence\.start\(\)/);
assert.match(bootMount, /existing\.liveFence\.assertCurrentAuthority\(\)/);

console.log("[4G.4] mount evidence preserves fencing token + expiry");
console.log("[4G.4] production boot exposes authorize + renew + assert authority");
console.log("[4G.4] successful renewal advances expiry without changing fencing identity");
console.log("[4G.4] request-time assertFence gates every live recovery request");
console.log("[4G.4] takeover / stale fence closes route before recovery router executes");
console.log("[4G.4] renewal uncertainty closes route; uncertainty never preserves exposure authority");
console.log("[4G.4] expired lease cannot schedule itself back into authority");
console.log("[4G.4] physical Express mount survives only as inert middleware after authority loss");
console.log("[4G.4] final production assembly preserves the certified authorize + renew + assert lifecycle powers");
console.log("🐔 Zorg: 'But app.use still remembers me.'");
console.log("🏏💥 MONGO REMEMBERS YOUR FENCE EXPIRED, ZORG.");
console.log("[4G.4] PASS");
