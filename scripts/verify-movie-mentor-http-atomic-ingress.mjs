import assert from "node:assert/strict";
import {createMovieMentorTurnRouter} from "../movieMentorTurn.js";

const projectId="http-atomic-court",principalId="server-owner";
const requestAuthority={authorize:async({projectId:id})=>({authorized:true,projectId:id,principalId,ownershipRef:"owner-ref",ownershipRevision:1})};
const spend={reserveTurn:async()=>({}),readReservation:async()=>({})};
const execution=Object.fromEntries(["findExecutionByCreatorTurn","openExecution","acquireExecution","assertFence","claimProviderCall","beginProviderDispatch","assertProviderDispatch","contributeProviderEffectEvidence","stageResultCandidate","readResultCandidate","beginExecutionClosing","reconcileExecutionClosure","assertCurrentExecutionClosure","commitCanonicalResult","readCanonicalResult"].map(key=>[key,async()=>({})]));
const settlement={reconcile:async()=>({}),releaseUnclaimed:async()=>({}),releaseUnbound:async()=>({})};
let syncDeps=null,turnDeps=null,decisionDeps=null;
const router=createMovieMentorTurnRouter({
 requestAuthority,inferenceSpendAuthority:spend,inferenceExecutionAuthority:execution,inferenceSettlementAuthority:settlement,
 applyStateTransition:async(_input,deps)=>{syncDeps=deps;return{revision:1};},
 runTurn:async(_input,deps)=>{turnDeps=deps;await deps.commitCreatorDecision({candidate:{},expectedRevision:0,projectId,creatorTurnId:"stable-turn"},{}).catch(()=>{});return{success:true};},
});
const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
const request=body=>({body:{projectId,...body},headers:{authorization:"Bearer isolated-credential"}});
const sync=router.stack.find(x=>x.route?.path==="/state/sync").route.stack[0].handle;
const turn=router.stack.find(x=>x.route?.path==="/turn").route.stack[0].handle;
await sync(request({operationId:"stable-sync-op",expectedRevision:0,state:{memoryContext:{}}}),response());
assert.equal(syncDeps?.creatorStateMutationAuthority?.principalId,principalId);
assert.equal(syncDeps?.principalId,principalId,"RED: /state/sync must bind authenticated server principal");
assert.equal(typeof syncDeps?.atomicAcceptCreatorStateOperation,"function","RED: /state/sync must supply atomic ledger adapter");
await turn(request({creatorTurnId:"stable-turn",input:{message:"hello"}}),response());
assert.equal(turnDeps?.serverAuthority?.principalId,principalId);
assert.equal(typeof turnDeps?.commitCreatorDecision,"function");
assert.equal(typeof decisionDeps?.atomicAcceptCreatorStateOperation,"function","RED: /turn creator decision must supply atomic ledger adapter");
console.log("GREEN: both HTTP creator-state ingress routes bind atomic acceptance to authenticated server principal.");
