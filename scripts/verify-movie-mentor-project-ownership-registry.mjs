import assert from "node:assert/strict";
import {
  createMovieMentorProjectOwnershipAuthority,
  inspectMovieMentorProjectOwnership,
} from "../ai/MovieMentorProjectOwnershipRegistry.js";

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function createMemoryStore() {
  const records = new Map();
  const authorityIds = new Set();
  let createBarrier = null;
  let throwAfterCommit = false;
  return {
    async readOwnership({ projectId } = {}) { return records.has(projectId) ? clone(records.get(projectId)) : null; },
    async createOwnership(record = {}) {
      if (createBarrier) await createBarrier();
      if (records.has(record.projectId) || authorityIds.has(record.establishmentAuthorityId)) {
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
      authorityIds.add(record.establishmentAuthorityId);
      if (throwAfterCommit) {
        throwAfterCommit = false;
        const error = new Error("simulated acknowledgement loss after durable ownership commit");
        error.code = "SIMULATED_OWNERSHIP_ACK_LOSS";
        throw error;
      }
      return clone(durable);
    },
    setCreateBarrier(fn) { createBarrier = fn; },
    loseNextAck() { throwAfterCommit = true; },
    records,
  };
}
function principal(id, authenticated = true) { return { principalId: id, authenticated }; }
function nativeAuthority(projectId, principalId, authorityId) {
  return { verified: true, type: "native-project-creation", projectId, principalId, authorityId };
}
function legacyAttestation(projectId, principalId, adoptionId) {
  return {
    certified: true,
    domain: "iband.movie-mentor.legacy-ownership-adoption-attestation",
    schema: 1,
    projectId,
    principalId,
    adoptionId,
    projectIdentity: {
      domain: "iband.movie-mentor.project",
      schema: 0,
      issuance: "legacy-preserved",
    },
  };
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
assert.equal(retry.ownership.ownershipRevision, 1);

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

const ownerAuth = await authority.authorizeProject({ principal: principal("principal-A"), projectId: "project-native-A" });
assert.equal(ownerAuth.authorized, true);
const intruderAuth = await authority.authorizeProject({ principal: principal("principal-B"), projectId: "project-native-A" });
assert.equal(intruderAuth.authorized, false);
assert.equal(intruderAuth.reason, "principal-not-owner");
const missingAuth = await authority.authorizeProject({ principal: principal("principal-A"), projectId: "project-legacy-unowned" });
assert.equal(missingAuth.authorized, false);
assert.equal(missingAuth.reason, "ownership-not-established");

await assert.rejects(
  authority.adoptLegacyOwnership({ principal: principal("principal-L"), projectId: "project-legacy-L" }),
  (error) => error?.code === "MOVIE_MENTOR_PROJECT_OWNERSHIP_LEGACY_ATTESTATION_REQUIRED"
);
const adopted = await authority.adoptLegacyOwnership({
  principal: principal("principal-L"),
  projectId: "project-legacy-L",
  adoptionAttestation: legacyAttestation("project-legacy-L", "principal-L", "adoption-L"),
});
assert.equal(adopted.status, "established");
assert.equal(adopted.ownership.ownerPrincipalId, "principal-L");
assert.equal(adopted.ownership.establishmentSource, "legacy-project-adoption");
assert.equal(adopted.ownership.establishmentAuthorityId, "adoption-L");
assert.equal(adopted.ownership.ownershipRevision, 1);

const adoptedRetry = await authority.adoptLegacyOwnership({
  principal: principal("principal-L"),
  projectId: "project-legacy-L",
  adoptionAttestation: legacyAttestation("project-legacy-L", "principal-L", "adoption-L"),
});
assert.equal(adoptedRetry.status, "already-established");
assert.equal(adoptedRetry.ownership.ownershipRevision, 1);

await assert.rejects(
  authority.adoptLegacyOwnership({
    principal: principal("principal-X"),
    projectId: "project-legacy-L",
    adoptionAttestation: legacyAttestation("project-legacy-L", "principal-X", "adoption-X"),
  }),
  (error) => error?.code === "MOVIE_MENTOR_PROJECT_OWNERSHIP_HIJACK_REJECTED"
);
await assert.rejects(
  authority.adoptLegacyOwnership({
    principal: principal("principal-L"),
    projectId: "project-legacy-L",
    adoptionAttestation: legacyAttestation("project-legacy-L", "principal-L", "adoption-L-other"),
  }),
  (error) => error?.code === "MOVIE_MENTOR_PROJECT_OWNERSHIP_ESTABLISHMENT_REPLAY_CONFLICT"
);
await assert.rejects(
  authority.adoptLegacyOwnership({
    principal: principal("principal-L"),
    projectId: "project-other-L",
    adoptionAttestation: legacyAttestation("project-other-L", "principal-L", "adoption-L"),
  }),
  (error) => error?.code === "MOVIE_MENTOR_PROJECT_OWNERSHIP_AUTHORITY_REPLAY_REJECTED",
  "one-time adoption identity must not establish a second project"
);

// Lost ACK after durable legacy adoption: reread reality, never create again.
const ackStore = createMemoryStore();
const ackAuthority = createMovieMentorProjectOwnershipAuthority({
  readOwnership: ackStore.readOwnership,
  createOwnership: ackStore.createOwnership,
  now: () => "2026-08-27T21:10:30.000Z",
});
ackStore.loseNextAck();
const ackAdoption = await ackAuthority.adoptLegacyOwnership({
  principal: principal("principal-ack"),
  projectId: "project-legacy-ack",
  adoptionAttestation: legacyAttestation("project-legacy-ack", "principal-ack", "adoption-ack"),
});
assert.equal(ackAdoption.status, "established-after-ack-loss");
assert.equal(ackAdoption.ownership.ownerPrincipalId, "principal-ack");
assert.equal(ackAdoption.ownership.establishmentAuthorityId, "adoption-ack");
assert.equal(ackAdoption.ownership.ownershipRevision, 1);
assert.equal(ackStore.records.size, 1, "lost ACK must not cause a second ownership creation");
const ackRetry = await ackAuthority.adoptLegacyOwnership({
  principal: principal("principal-ack"),
  projectId: "project-legacy-ack",
  adoptionAttestation: legacyAttestation("project-legacy-ack", "principal-ack", "adoption-ack"),
});
assert.equal(ackRetry.status, "already-established");
assert.equal(ackRetry.ownership.ownershipRevision, 1);

// Concurrent native first-establishment race: one durable winner only.
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
assert.equal(settled.filter((entry) => entry.status === "fulfilled").length, 1);
assert.equal(settled.filter((entry) => entry.status === "rejected" && entry.reason?.code === "MOVIE_MENTOR_PROJECT_OWNERSHIP_HIJACK_REJECTED").length, 1);

// Two independently certified legacy attestations racing for one project: one owner only.
const legacyRaceStore = createMemoryStore();
let legacyArrivals = 0;
let legacyRelease;
const legacyGate = new Promise((resolve) => { legacyRelease = resolve; });
legacyRaceStore.setCreateBarrier(async () => { legacyArrivals += 1; if (legacyArrivals === 2) legacyRelease(); await legacyGate; });
const legacyRaceAuthority = createMovieMentorProjectOwnershipAuthority({
  readOwnership: legacyRaceStore.readOwnership,
  createOwnership: legacyRaceStore.createOwnership,
  now: () => "2026-08-27T21:11:30.000Z",
});
const legacyRaceA = legacyRaceAuthority.adoptLegacyOwnership({
  principal: principal("principal-legacy-race-A"),
  projectId: "project-legacy-race",
  adoptionAttestation: legacyAttestation("project-legacy-race", "principal-legacy-race-A", "adoption-race-A"),
});
const legacyRaceB = legacyRaceAuthority.adoptLegacyOwnership({
  principal: principal("principal-legacy-race-B"),
  projectId: "project-legacy-race",
  adoptionAttestation: legacyAttestation("project-legacy-race", "principal-legacy-race-B", "adoption-race-B"),
});
const legacySettled = await Promise.allSettled([legacyRaceA, legacyRaceB]);
assert.equal(legacySettled.filter((entry) => entry.status === "fulfilled").length, 1);
assert.equal(legacySettled.filter((entry) => entry.status === "rejected" && entry.reason?.code === "MOVIE_MENTOR_PROJECT_OWNERSHIP_HIJACK_REJECTED").length, 1);
assert.equal(legacyRaceStore.records.size, 1);
const durableLegacyRace = legacyRaceStore.records.get("project-legacy-race");
assert.equal(durableLegacyRace.ownershipRevision, 1);
assert.ok(["principal-legacy-race-A", "principal-legacy-race-B"].includes(durableLegacyRace.ownerPrincipalId));

assert.equal(typeof authority.transferOwnership, "undefined", "ownership transfer must remain unavailable");
assert.equal(typeof authority.claimLegacyOwnership, "undefined", "generic first-claimer legacy ownership must never exist");
assert.equal(typeof authority.adoptLegacyOwnership, "function", "certified legacy adoption must be explicit and quarantined");

console.log("Movie Mentor project ownership registry verification passed.");
console.log("- native ownership remains create-once and server-revisioned");
console.log("- certified legacy adoption establishes exactly one immutable owner");
console.log("- exact adoption retry is idempotent and one-time adoption authority cannot cross projects");
console.log("- lost ACK reconciles from durable ownership reality without a second create");
console.log("- concurrent certified legacy attestations produce exactly one durable owner");
console.log("- different-principal and different-attestation replays cannot hijack ownership");
console.log("- generic claim and ownership transfer remain unavailable");
