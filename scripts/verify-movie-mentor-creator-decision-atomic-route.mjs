import assert from "node:assert/strict";
import {commitCreatorDecision,buildCreatorDecisionCandidate} from "../ai/MovieMentorCreatorDecisionAuthority.js";

const projectId="creator-decision-atomic-court",creatorTurnId="stable-turn-001";
const result=buildCreatorDecisionCandidate({
 creatorMessage:"Let's use a blue dragon",
 creatorTurnId,
 projectId,
 semanticIntelligence:{understoodContext:[{key:"dragon-colour",value:"blue",confidenceSource:"creator-explicit"}]},
});
assert.equal(result.status,"candidate","Fixture must produce an explicit creator decision");
const candidate=result.candidate;
let state={projectId,creatorSessionId:"court-session",revision:1,creatorStateGeneration:1,creatorConfirmedContext:[],revisionAuthorityReference:"revision-1",creatorStateFingerprint:"fingerprint-1",creatorAuthorityReference:"authority-1",snapshotReference:"snapshot-1",capturedAt:new Date().toISOString()};
let legacyWrites=0,atomicCalls=0;
const deps={
 principalId:"isolated-owner",
 creatorStateMutationAuthority:{principalId:"isolated-owner",projectId},
 readAuthoritativeTurnSource:async()=>structuredClone(state),
 writeAuthoritativeCreatorState:async()=>{legacyWrites++;throw Error("RED: legacy writer reached");},
 atomicAcceptCreatorStateOperation:async({envelope,proposedState})=>{
  atomicCalls++;
  assert.equal(envelope.operationId,creatorTurnId,"RED: operation must bind stable creator turn identity");
  assert.equal(envelope.principalId,"isolated-owner");
  assert.equal(envelope.projectId,projectId);
  assert.equal(envelope.expectedRevision,1);
  state={...proposedState};
  return {kind:"accepted",result:structuredClone(state)};
 },
};
const committed=await commitCreatorDecision({candidate,expectedRevision:1,projectId,creatorTurnId},deps);
assert.equal(committed.status,"committed");
assert.equal(legacyWrites,0,"RED: creator decision must never use legacy writer");
assert.equal(atomicCalls,1,"RED: creator decision must use transactional operation adapter");
assert.equal(committed.revision,2);
const retry=await commitCreatorDecision({candidate,expectedRevision:1,projectId,creatorTurnId},deps);
assert.equal(retry.status,"committed");
assert.equal(atomicCalls,1,"RED: duplicate creator turn must not create second operation");
assert.equal(state.revision,2);
console.log("GREEN: creator decision bound stable turn to atomic acceptance and replay without legacy writes.");
