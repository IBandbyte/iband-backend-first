import assert from "node:assert/strict";
import { runMovieMentorTurn } from "../ai/MovieMentorTurnRuntime.js";

const principalId="creator-release-uncertain",projectId="project-release-uncertain",creatorTurnId="turn-release-uncertain";
let findCalls=0,reserveCalls=0,openCalls=0,releaseCalls=0,acquireCalls=0,providerCalls=0;
const fail=m=>{throw new Error(m);};

await assert.rejects(
 ()=>runMovieMentorTurn({projectId,creatorTurnId,message:"Continue."},{
  serverAuthority:{authenticated:true,projectAuthorized:true,principalId,projectId},
  readAuthoritativeTurnSource:async()=>({projectId,creatorSessionId:"session-1",revision:1,revisionAuthorityReference:"rev-1",creatorStateGeneration:1,creatorStateFingerprint:"fp-1",creatorAuthorityReference:"auth-1",snapshotReference:"snap-1",capturedAt:"2026-09-18T00:00:00.000Z",creatorConfirmedContext:[]}),
  readAuthoritativeRevision:async()=>({authorized:true,revision:1}),
  readAuthoritativeCreatorState:async()=>({authorized:true}),
  inferenceSpendAuthority:{
   reserveTurn:async()=>{reserveCalls+=1;return{authorized:true,status:"reserved",reservationId:"reservation-release-uncertain",principalId,projectId,creatorTurnId};},
   readReservation:async()=>fail("UNCERTAIN_RELEASE_MUST_NOT_REHYDRATE"),
  },
  inferenceSettlementAuthority:{
   releaseUnbound:async()=>{releaseCalls+=1;const e=new Error("transaction acknowledgement lost");e.code="ACK_LOST";throw e;},
   releaseUnclaimed:async()=>fail("UNCERTAIN_RELEASE_MUST_NOT_RELEASE_EXECUTION"),
   reconcile:async()=>fail("UNCERTAIN_RELEASE_MUST_NOT_SETTLE"),
  },
  inferenceExecutionAuthority:{
   findExecutionByCreatorTurn:async()=>{findCalls+=1;return{found:false,authorized:false};},
   openExecution:async()=>{openCalls+=1;const e=new Error("concurrent execution identity conflict");e.code="MOVIE_MENTOR_INFERENCE_EXECUTION_TURN_IDENTITY_CONFLICT";throw e;},
   acquireExecution:async()=>{acquireCalls+=1;return fail("UNCERTAIN_RELEASE_MUST_NOT_ACQUIRE");},
   readCanonicalResult:async()=>fail("UNCERTAIN_RELEASE_MUST_NOT_REPLAY"),
   assertFence:async()=>fail("NO_FENCE"),claimProviderCall:async()=>{providerCalls+=1;return fail("NO_PROVIDER");},
   beginProviderDispatch:async()=>fail("NO_DISPATCH"),assertProviderDispatch:async()=>fail("NO_DISPATCH"),
   contributeProviderEffectEvidence:async()=>fail("NO_EFFECT"),stageResultCandidate:async()=>fail("NO_STAGE"),
   readResultCandidate:async()=>null,beginExecutionClosing:async()=>fail("NO_CLOSE"),
   reconcileExecutionClosure:async()=>fail("NO_CLOSE"),commitCanonicalResult:async()=>fail("NO_COMMIT"),
  },
  orchestrateTurn:async()=>{providerCalls+=1;return fail("NO_ORCHESTRATION");},
 }),
 e=>e?.code==="MOVIE_MENTOR_INFERENCE_UNBOUND_RELEASE_RECONCILIATION_UNCERTAIN"
   && e?.reservationId==="reservation-release-uncertain"
   && e?.retryable===true
   && e?.cause?.code==="ACK_LOST"
   && e?.originalCause?.code==="MOVIE_MENTOR_INFERENCE_EXECUTION_TURN_IDENTITY_CONFLICT",
 "uncertain atomic loser release must preserve both release uncertainty and original turn conflict while stopping recovery",
);
assert.equal(findCalls,2,"no post-conflict winner lookup may occur after uncertain loser release");
assert.equal(reserveCalls,1);assert.equal(openCalls,1);assert.equal(releaseCalls,1);
assert.equal(acquireCalls,0);assert.equal(providerCalls,0);
console.log("PASS: turn-conflict recovery stops on uncertain loser-release durability; it cannot borrow a concurrent winner while the losing reservation's durable release state is unknown.");
