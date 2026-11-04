import assert from "node:assert/strict";
import {createMovieMentorTurnRouter} from "../movieMentorTurn.js";
import {buildCreatorDecisionCandidate} from "../ai/MovieMentorCreatorDecisionAuthority.js";

const projectId="http-atomic-court",principalId="server-owner";
const requestAuthority={authorize:async({projectId:id})=>({authorized:true,projectId:id,principalId,ownershipRef:"owner-ref",ownershipRevision:1})};
const spend={reserveTurn:async()=>({}),readReservation:async()=>({})};
const execution=Object.fromEntries(["findExecutionByCreatorTurn","openExecution","acquireExecution","assertFence","claimProviderCall","beginProviderDispatch","assertProviderDispatch","contributeProviderEffectEvidence","stageResultCandidate","readResultCandidate","beginExecutionClosing","reconcileExecutionClosure","assertCurrentExecutionClosure","commitCanonicalResult","readCanonicalResult"].map(key=>[key,async()=>({})]));
const settlement={reconcile:async()=>({}),releaseUnclaimed:async()=>({}),releaseUnbound:async()=>({})};
let syncDeps=null,turnDeps=null,decisionDeps=null;
const router=createMovieMentorTurnRouter({
 atomicCreatorStateReadiness:async()=>async()=>({kind:"accepted"}),
 requestAuthority,inferenceSpendAuthority:spend,inferenceExecutionAuthority:execution,inferenceSettlementAuthority:settlement,
 applyStateTransition:async(_input,deps)=>{syncDeps=deps;return{revision:1};},
 runTurn:async(_input,deps)=>{turnDeps=deps;const built=buildCreatorDecisionCandidate({creatorMessage:"Let\'s use a blue dragon",creatorTurnId:"stable-turn",projectId,semanticIntelligence:{understoodContext:[{key:"dragon-colour",value:"blue",confidenceSource:"creator-explicit"}]}});assert.equal(built.status,"candidate");await deps.commitCreatorDecision({candidate:built.candidate,expectedRevision:1,projectId,creatorTurnId:"stable-turn"},{applyMovieMentorCreatorStateTransition:async(_input,innerDeps)=>{decisionDeps=innerDeps;throw Error("isolated-transition-probe");},readAuthoritativeTurnSource:async()=>({projectId,revision:1,creatorConfirmedContext:[]})}).catch(e=>{assert.equal(e.message,"isolated-transition-probe");});return{success:true};},
});
const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
const request=body=>({body:{projectId,...body},headers:{authorization:"Bearer isolated-credential"}});
const sync=router.stack.find(x=>x.route?.path==="/state/sync").route.stack[0].handle;
const turn=router.stack.find(x=>x.route?.path==="/turn").route.stack[0].handle;
await sync(request({operationId:"stable-sync-op",expectedRevision:0,state:{memoryContext:{}}}),response());
assert.equal(syncDeps?.creatorStateMutationAuthority?.principalId,principalId);
const failures=[];
if(syncDeps?.principalId!==principalId)failures.push("RED: /state/sync authenticated principal not forwarded");
if(typeof syncDeps?.atomicAcceptCreatorStateOperation!=="function")failures.push("RED: /state/sync atomic ledger adapter not forwarded");
await turn(request({creatorTurnId:"stable-turn",input:{message:"hello"}}),response());
assert.equal(turnDeps?.serverAuthority?.principalId,principalId);
assert.equal(typeof turnDeps?.commitCreatorDecision,"function");
if(typeof turnDeps?.atomicAcceptCreatorStateOperation!=="function")failures.push("RED: /turn runtime atomic ledger adapter not forwarded");
if(!decisionDeps)failures.push("RED: /turn creator-decision transition was not reached");
if(decisionDeps?.principalId!==principalId)failures.push("RED: /turn creator-decision transition lacks server principal");
if(typeof decisionDeps?.atomicAcceptCreatorStateOperation!=="function")failures.push("RED: /turn creator-decision transition lacks atomic ledger adapter");
for(const failure of failures)console.error(failure);
assert.equal(failures.length,0,"RED: opt-in HTTP ingress atomic dependency gaps: "+failures.join("; "));
console.log("GREEN: both HTTP creator-state ingress routes bind atomic acceptance to authenticated server principal.");
