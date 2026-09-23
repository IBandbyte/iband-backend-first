import assert from "node:assert/strict";
import fs from "node:fs";
import { applyMovieMentorCreatorStateTransition } from "../ai/MovieMentorCreatorStateTransition.js";
import {
  MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_DOMAIN,
  MOVIE_MENTOR_CREATOR_STATE_MUTATION_PROOF_DOMAIN,
  MOVIE_MENTOR_CREATOR_STATE_MUTATION_SCHEMA,
} from "../ai/MovieMentorCreatorStateMutationAuthority.js";

console.log("ROUND SEVEN — creator state sync truth provenance authority torture");

const gateway = fs.readFileSync(new URL("../movieMentorTurn.js", import.meta.url), "utf8");
assert.match(
  gateway,
  /router\.post\("\/state\/sync"[\s\S]*applyStateTransition\(authorized\.body,\{creatorStateMutationAuthority\}\)/,
  "production /state/sync must remain in the defendant graph: authenticated request body reaches the generic creator-state transition",
);

let durable = {
  projectId: "project-sync-truth-1",
  creatorSessionId: "session-sync-truth-1",
  revision: 7,
  revisionAuthorityReference: "revision:7",
  creatorStateGeneration: 4,
  creatorStateFingerprint: "creator-state:4",
  creatorAuthorityReference: "creator-authority:4",
  snapshotReference: "snapshot:7",
  creatorConfirmedContext: [],
  projectJourney: null,
  memoryContext: null,
  responseBlueprint: null,
  communicationPlan: null,
  capturedAt: "2032-01-01T00:00:00.000Z",
};

const readAuthoritativeTurnSource = async () => structuredClone(durable);
let writes = 0;
const writeAuthoritativeCreatorState = async (next, { expectedRevision } = {}) => {
  assert.equal(expectedRevision, durable.revision);
  writes += 1;
  durable = structuredClone(next);
  return structuredClone(durable);
};

const creatorStateMutationAuthority = Object.freeze({
  domain: MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_DOMAIN,
  schema: MOVIE_MENTOR_CREATOR_STATE_MUTATION_SCHEMA,
  principalId: "creator-sync-truth-1",
  projectId: durable.projectId,
  async assertCurrentMutation(target = {}) {
    return Object.freeze({
      domain: MOVIE_MENTOR_CREATOR_STATE_MUTATION_PROOF_DOMAIN,
      schema: MOVIE_MENTOR_CREATOR_STATE_MUTATION_SCHEMA,
      authorized: true,
      currentOwnershipVerified: true,
      principalId: "creator-sync-truth-1",
      projectId: durable.projectId,
      ownershipRef: "ownership:project-sync-truth-1",
      ownershipRevision: 1,
      authorizationSource: "authenticated-owner-test",
      source: target.source,
      expectedRevision: target.expectedRevision,
      revision: target.revision,
      creatorStateGeneration: target.creatorStateGeneration,
      creatorStateFingerprint: target.creatorStateFingerprint,
    });
  },
});

const injectedMentorTruth = [{
  key: "creatorDecision.story.route",
  value: "historical mentor proposal",
  authority: "creator",
  confidenceSource: "creator-confirmed",
  decisionKey: "story.route",
  decisionId: "client-forged-decision",
  decisionFingerprint: "client-forged-fingerprint",
  current: true,
}];

await assert.rejects(
  () => applyMovieMentorCreatorStateTransition(
    {
      projectId: durable.projectId,
      creatorSessionId: durable.creatorSessionId,
      source: "creator-memory",
      expectedRevision: durable.revision,
      state: { creatorConfirmedContext: injectedMentorTruth },
    },
    { readAuthoritativeTurnSource, writeAuthoritativeCreatorState, creatorStateMutationAuthority },
  ),
  (error) => error?.code === "MOVIE_MENTOR_CREATOR_STATE_TRUTH_PROVENANCE_REQUIRED",
  "authenticated /state/sync must not be able to relabel client/historical/mentor-derived material as creator-confirmed truth",
);

assert.equal(writes, 0, "unproven creator truth must fail before the irreversible creator-state write");

await assert.rejects(
  () => applyMovieMentorCreatorStateTransition(
    {
      projectId: durable.projectId,
      creatorSessionId: durable.creatorSessionId,
      source: "creator-decision",
      expectedRevision: durable.revision,
      state: { creatorConfirmedContext: injectedMentorTruth },
    },
    { readAuthoritativeTurnSource, writeAuthoritativeCreatorState, creatorStateMutationAuthority },
  ),
  (error) => error?.code === "MOVIE_MENTOR_CREATOR_STATE_TRUTH_PROVENANCE_REQUIRED",
  "authenticated /state/sync must not be able to self-assert the reserved creator-decision source and mint creator-confirmed truth",
);

assert.equal(writes, 0, "forged creator-decision source must fail before the irreversible creator-state write");
assert.equal(durable.revision, 7, "rejected truth injection must not advance creator-state revision");

console.log("LAW: CURRENT OWNERSHIP AUTHORIZES WHO MAY MUTATE. IT DOES NOT PROVE THE PROVENANCE OF WHAT IS BEING PROMOTED TO CREATOR TRUTH.");
console.log("LAW: GENERIC STATE SYNC MAY CARRY ADVISORY MEMORY, BUT CREATOR-CONFIRMED TRUTH REQUIRES ITS OWN CREATOR-ACT AUTHORITY.");
console.log("ROUND SEVEN creator state sync truth provenance authority torture: GREEN");
