import assert from "node:assert/strict";
import fs from "node:fs";
import { createMovieMentorInferenceSpendAuthority } from "../ai/MovieMentorInferenceSpendAuthority.js";
import { createMovieMentorProductionInferenceSpendComposition } from "../ai/MovieMentorProductionInferenceSpendComposition.js";

function reservation(request, revision = 2) { return { ...request, entitlementRevision: revision, status: "reserved", reservedAt: new Date().toISOString() }; }
async function rejectsCode(fn, code) { await assert.rejects(fn, (error) => error?.code === code); }

const binding = Object.freeze({ authenticated: true, projectAuthorized: true, principalId: "creator-1", projectId: "project-1" });

{
  const authority = createMovieMentorInferenceSpendAuthority({ store: { reserve: async (request) => ({ granted: true, reservation: reservation(request) }) }, createReservationId: () => "reservation-1" });
  const result = await authority.reserveTurn({ serverAuthority: binding, projectId: "project-1" });
  assert.equal(result.authorized, true);
  assert.equal(result.reservationId, "reservation-1");
  assert.equal(result.operation, "movie-mentor-turn");
}

{
  const authority = createMovieMentorInferenceSpendAuthority({ store: { reserve: async () => ({ granted: false, reason: "empty" }) } });
  await rejectsCode(() => authority.reserveTurn({ serverAuthority: binding, projectId: "project-1" }), "MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_DENIED");
}

{
  const authority = createMovieMentorInferenceSpendAuthority({ store: { reserve: async () => { throw Object.assign(new Error("down"), { code: "MOVIE_MENTOR_INFERENCE_SPEND_AUTHORITY_UNAVAILABLE" }); } } });
  await rejectsCode(() => authority.reserveTurn({ serverAuthority: binding, projectId: "project-1" }), "MOVIE_MENTOR_INFERENCE_SPEND_AUTHORITY_UNAVAILABLE");
}

{
  const authority = createMovieMentorInferenceSpendAuthority({ store: { reserve: async (request) => ({ granted: true, reservation: reservation({ ...request, projectId: "project-evil" }) }) } });
  await rejectsCode(() => authority.reserveTurn({ serverAuthority: binding, projectId: "project-1" }), "MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_INVALID");
}

{
  const authority = createMovieMentorInferenceSpendAuthority({ store: { reserve: async (request) => ({ granted: true, reservation: reservation(request) }) } });
  await rejectsCode(() => authority.reserveTurn({ serverAuthority: { ...binding, principalId: "" }, projectId: "project-1" }), "MOVIE_MENTOR_INFERENCE_SPEND_PRINCIPAL_REQUIRED");
  await rejectsCode(() => authority.reserveTurn({ serverAuthority: binding, projectId: "project-2" }), "MOVIE_MENTOR_INFERENCE_SPEND_PROJECT_CONFLICT");
  await rejectsCode(() => authority.reserveTurn({ serverAuthority: { ...binding, authenticated: false }, projectId: "project-1" }), "MOVIE_MENTOR_INFERENCE_SPEND_AUTHORITY_REQUIRED");
}

{
  let remaining = 1;
  const atomicStore = { reserve: async (request) => { await Promise.resolve(); if (remaining < request.units) return { granted: false, reason: "empty" }; remaining -= request.units; return { granted: true, reservation: reservation(request) }; } };
  let id = 0;
  const authority = createMovieMentorInferenceSpendAuthority({ store: atomicStore, createReservationId: () => `race-${++id}` });
  const results = await Promise.allSettled([
    authority.reserveTurn({ serverAuthority: binding, projectId: "project-1" }),
    authority.reserveTurn({ serverAuthority: binding, projectId: "project-1" }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected" && result.reason?.code === "MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_DENIED").length, 1);
  assert.equal(remaining, 0);
}

{
  const originalMongo = process.env.MONGO_URI;
  const originalMongoDb = process.env.MONGODB_URI;
  delete process.env.MONGO_URI; delete process.env.MONGODB_URI;
  const closed = createMovieMentorProductionInferenceSpendComposition();
  assert.equal(closed.ready, false);
  assert.equal(closed.reason, "inference-spend-store-not-configured");
  if (originalMongo === undefined) delete process.env.MONGO_URI; else process.env.MONGO_URI = originalMongo;
  if (originalMongoDb === undefined) delete process.env.MONGODB_URI; else process.env.MONGODB_URI = originalMongoDb;
}

const runtimeSource = fs.readFileSync(new URL("../ai/MovieMentorTurnRuntime.js", import.meta.url), "utf8");
const gatewaySource = fs.readFileSync(new URL("../movieMentorTurn.js", import.meta.url), "utf8");
const serverSource = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
const storeSource = fs.readFileSync(new URL("../ai/MovieMentorInferenceSpendMongoStore.js", import.meta.url), "utf8");
const envSource = fs.readFileSync(new URL("../.env.example", import.meta.url), "utf8");

const reserveIndex = runtimeSource.indexOf("spendAuthority.reserveTurn");
const orchestrateIndex = runtimeSource.indexOf("const result=await orchestrate");
assert.ok(reserveIndex >= 0 && orchestrateIndex > reserveIndex, "spend reservation must precede orchestration");
assert.match(runtimeSource, /MOVIE_MENTOR_INFERENCE_SPEND_AUTHORITY_REQUIRED/);
assert.match(runtimeSource, /serverAuthority:deps\.serverAuthority/);
assert.match(gatewaySource, /serverAuthorityFrom\(authorized\.authority\)/);
assert.doesNotMatch(gatewaySource, /serverAuthority:authorized\.body/);
assert.match(gatewaySource, /MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_DENIED/);
assert.match(gatewaySource, /return 402/);
assert.match(gatewaySource, /router\.post\("\/state\/sync"/);
assert.match(serverSource, /createMovieMentorProductionInferenceSpendComposition/);
assert.match(serverSource, /spendComposition\?\.ready !== true/);
assert.match(serverSource, /createMovieMentorTurnRouter\(\{ requestAuthority, inferenceSpendAuthority: spendComposition\.authority \}\)/);
assert.doesNotMatch(serverSource, /app\.use\("\/api\/movie-mentor-semantic"/);
assert.doesNotMatch(serverSource, /app\.use\("\/api\/movie-mentor-specialists"/);
assert.doesNotMatch(serverSource, /app\.use\("\/api\/movie-mentor-synthesis"/);
assert.doesNotMatch(serverSource, /app\.use\("\/api\/ai-mentor"/);
assert.match(serverSource, /browserOriginAuthority\.authorizeRequest/);
assert.match(storeSource, /withTransaction/);
assert.match(storeSource, /remainingUnits: \{ \$gte: normalized\.units \}/);
assert.match(storeSource, /\$inc: \{ remainingUnits: -normalized\.units, reservedUnits: normalized\.units, entitlementRevision: 1 \}/);
assert.match(storeSource, /reservationSchema\.index\(\{ reservationId: 1 \}, \{ unique: true \}\)/);
assert.match(storeSource, /processLocalFallback: false/);
assert.match(envSource, /No process-local inference-credit fallback is permitted/);

console.log("Movie Mentor 5A.5 inference spend authority torture: PASS");
