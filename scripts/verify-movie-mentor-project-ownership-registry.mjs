import assert from "node:assert/strict";
import {
  createMovieMentorProjectOwnershipAuthority,
  inspectMovieMentorProjectOwnership,
} from "../ai/MovieMentorProjectOwnershipRegistry.js";

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function createMemoryStore() {
  const records = new Map();
  let createBarrier = null;
  return {
    async readOwnership({ projectId } = {}) { return records.has(projectId) ? clone(records.get(projectId)) : null; },
    async createOwnership(record = {}) {
      if (createBarrier) await createBarrier();
      if (records.has(record.projectId)) {
        const error = new Error("exists");
        error.code = "MOVIE_MENTOR_PROJECT_OWNERSHIP_ALREADY_EXISTS";
        throw error;
      }
      const durable = {
        domain: "iband.movie-mentor.project-ownership",
        schema: 1,
        projectId: record.projectId,
        ownerPrincipalId: record.ownerPrincipalId,
        ownershipRevision: 1,
        ownershipReference: record.ownershipReference,
        establishmentAuthorityId: record.establishmentAuthorityId,
        establishmentSource: record.establishmentSource,
        status: "active",
        establishedAt: record.establishedAt,
        updatedAt: record.establishedAt,
      };
      records.set(record.projectId, durable);
      return clone(durable);
    },
    setCreateBarrier(fn) { createBarrier = fn; },
    records,
  };
}
function principal(id, authenticated = true) { return { principalId: id, authenticated }; }
function nativeAuthority(projectId, principalId, authorityId) {
  return { verified: true, type: "native-project-creation", projectId, principalId, authorityId };
}

const store = createMemoryStore();
const authority = createMovieMentorProjectOwnershipAuthority({
  readOwnership: store.readOwnership,
  createOwnership: store.createOwnership,
  now: () => "2026-08-27T21:10:00.000Z",
});

const first = await authority.establishNativeOwnership({
  principal: principal("principal-A"),
  projectId: "project-native-A",
  establishmentAuthority: nativeAuthority("project-native-A", "principal-A", "creation-A"),
});
assert.equal(first.status, "established");
assert.equal(first.ownership.ownerPrincipalId, "principal-A");
assert.equal(first.ownership.ownershipRevision, 1);
assert.equal(inspectMovieMentorProjectOwnership(first.ownership).valid, true);

const retry = await authority.establishNativeOwnership({
  principal: principal("principal-A"),
  projectId: "project-native-A",
  establishmentAuthority: nativeAuthority("project-native-A", "principal-A", "creation-A"),
});
assert.equal(retry.status, "already-established");
assert.equal(retry.ownership.ownershipRevision, 1, "exact replay must not increment ownership revision");

await assert.rejects(
  authority.establishNativeOwnership({
    principal: principal("principal-B"),
    projectId: "project-native-A",
    establishmentAuthority: nativeAuthority("project-native-A", "principal-B", "creation-B"),
  }),
  (error) => error?.code === "MOVIE_MENTOR_PROJECT_OWNERSHIP_HIJACK_REJECTED"
);

await assert.rejects(
  authority.establishNativeOwnership({
    principal: principal("principal-A"),
    projectId: "project-native-A",
    establishmentAuthority: nativeAuthority("project-native-A", "principal-A", "creation-other"),
  }),
  (error) => error?.code === "MOVIE_MENTOR_PROJECT_OWNERSHIP_ESTABLISHMENT_REPLAY_CONFLICT"
);

