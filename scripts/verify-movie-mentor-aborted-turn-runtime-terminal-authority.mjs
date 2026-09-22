import assert from "node:assert/strict";
import fs from "node:fs";
import { runMovieMentorTurn } from "../ai/MovieMentorTurnRuntime.js";

console.log("Movie Mentor aborted-turn runtime terminal authority court");

let reserveCalls=0, sourceReads=0, orchestrationCalls=0, providerClaims=0;
const existing=Object.freeze({
  found:true,authorized:true,executionAuthorized:false,
  phase:"aborted",executionId:"execution-aborted",creatorTurnId:"turn-aborted",
  principalId:"creator-aborted",projectId:"project-aborted",reservationId:"reservation-aborted",
  requestDigest:"ignored-by-fixture",abortReason:"unclaimed-reservation-released"
});
const noop=async()=>{throw new Error("terminal aborted turn must stop before this capability");};
const executionAuthority={
  async findExecutionByCreatorTurn({creatorTurnId,principalId,projectId}={}){
    assert.equal(creatorTurnId,"turn-aborted");assert.equal(principalId,"creator-aborted");assert.equal(projectId,"project-aborted");
    return existing;
  },
  openExecution:noop,acquireExecution:noop,assertFence:noop,
  async claimProviderCall(){providerClaims+=1;throw new Error("provider claim must be unreachable");},
  beginProviderDispatch:noop,assertProviderDispatch:noop,contributeProviderEffectEvidence:noop,
  beginExecutionClosing:noop,reconcileExecutionClosure:noop,stageResultCandidate:noop,readResultCandidate:noop,
  commitCanonicalResult:noop,readCanonicalResult:noop
};
const spendAuthority={
  async reserveTurn(){reserveCalls+=1;throw new Error("aborted stable turn must not reserve again");},
  readReservation:noop
};
const settlementAuthority={reconcile:noop,releaseUnclaimed:noop,releaseUnbound:noop,compensateSupersededCreatorState:noop};

await assert.rejects(
  ()=>runMovieMentorTurn(
    {projectId:"project-aborted",creatorTurnId:"turn-aborted",message:"retry same aborted turn"},
    {
      serverAuthority:{authenticated:true,projectAuthorized:true,principalId:"creator-aborted",projectId:"project-aborted"},
      inferenceSpendAuthority:spendAuthority,inferenceExecutionAuthority:executionAuthority,inferenceSettlementAuthority:settlementAuthority,
      readAuthoritativeTurnSource:async()=>{sourceReads+=1;throw new Error("aborted turn must stop before creator-state read");},
      orchestrateTurn:async()=>{orchestrationCalls+=1;throw new Error("orchestration must be unreachable");}
    }
  ),
  error=>error?.code==="MOVIE_MENTOR_INFERENCE_EXECUTION_ABORTED"&&error?.retryable===false,
  "RED: a same-turn retry after durable zero-claim abort + release must terminate before any new spend or provider authority."
);
assert.equal(sourceReads,0);
assert.equal(reserveCalls,0);
assert.equal(orchestrationCalls,0);
assert.equal(providerClaims,0);

const runtime=fs.readFileSync(new URL("../ai/MovieMentorTurnRuntime.js",import.meta.url),"utf8");
const earlyLookup=runtime.indexOf("const earlyExisting = await inferenceExecutionAuthority.findExecutionByCreatorTurn");
const sourceRead=runtime.indexOf("const state = await readSource(identity)");
const abortedGuard=runtime.indexOf('if (s(existing.phase) === "aborted")');
assert.ok(earlyLookup>=0&&sourceRead>earlyLookup);
assert.ok(abortedGuard>=0);
assert.match(runtime,/MOVIE_MENTOR_INFERENCE_EXECUTION_ABORTED/);

console.log("GREEN: durable aborted-turn identity is observed before reservation, creator-state work, orchestration or provider authority; same-turn retry is terminal.");
console.log("LAW: ZERO-CLAIM ABORT + RELEASE ENDS THAT CREATOR TURN; RETRY REQUIRES A NEW CREATOR TURN ID BEFORE ANY NEW COMMERCIAL OR PROVIDER AUTHORITY.");
