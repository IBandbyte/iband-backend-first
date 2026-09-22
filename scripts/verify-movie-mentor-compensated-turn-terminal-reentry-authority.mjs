import assert from "node:assert/strict";
import { runMovieMentorTurn } from "../ai/MovieMentorTurnRuntime.js";

console.log("Movie Mentor compensated-turn terminal re-entry authority court");

const input={projectId:"project-306",creatorSessionId:"session-306",creatorTurnId:"turn-306",message:"continue"};
const serverAuthority={authenticated:true,projectAuthorized:true,principalId:"creator-306",projectId:"project-306"};
const compensated={found:true,authorized:true,executionId:"execution-306",creatorTurnId:"turn-306",principalId:"creator-306",projectId:"project-306",reservationId:"reservation-306",requestDigest:"historical-digest",phase:"compensated",providerCallsClaimed:1,providerCalls:[{providerCallId:"call-306",slotId:"semantic",task:"movie-mentor-semantic"}]};
let stateReads=0,reserves=0,acquires=0,claims=0,dispatches=0,effects=0,orchestrations=0,settlements=0,releases=0,compensations=0;
const executionAuthority={
 async findExecutionByCreatorTurn(){return compensated;},
 async openExecution(){throw new Error("COMPENSATED turn must never open a successor execution under the same creatorTurnId");},
 async acquireExecution(){acquires+=1;throw new Error("COMPENSATED turn must never reacquire execution authority");},
 async assertFence(){return compensated;},
 async claimProviderCall(){claims+=1;throw new Error("COMPENSATED turn must never claim provider work");},
 async beginProviderDispatch(){dispatches+=1;throw new Error("COMPENSATED turn must never dispatch provider work");},
 async assertProviderDispatch(){return{authorized:false,dispatchAuthorized:false};},
 async contributeProviderEffectEvidence(){effects+=1;throw new Error("COMPENSATED turn must never admit provider effect evidence");},
 async stageResultCandidate(){throw new Error("COMPENSATED turn must never stage a result");},
 async readResultCandidate(){return null;},
 async beginExecutionClosing(){throw new Error("COMPENSATED turn must never close as a result-bearing execution");},
 async reconcileExecutionClosure(){return{authorized:false,closed:false};},
 async commitCanonicalResult(){throw new Error("COMPENSATED turn must never commit canonical result");},
 async readCanonicalResult(){return{authorized:false,committed:false};},
};
const spendAuthority={
 async reserveTurn(){reserves+=1;throw new Error("COMPENSATED turn must never reserve again under the same creatorTurnId");},
 async readReservation(){throw new Error("COMPENSATED turn must not rehydrate spend for execution");},
};
const settlementAuthority={
 async reconcile(){settlements+=1;return{authorized:false,settled:false,outcome:"reserved"};},
 async releaseUnclaimed(){releases+=1;return{authorized:false,released:false,outcome:"reserved"};},
 async releaseUnbound(){releases+=1;return{authorized:false,released:false,outcome:"reserved"};},
 async compensateSupersededCreatorState(){compensations+=1;return{authorized:true,compensated:true,outcome:"creator-compensated",idempotent:true};},
};
await assert.rejects(()=>runMovieMentorTurn(input,{
 serverAuthority,inferenceSpendAuthority:spendAuthority,inferenceExecutionAuthority:executionAuthority,inferenceSettlementAuthority:settlementAuthority,
 readAuthoritativeTurnSource:async()=>{stateReads+=1;throw new Error("terminal COMPENSATED re-entry must fail before mutable Creator-state read");},
 orchestrateTurn:async()=>{orchestrations+=1;throw new Error("terminal COMPENSATED re-entry must never orchestrate");},
}),error=>error?.code==="MOVIE_MENTOR_INFERENCE_EXECUTION_COMPENSATED"&&error?.retryable===false);

assert.equal(stateReads,0,"COMPENSATED terminal authority must be recognized before mutable Creator-state read");
assert.equal(reserves,0,"COMPENSATED terminal authority must not reserve again");
assert.equal(acquires,0,"COMPENSATED terminal authority must not reacquire execution");
assert.equal(claims,0,"COMPENSATED terminal authority must not mint provider claims");
assert.equal(dispatches,0,"COMPENSATED terminal authority must not redispatch provider work");
assert.equal(effects,0,"COMPENSATED terminal authority must not admit new provider effects");
assert.equal(orchestrations,0,"COMPENSATED terminal authority must not re-enter orchestration");
assert.equal(settlements,0,"COMPENSATED terminal authority must not borrow canonical settlement");
assert.equal(releases,0,"COMPENSATED terminal authority must not borrow release authority");
assert.equal(compensations,0,"COMPENSATED terminal re-entry must not restore Creator value twice");

console.log("✓ same creatorTurnId sees durable COMPENSATED terminal authority before mutable Creator-state read");
console.log("✓ no reservation, lease, provider, orchestration, settlement, release, or second compensation authority is reminted");
console.log("LAW: COMPENSATION ENDS THAT CREATOR TURN. CURRENT WORK REQUIRES A NEW CREATOR TURN ID; HISTORICAL PROVIDER REALITY MAY SURVIVE, AUTHORITY MAY NOT.");
