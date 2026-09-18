import assert from "node:assert/strict";
import { runMovieMentorTurn } from "../ai/MovieMentorTurnRuntime.js";

const principalId="creator-lease-denial",projectId="project-lease-denial",creatorTurnId="turn-lease-denial",executionId="execution-live-other-owner",reservationId="reservation-live";
let findCalls=0,reserveCalls=0,readReservationCalls=0,acquireCalls=0,providerCalls=0;
const fail=m=>{throw new Error(m);};

await assert.rejects(
 ()=>runMovieMentorTurn({projectId,creatorTurnId,message:"Continue the same creator turn."},{
  serverAuthority:{authenticated:true,projectAuthorized:true,principalId,projectId},
  readAuthoritativeTurnSource:async()=>({projectId,creatorSessionId:"session-1",revision:1,revisionAuthorityReference:"rev-1",creatorStateGeneration:1,creatorStateFingerprint:"fp-1",creatorAuthorityReference:"auth-1",snapshotReference:"snap-1",capturedAt:"2026-09-18T00:00:00.000Z",creatorConfirmedContext:[]}),
  readAuthoritativeRevision:async()=>({authorized:true,revision:1}),
  readAuthoritativeCreatorState:async()=>({authorized:true}),
  inferenceSpendAuthority:{
   reserveTurn:async()=>{reserveCalls+=1;return fail("EXISTING_TURN_MUST_NOT_RESERVE_AGAIN");},
   readReservation:async({reservationId:id})=>{readReservationCalls+=1;assert.equal(id,reservationId);return{authorized:true,status:"reserved",reservationId:id,principalId,projectId};},
  },
  inferenceSettlementAuthority:{releaseUnbound:async()=>fail("NO_RELEASE"),releaseUnclaimed:async()=>fail("NO_RELEASE"),reconcile:async()=>fail("NO_SETTLE")},
  inferenceExecutionAuthority:{
   findExecutionByCreatorTurn:async({requestDigest})=>{findCalls+=1;assert.ok(requestDigest);return{found:true,authorized:true,executionAuthorized:true,phase:"active",executionId,reservationId,principalId,projectId,creatorTurnId,requestDigest};},
   acquireExecution:async({executionId:id})=>{acquireCalls+=1;assert.equal(id,executionId);return{authorized:false,executionAuthorized:false,reason:"execution-lease-held-by-another-owner",executionId:id};},
   openExecution:async()=>fail("EXISTING_TURN_MUST_NOT_OPEN"),
   readCanonicalResult:async()=>null,assertFence:async()=>fail("DENIED_LEASE_MUST_NOT_FENCE"),
   claimProviderCall:async()=>{providerCalls+=1;return fail("DENIED_LEASE_MUST_NOT_PROVIDER");},
   beginProviderDispatch:async()=>fail("NO_DISPATCH"),assertProviderDispatch:async()=>fail("NO_DISPATCH"),
   contributeProviderEffectEvidence:async()=>fail("NO_EFFECT"),stageResultCandidate:async()=>fail("NO_STAGE"),
   readResultCandidate:async()=>null,beginExecutionClosing:async()=>fail("NO_CLOSE"),
   reconcileExecutionClosure:async()=>fail("NO_CLOSE"),commitCanonicalResult:async()=>fail("NO_COMMIT"),
  },
  createExecutionOwnerId:()=>"worker-retry",
  orchestrateTurn:async()=>{providerCalls+=1;return fail("DENIED_LEASE_MUST_NOT_ORCHESTRATE");},
 }),
 e=>e?.code==="MOVIE_MENTOR_INFERENCE_EXECUTION_LEASE_NOT_AUTHORIZED"
   && e?.executionId===executionId
   && e?.reason==="execution-lease-held-by-another-owner"
   && e?.retryable===true,
 "an active same-turn execution whose current lease belongs elsewhere must lend zero provider authority",
);
assert.equal(findCalls,2,"runtime performs the legitimate early same-project convergence lookup and the post-state authoritative lookup");assert.equal(reserveCalls,0);assert.equal(readReservationCalls,1);assert.equal(acquireCalls,1);assert.equal(providerCalls,0);
console.log("PASS: existing active creator-turn history plus live reserved spend does not authorize provider work when current execution lease acquisition is denied.");
