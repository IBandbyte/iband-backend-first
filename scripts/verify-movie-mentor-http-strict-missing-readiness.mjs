import assert from "node:assert/strict";
import {createMovieMentorTurnRouter} from "../movieMentorTurn.js";

// RED-first physical route-handler court for absent atomic readiness.
// No network or database; checks strict opt-in router contract before production wiring.
const principalId="strict-owner",projectId="missing-readiness-project";
let mutations=0,turns=0;
const router=createMovieMentorTurnRouter({
 requireAtomicCreatorStateOperation:true,
 requestAuthority:{authorize:async()=>({authorized:true,principalId,projectId,ownershipRef:"owner",ownershipRevision:1})},
 inferenceSpendAuthority:{reserveTurn:async()=>({}),readReservation:async()=>({})},
 inferenceExecutionAuthority:Object.fromEntries(["findExecutionByCreatorTurn","openExecution","acquireExecution","assertFence","claimProviderCall","beginProviderDispatch","assertProviderDispatch","contributeProviderEffectEvidence","stageResultCandidate","readResultCandidate","beginExecutionClosing","reconcileExecutionClosure","assertCurrentExecutionClosure","commitCanonicalResult","readCanonicalResult"].map(k=>[k,async()=>({})])),
 inferenceSettlementAuthority:{reconcile:async()=>({}),releaseUnclaimed:async()=>({}),releaseUnbound:async()=>({})},
 applyStateTransition:async()=>{mutations++;return{revision:1};},
 runTurn:async()=>{turns++;return{success:true};}
});
const handler=path=>router.stack.find(x=>x.route?.path===path).route.stack[0].handle;
const request=body=>({body:{projectId,...body},headers:{authorization:"Bearer isolated-test"}});
const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
for(const [path,body] of [["/state/sync",{operationId:"sync-op",expectedRevision:0,state:{memoryContext:{}}}],["/turn",{creatorTurnId:"turn-op",input:{message:"hello"}}]]){
 const res=response();
 await handler(path)(request(body),res);
 assert.equal(res.body?.code,"MOVIE_MENTOR_CREATOR_STATE_ATOMIC_READINESS_REQUIRED",path+" must fail closed when strict router lacks atomic readiness");
 assert.notEqual(res.statusCode,200,path+" must not accept mutation without readiness");
}
assert.equal(mutations,0,"No sync mutation may occur without readiness");
assert.equal(turns,0,"No turn may execute without readiness");
console.log("GREEN: strict HTTP router denies both ingress routes when atomic readiness is absent.");