await assert.rejects(
  authority.establishNativeOwnership({ principal: principal("principal-A"), projectId: "project-no-proof" }),
  (error) => error?.code === "MOVIE_MENTOR_PROJECT_OWNERSHIP_ESTABLISHMENT_AUTHORITY_REQUIRED"
);
await assert.rejects(
  authority.establishNativeOwnership({
    principal: principal("principal-A", false),
    projectId: "project-no-auth",
    establishmentAuthority: nativeAuthority("project-no-auth", "principal-A", "creation-no-auth"),
  }),
  (error) => error?.code === "MOVIE_MENTOR_PROJECT_OWNERSHIP_AUTHENTICATION_REQUIRED"
);
await assert.rejects(
  authority.establishNativeOwnership({
    principal: principal("principal-A"),
    projectId: "project-conflict",
    establishmentAuthority: nativeAuthority("some-other-project", "principal-A", "creation-conflict"),
  }),
  (error) => error?.code === "MOVIE_MENTOR_PROJECT_OWNERSHIP_ESTABLISHMENT_CONFLICT"
);

const ownerAuth = await authority.authorizeProject({ principal: principal("principal-A"), projectId: "project-native-A" });
assert.equal(ownerAuth.authorized, true);
assert.equal(ownerAuth.ownershipRevision, 1);
assert.equal(ownerAuth.authorizationSource, "movie-mentor-project-ownership-registry");
const intruderAuth = await authority.authorizeProject({ principal: principal("principal-B"), projectId: "project-native-A" });
assert.equal(intruderAuth.authorized, false);
assert.equal(intruderAuth.reason, "principal-not-owner");
const missingAuth = await authority.authorizeProject({ principal: principal("principal-A"), projectId: "project-legacy-unowned" });
assert.equal(missingAuth.authorized, false);
assert.equal(missingAuth.reason, "ownership-not-established", "legacy/unowned projects must not be first-claimer adopted by native path");

// Concurrent first-establishment race: create is held until both contenders have read absence.
const raceStore = createMemoryStore();
let arrivals = 0;
let release;
const gate = new Promise((resolve) => { release = resolve; });
raceStore.setCreateBarrier(async () => { arrivals += 1; if (arrivals === 2) release(); await gate; });
const raceAuthority = createMovieMentorProjectOwnershipAuthority({
  readOwnership: raceStore.readOwnership,
  createOwnership: raceStore.createOwnership,
  now: () => "2026-08-27T21:11:00.000Z",
});
const raceA = raceAuthority.establishNativeOwnership({
  principal: principal("principal-race-A"),
  projectId: "project-race",
  establishmentAuthority: nativeAuthority("project-race", "principal-race-A", "creation-race-A"),
});
const raceB = raceAuthority.establishNativeOwnership({
  principal: principal("principal-race-B"),
  projectId: "project-race",
  establishmentAuthority: nativeAuthority("project-race", "principal-race-B", "creation-race-B"),
});
const settled = await Promise.allSettled([raceA, raceB]);
assert.equal(settled.filter((entry) => entry.status === "fulfilled").length, 1, "exactly one principal may win native ownership creation");
assert.equal(settled.filter((entry) => entry.status === "rejected" && entry.reason?.code === "MOVIE_MENTOR_PROJECT_OWNERSHIP_HIJACK_REJECTED").length, 1);
const durableRace = await raceStore.readOwnership({ projectId: "project-race" });
assert.ok(["principal-race-A", "principal-race-B"].includes(durableRace.ownerPrincipalId));
assert.equal(durableRace.ownershipRevision, 1);

assert.equal(typeof authority.transferOwnership, "undefined", "ownership transfer must not exist in the native registry door");
assert.equal(typeof authority.claimLegacyOwnership, "undefined", "legacy adoption must remain a separate explicit protocol");

console.log("Movie Mentor project ownership registry verification passed.");
console.log("- native ownership is create-once and server-revisioned");
console.log("- exact establishment retry is idempotent without revision movement");
console.log("- different-principal and different-authority replays cannot hijack ownership");
console.log("- bare projectId, client claim and unauthenticated principal cannot establish ownership");
console.log("- concurrent first-establishment race yields exactly one durable owner");
console.log("- authorization resolves only from durable ownership registry");
console.log("- legacy adoption and ownership transfer remain unavailable by construction");
