import assert from "node:assert/strict";
import {createMovieMentorInferenceExecutionLeaseAuthority} from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";

const clone=value=>value==null?value:structuredClone(value);
const baseLegacy={
  domain:"iband.movie-mentor.inference-execution-store",
  schema:5,
  executionId:"execution-legacy-active",
  creatorTurnId:"turn-legacy-active",
  principalId:"creator-legacy-active",
  projectId:"project-legacy-active",
  reservationId:"reservation-legacy-active",
  requestDigest:"request-legacy-active",
  phase:"active",
  ownerId:"owner-legacy-active",
  leaseGeneration:4,
  leaseReference:"lease-legacy-active",
  fencingToken:"fence-legacy-active",
  leaseAcquiredAt:"2031-12-31T23:59:00.000Z",
  leaseExpiresAt:"2032-01-01T00:10:00.000Z",
  maxProviderCalls:5,
  providerCallsClaimed:1,
  providerCalls:[{
    providerCallId:"provider-call-legacy-active",
    slotId:"semantic",
    task:"movie-mentor-semantic",
    state:"admitted",
    leaseGeneration:4,
    leaseReference:"lease-legacy-active",
    fencingToken:"fence-legacy-active",
    admittedAt:"2031-12-31T23:59:30.000Z",
  }],
};

function makeStore(initial){
  let durable=clone(initial),replacements=0,claims=0;
  return {
    store:{
      readExecution:async id=>id===durable.executionId?clone(durable):null,
      readExecutionByCreatorTurn:async input=>input.creatorTurnId===durable.creatorTurnId&&input.principalId===durable.principalId&&input.projectId===durable.projectId?clone(durable):null,
      createExecution:async()=>null,
      async replaceExecution(next){replacements+=1;durable=clone(next);return clone(durable);},
      async claimProviderCall(){claims+=1;return{claimed:false,execution:clone(durable),existingProviderCall:null};},
    },
    get:()=>clone(durable),
    replacements:()=>replacements,
    claims:()=>claims,
  };
}

const liveFixture=makeStore(baseLegacy);
const authority=createMovieMentorInferenceExecutionLeaseAuthority({store:liveFixture.store,now:()=>new Date("2032-01-01T00:00:00.000Z"),randomId:()=>"court"});
const lookup={creatorTurnId:baseLegacy.creatorTurnId,principalId:baseLegacy.principalId,projectId:baseLegacy.projectId,requestDigest:baseLegacy.requestDigest};
const found=await authority.findExecutionByCreatorTurn(lookup);
assert.equal(found.found,true,"legacy active history must remain discoverable for convergence");
assert.equal(found.authorized,true,"historical record existence may remain valid observation");
assert.equal(found.schema,5,"historical schema identity must remain visible in convergence evidence");
assert.equal(found.executionAuthorized,false,"legacy ACTIVE history must not become live forward execution authority merely because its phase string is active");

const opened=await authority.openExecution({...lookup,reservationId:baseLegacy.reservationId,ownerId:baseLegacy.ownerId,maxProviderCalls:baseLegacy.maxProviderCalls});
assert.equal(opened.authorized,true,"idempotent historical lookup may return observation evidence");
assert.equal(opened.executionAuthorized,false,"openExecution must not re-mint live authority from a legacy ACTIVE execution");
assert.equal(opened.schema,5);

const acquired=await authority.acquireExecution({executionId:baseLegacy.executionId,ownerId:baseLegacy.ownerId});
assert.equal(acquired.authorized,false,"legacy ACTIVE execution must not acquire or retain a live lease");
assert.equal(acquired.reason,"execution-current-schema-required");
assert.equal(liveFixture.replacements(),0,"legacy live execution must fail before any store replacement can silently upgrade its schema");

const dispatch=await authority.assertProviderDispatch({providerCall:{authorized:true,executionId:baseLegacy.executionId,providerCallId:"provider-call-legacy-active",slotId:"semantic",leaseGeneration:4}});
assert.equal(dispatch.authorized,false,"historical provider-call evidence must not regain dispatch authority through a legacy ACTIVE execution");
assert.equal(dispatch.dispatchAuthorized,false);
assert.equal(dispatch.reason,"execution-current-schema-required");

await assert.rejects(
  ()=>authority.claimProviderCall({execution:found,slotId:"story",task:"movie-mentor-specialist:story"}),
  error=>error?.code==="MOVIE_MENTOR_INFERENCE_PROVIDER_CALL_AUTHORITY_REQUIRED",
  "legacy convergence evidence must not admit a new provider call",
);
assert.equal(liveFixture.claims(),0,"legacy execution must fail before the durable provider-call claim primitive");

const expiredFixture=makeStore({...baseLegacy,leaseExpiresAt:"2031-12-31T23:59:59.000Z"});
const expiredAuthority=createMovieMentorInferenceExecutionLeaseAuthority({store:expiredFixture.store,now:()=>new Date("2032-01-01T00:00:00.000Z"),randomId:()=>"expired-court"});
const takeover=await expiredAuthority.acquireExecution({executionId:baseLegacy.executionId,ownerId:"new-owner"});
assert.equal(takeover.authorized,false,"expired legacy execution must not be upgraded into a new current lease generation");
assert.equal(takeover.reason,"execution-current-schema-required");
assert.equal(expiredFixture.replacements(),0,"legacy takeover must fail before replaceExecution can rewrite schema 5 as schema 6");

console.log("✓ legacy ACTIVE execution remains readable history but never live execution authority");
console.log("✓ legacy history cannot be silently upgraded through lease takeover, provider-call admission, or dispatch");
console.log("LAW: HISTORICAL ACTIVE EXECUTION RECORDS MAY REMAIN READABLE. THEY MAY NOT REACQUIRE LIVE LEASE OR PROVIDER DISPATCH AUTHORITY.");
console.log("current-schema live execution authority gate: GREEN");
