import assert from "node:assert/strict";
import {createMovieMentorTurnRouter} from "../movieMentorTurn.js";
import {buildCreatorDecisionCandidate} from "../ai/MovieMentorCreatorDecisionAuthority.js";

// Behavioural HTTP-handler court with injected authorities. No network or Mongo.
const projectId="strict-http-court",principalId="strict-owner";
const requestAuthority={authorize:async()=>({authorized:true,projectId,principalId,ownershipRef:"strict-ref",ownershipRevision:1})};
const spend={reserveTurn:async()=>({}),readReservation:async()=>({})};
const execution=Object.fromEntries(["findExecutionByCreatorTurn","openExecution","acquireExecution","assertFence","claimProviderCall","beginProviderDispatch","assertProviderDispatch","contributeProviderEffectEvidence","stageResultCandidate","readResultCandidate","beginExecutionClosing","reconcileExecutionClosure","assertCurrentExecutionClosure","commitCanonicalResult","readCanonicalResult"].map(key=>[key,async()=>({})]));
const settlement={reconcile:async()=>({}),releaseUnclaimed:async()=>({}),releaseUnbound:async()=>({})};
let syncDeps,turnDeps,decisionDeps;
const router=createMovieMentorTurnRouter({
 atomicCreatorStateReadiness:async()=>async()=>({kind:"accepted"}),
 requestAuthority,inferenceSpendAuthority:spend,inferenceExecutionAuthority:execution,inferenceSettlementAuthority:settlement,
 applyStateTransition:async(_input,deps)=>{syncDeps=deps;return{revision:1};},
 runTurn:async(_input,deps)=>{
  turnDeps=deps;
  const built=buildCreatorDecisionCandidate({creatorMessage:"Blue dragon",creatorTurnId:"strict-turn",projectId,semanticIntelligence:{understoodContext:[{key:"dragon-colour",value:"blue",confidenceSource:"creator-explicit"}]}});
  assert.equal(built.status,"candidate");
  await deps.commitCreatorDecision({candidate:built.candidate,expectedRevision:1,projectId,creatorTurnId:"strict-turn"},{
   applyMovieMentorCreatorStateTransition:async(_input,innerDeps)=>{decisionDeps=innerDeps;throw Error("strict-probe");},
   readAuthoritativeTurnSource:async()=>({projectId,revision:1,creatorConfirmedContext:[]})
  }).catch(e=>assert.equal(e.message,"strict-probe"));
  return{success:true};
 }
});
const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
const request=body=>({body:{projectId,...body},headers:{authorization:"Bearer isolated-test"}});
const handler=path=>router.stack.find(x=>x.route?.path===path).route.stack[0].handle;
await handler("/state/sync")(request({operationId:"strict-sync",expectedRevision:0,state:{memoryContext:{}}}),response());
await handler("/turn")(request({creatorTurnId:"strict-turn",input:{message:"hello"}}),response());
console.log("DIAGNOSTIC strict dependency stages",JSON.stringify({sync:{strict:syncDeps?.requireAtomicCreatorStateOperation,principal:syncDeps?.principalId,adapter:typeof syncDeps?.atomicAcceptCreatorStateOperation},turn:{strict:turnDeps?.requireAtomicCreatorStateOperation,principal:turnDeps?.principalId,adapter:typeof turnDeps?.atomicAcceptCreatorStateOperation},decision:{strict:decisionDeps?.requireAtomicCreatorStateOperation,principal:decisionDeps?.principalId,adapter:typeof decisionDeps?.atomicAcceptCreatorStateOperation}}));
for(const [label,deps] of [["sync",syncDeps],["turn",turnDeps],["decision",decisionDeps]]){
 assert.equal(deps?.requireAtomicCreatorStateOperation,true,label+" must preserve strict mutation requirement");
 assert.equal(deps?.principalId,principalId,label+" must preserve authenticated principal");
 assert.equal(typeof deps?.atomicAcceptCreatorStateOperation,"function",label+" must preserve atomic adapter");
}
console.log("GREEN: HTTP sync, turn runtime, and creator decision preserve strict atomic mutation dependencies.");
