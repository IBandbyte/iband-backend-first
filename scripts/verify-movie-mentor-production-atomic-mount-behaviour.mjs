import assert from "node:assert/strict";
import fs from "node:fs";

// Executes the actual production gateway function with isolated, injected authorities.
// Never imports server.js, starts a listener, connects Mongo, or writes production data.
const server=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");
const match=server.match(/async function mountMovieMentorCreatorGateway\(\)\{([\s\S]*?)\}\s*await mountMovieMentorNativeProjectCreationIngress\(/);
assert.ok(match,"Production gateway body must remain discoverable.");
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const methods=["findExecutionByCreatorTurn","openExecution","acquireExecution","assertFence","claimProviderCall","beginProviderDispatch","assertProviderDispatch","contributeProviderEffectEvidence","stageResultCandidate","readResultCandidate","beginExecutionClosing","reconcileExecutionClosure","assertCurrentExecutionClosure","commitCanonicalResult","readCanonicalResult"];
const fn=()=>{};
const auth={ready:true,getStatus:()=>({}),verifyCredential:fn};
const spend={ready:true,getStatus:()=>({}),authority:{reserveTurn:fn,readReservation:fn}};
const execution={ready:true,getStatus:()=>({}),authority:Object.fromEntries(methods.map(k=>[k,fn]))};
const settlement={ready:true,getStatus:()=>({}),authority:{reconcile:fn,releaseUnclaimed:fn,releaseUnbound:fn}};
const calls=[];
const connection={readyState:0};
let readinessMode="valid";
const deps={
 createMovieMentorProductionAuthenticationComposition:()=>auth,authenticationCompositionProven:()=>true,
 movieMentorProjectOwnershipAuthority:{getStatus:()=>({})},ownershipAuthorityProven:()=>true,
 createMovieMentorProductionInferenceSpendComposition:()=>spend,spendCompositionProven:()=>true,
 createMovieMentorProductionInferenceExecutionComposition:()=>execution,executionCompositionProven:()=>true,
 createMovieMentorProductionInferenceSettlementComposition:()=>settlement,settlementCompositionProven:()=>true,
 createMovieMentorCreatorRequestAuthority:()=>({}),
 mongoose:{connection},
 createMovieMentorCreatorStateAtomicCompositionFromMongoose:(c)=>{calls.push("compose");assert.equal(c,connection);if(readinessMode==="composition-throws")throw Error("disconnected");return{atomicCreatorStateReadiness:async()=>readinessMode==="invalid"?null:fn};},
 assertMovieMentorCreatorGatewayAtomicMountReadiness:async({atomicCreatorStateReadiness})=>{calls.push("gate");const adapter=await atomicCreatorStateReadiness();if(typeof adapter!=="function")throw Error("not ready");return{atomicAcceptCreatorStateOperation:adapter};},
 createMovieMentorTurnRouter:(args)=>{calls.push("router");assert.equal(args.requireAtomicCreatorStateOperation,true);assert.equal(typeof args.atomicCreatorStateReadiness,"function");return{};},
 app:{use:()=>calls.push("mount")},console:{log:()=>{}}
};
const keys=Object.keys(deps);
const gateway=new AsyncFunction(...keys,match[1]);
async function scenario(state,mode,expected){
 connection.readyState=state;readinessMode=mode;calls.length=0;
 const result=await gateway(...keys.map(k=>deps[k]));
 assert.equal(result.mounted,expected==="mounted");
 assert.deepEqual(calls,expected==="mounted"?["compose","gate","router","mount"]:state!==1?[]:mode==="composition-throws"?["compose"]:["compose","gate"]);
}
await scenario(0,"valid","closed");
await scenario(2,"valid","closed");
await scenario(1,"composition-throws","closed");
await scenario(1,"invalid","closed");
await scenario(1,"valid","mounted");
console.log("GREEN: actual production gateway refuses disconnected and unready atomic mounts; strict router mounts only after verified readiness.");
