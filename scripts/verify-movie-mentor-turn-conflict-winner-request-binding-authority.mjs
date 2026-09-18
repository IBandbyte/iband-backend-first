import assert from "node:assert/strict";
import { runMovieMentorTurn } from "../ai/MovieMentorTurnRuntime.js";

const principalId="creator-request-binding", projectId="project-request-binding", creatorTurnId="turn-request-binding";
let findCalls=0,reserveCalls=0,openCalls=0,releaseCalls=0,readReservationCalls=0,acquireCalls=0,providerCalls=0;
const fail=m=>{throw new Error(m);};

const executionAuthority={
  findExecutionByCreatorTurn:async ({creatorTurnId:turn,principalId:principal,projectId:project,requestDigest}={})=>{
    findCalls+=1;
    assert.equal(turn,creatorTurnId); assert.equal(principal,principalId); assert.equal(project,projectId);
    assert.ok(requestDigest,"runtime convergence must carry the current immutable request digest");
    if(findCalls<=2)return{found:false,authorized:false};
    const e=new Error("winner belongs to a different immutable request");
    e.code="MOVIE_MENTOR_INFERENCE_EXECUTION_TURN_IDENTITY_CONFLICT";
    throw e;
  },
  openExecution:async()=>{openCalls+=1;const e=new Error("concurrent create conflict");e.code="MOVIE_MENTOR_INFERENCE_EXECUTION_TURN_IDENTITY_CONFLICT";throw e;},
  acquireExecution:async()=>{acquireCalls+=1;return fail("MISMATCHED_WINNER_MUST_NOT_BE_ACQUIRED");},
  readCanonicalResult:async()=>fail("MISMATCHED_WINNER_MUST_NOT_REPLAY"),
  assertFence:async()=>fail("MISMATCHED_WINNER_MUST_NOT_FENCE"),
  claimProviderCall:async()=>{providerCalls+=1;return fail("MISMATCHED_WINNER_MUST_NOT_REACH_PROVIDER");},
  beginProviderDispatch:async()=>fail("MISMATCHED_WINNER_MUST_NOT_DISPATCH"),
  assertProviderDispatch:async()=>fail("MISMATCHED_WINNER_MUST_NOT_DISPATCH"),
  contributeProviderEffectEvidence:async()=>fail("MISMATCHED_WINNER_MUST_NOT_EFFECT"),
  stageResultCandidate:async()=>fail("MISMATCHED_WINNER_MUST_NOT_STAGE"),
  readResultCandidate:async()=>null,beginExecutionClosing:async()=>fail("NO_CLOSE"),
  reconcileExecutionClosure:async()=>fail("NO_CLOSE"),commitCanonicalResult:async()=>fail("NO_COMMIT"),
};

await assert.rejects(
  ()=>runMovieMentorTurn(
    {projectId,creatorTurnId,message:"Current immutable creator request"},
    {
      serverAuthority:{authenticated:true,projectAuthorized:true,principalId,projectId},
      readAuthoritativeTurnSource:async()=>({projectId,creatorSessionId:"session-1",revision:1,revisionAuthorityReference:"rev-1",creatorStateGeneration:1,creatorStateFingerprint:"fp-1",creatorAuthorityReference:"auth-1",snapshotReference:"snap-1",capturedAt:"2026-09-18T00:00:00.000Z",creatorConfirmedContext:[]}),
      readAuthoritativeRevision:async()=>({authorized:true,revision:1}),
      readAuthoritativeCreatorState:async()=>({authorized:true}),
      inferenceSpendAuthority:{
        reserveTurn:async()=>{reserveCalls+=1;return{authorized:true,status:"reserved",reservationId:"reservation-loser",principalId,projectId,creatorTurnId};},
        readReservation:async()=>{readReservationCalls+=1;return fail("MISMATCHED_WINNER_MUST_NOT_REHYDRATE_SPEND");},
      },
      inferenceSettlementAuthority:{
        releaseUnbound:async({reservationId})=>{releaseCalls+=1;assert.equal(reservationId,"reservation-loser");return{authorized:true,released:true,outcome:"released",reservationId,principalId,projectId};},
        releaseUnclaimed:async()=>fail("NO_UNCLAIMED_RELEASE"),reconcile:async()=>fail("NO_SETTLEMENT"),
      },
      inferenceExecutionAuthority:executionAuthority,
      orchestrateTurn:async()=>{providerCalls+=1;return fail("MISMATCHED_WINNER_MUST_NOT_ORCHESTRATE");},
    }),
  e=>e?.code==="MOVIE_MENTOR_INFERENCE_EXECUTION_TURN_IDENTITY_CONFLICT",
  "after releasing the losing reservation, a concurrent record bound to a different request digest must preserve the identity conflict",
);

assert.equal(findCalls,3);
assert.equal(reserveCalls,1);
assert.equal(openCalls,1);
assert.equal(releaseCalls,1,"losing fresh reservation must still release exactly once");
assert.equal(readReservationCalls,0);
assert.equal(acquireCalls,0);
assert.equal(providerCalls,0);
console.log("PASS: turn-conflict recovery preserves current request-digest identity; a mismatched concurrent winner cannot lend execution, spend, replay, or provider authority.");
