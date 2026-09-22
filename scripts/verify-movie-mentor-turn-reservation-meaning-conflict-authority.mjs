import assert from "node:assert/strict";
import { runMovieMentorTurn } from "../ai/MovieMentorTurnRuntime.js";

console.log("Movie Mentor same-turn changed-meaning reservation conflict court");

const creatorTurnId="turn-309", principalId="creator-309", projectId="project-309", reservationId="reservation-309";
let releaseCalls=0, released=0, reads=0, reserves=0, orchestration=0;
const serverAuthority={authenticated:true,projectAuthorized:true,principalId,projectId};
const spend={
  async reserveTurn({creatorTurnId:turn}){reserves+=1;assert.equal(turn,creatorTurnId);return{authorized:true,reservationId,principalId,projectId,operation:"movie-mentor-turn",units:1,status:"reserved"};},
  async readReservation(){throw new Error("changed-meaning conflict must not rehydrate execution reservation");}
};
const execution={
  async findExecutionByCreatorTurn({requestDigest}) {
    // Early and post-state lookup are deliberately modeled as not-found for the changed digest.
    return {found:false,authorized:false,requestDigest};
  },
  async openExecution(){const e=new Error("same stable Creator turn is already durably bound to different request meaning");e.code="MOVIE_MENTOR_INFERENCE_EXECUTION_TURN_IDENTITY_CONFLICT";throw e;},
  async acquireExecution(){throw new Error("conflicting turn must not acquire");},
  async assertFence(){throw new Error("conflicting turn must not fence");},
  async claimProviderCall(){throw new Error("conflicting turn must not claim provider");},
  async beginProviderDispatch(){throw new Error("conflicting turn must not dispatch");},
  async assertProviderDispatch(){throw new Error("conflicting turn must not dispatch");},
  async contributeProviderEffectEvidence(){throw new Error("conflicting turn must not write provider evidence");},
  async stageResultCandidate(){throw new Error("conflicting turn must not stage candidate");},
  async readResultCandidate(){return null;},
  async beginExecutionClosing(){throw new Error("conflicting turn must not close");},
  async reconcileExecutionClosure(){throw new Error("conflicting turn must not reconcile closure");},
  async assertCurrentExecutionClosure(){throw new Error("conflicting turn must not assert closure");},
  async commitCanonicalResult(){throw new Error("conflicting turn must not commit result");},
  async readCanonicalResult(){return{authorized:false,committed:false};}
};
const settlement={
  async reconcile(){throw new Error("conflicting turn must not settle");},
  async releaseUnclaimed(){throw new Error("conflicting turn must not release execution");},
  async releaseUnbound(){releaseCalls+=1;return{authorized:false,released:false,outcome:"reserved",reason:"reservation-already-bound-to-execution",reservationId,executionId:"execution-existing"};},
  async compensateSupersededCreatorState(){throw new Error("conflicting turn must not compensate");}
};
const state={projectId,revision:1,creatorStateGeneration:1,creatorStateFingerprint:"state-309",creatorConfirmedContext:[],memoryContext:{projectMemories:[]},projectJourney:{activeProjectId:projectId}};
await assert.rejects(
  ()=>runMovieMentorTurn({projectId,creatorTurnId,message:"changed meaning"},{
    serverAuthority,
    inferenceSpendAuthority:spend,
    inferenceExecutionAuthority:execution,
    inferenceSettlementAuthority:settlement,
    createExecutionOwnerId:()=>"owner-309",
    readAuthoritativeTurnSource:async()=>{reads+=1;return structuredClone(state);},
    readAuthoritativeRevision:async()=>({revision:1}),
    readAuthoritativeCreatorState:async()=>({generation:1,fingerprint:"state-309"}),
    orchestrateTurn:async()=>{orchestration+=1;throw new Error("must not orchestrate");}
  }),
  e=>e?.code==="MOVIE_MENTOR_INFERENCE_EXECUTION_BINDING_UNRESOLVED"&&e?.reason==="reservation-already-bound-to-execution"
);
assert.equal(reserves,1);
assert.equal(orchestration,0);
assert.equal(releaseCalls,1,"The conflict path must ask the atomic durable release authority rather than trust process-local binding belief.");
assert.equal(released,0,"A reservation already bound to the durable execution must remain reserved.");
console.log("GREEN: changed meaning under the same stable Creator turn is reconciled against durable binding reality and cannot restore bound commercial authority.");
console.log("LAW: STABLE TURN IDENTITY MAY REJECT CHANGED MEANING; RELEASE AUTHORITY MUST SERIALIZE AGAINST DURABLE EXECUTION BINDING, AND BOUND COMMERCIAL AUTHORITY MAY NOT BE RESTORED.");
