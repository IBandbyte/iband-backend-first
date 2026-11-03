import assert from "node:assert/strict";
import {createMovieMentorTurnRouter} from "../movieMentorTurn.js";
import {applyMovieMentorCreatorStateTransition} from "../ai/MovieMentorCreatorStateTransition.js";

// Invoke the actual Express /state/sync route handler with injected owner authority
// and a CAS in-memory store. No listener, HTTP network, MongoDB or production write.
const projectId="isolated-http-provenance-project";
const records=new Map();
let writes=0,authorizations=0,revoked=false;
const owner={authorized:true,principalId:"isolated-owner",projectId,ownershipRef:"ownership-proof-1",ownershipRevision:1,authorizationSource:"isolated-verified-owner"};
const requestAuthority={authorize:async()=>{authorizations++;return revoked?{authorized:false,projectId}:owner;}};
const spend={reserveTurn:async()=>({}),readReservation:async()=>({})};
const execution=Object.fromEntries(["findExecutionByCreatorTurn","openExecution","acquireExecution","assertFence","claimProviderCall","beginProviderDispatch","assertProviderDispatch","contributeProviderEffectEvidence","stageResultCandidate","readResultCandidate","beginExecutionClosing","reconcileExecutionClosure","assertCurrentExecutionClosure","commitCanonicalResult","readCanonicalResult"].map(name=>[name,async()=>({})]));
const settlement={reconcile:async()=>({}),releaseUnclaimed:async()=>({}),releaseUnbound:async()=>({})};
const read=async({projectId:id})=>{
 const value=records.get(id);
 if(!value)throw Object.assign(new Error("missing"),{code:"MOVIE_MENTOR_CREATOR_STATE_NOT_FOUND"});
 return structuredClone(value);
};
const write=async(state,{expectedRevision})=>{
 const prior=records.get(state.projectId);
 if((prior?.revision||0)!==expectedRevision)throw Object.assign(new Error("conflict"),{code:"MOVIE_MENTOR_CREATOR_STATE_REVISION_CONFLICT"});
 writes++;
 records.set(state.projectId,structuredClone(state));
 return structuredClone(state);
};
const router=createMovieMentorTurnRouter({
 requestAuthority,inferenceSpendAuthority:spend,inferenceExecutionAuthority:execution,inferenceSettlementAuthority:settlement,
 applyStateTransition:(body,deps)=>applyMovieMentorCreatorStateTransition(body,{
  ...deps,readAuthoritativeTurnSource:read,writeAuthoritativeCreatorState:write
 })
});
const route=router.stack.find(layer=>layer.route?.path==="/state/sync");
assert.ok(route,"Actual state sync HTTP route must be registered");
const response=()=>({statusCode:200,payload:null,status(code){this.statusCode=code;return this;},json(value){this.payload=value;return this;}});
async function post(body){const res=response();await route.route.stack[0].handle({body,headers:{authorization:"Bearer isolated-token"}},res);return res;}
const body={projectId,source:"creator-memory",expectedRevision:0,state:{
 memoryContext:{projectMemories:[{id:"noncooperating",projectId,metadata:{uncoordinatedWriteMarker:"forwarded-without-lock"}}]}
}};
const accepted=await post(body);
assert.equal(accepted.statusCode,200,JSON.stringify(accepted.payload));
assert.equal(accepted.payload?.success,true);
assert.equal(accepted.payload?.state?.revision,1);
assert.equal(records.get(projectId)?.memoryContext?.projectMemories?.[0]?.metadata?.uncoordinatedWriteMarker,"forwarded-without-lock");
assert.ok(authorizations>=2,"Owner must be reauthorized at mutation boundary");
assert.equal(writes,1);
console.log("BOUNDARY RED CONFIRMED: actual /state/sync Express route accepted a current-owner, current-revision uncoordinated-marker payload and persisted it in the isolated store without client lock provenance.");
const stale=await post(body);
assert.notEqual(stale.statusCode,200);
assert.equal(stale.payload?.code,"MOVIE_MENTOR_CREATOR_STATE_REVISION_CONFLICT");
assert.equal(writes,1);
console.log("GREEN: stale revision refused by actual HTTP route.");
const forged=await post({...body,expectedRevision:1,state:{revision:999,memoryContext:{bad:true}}});
assert.notEqual(forged.statusCode,200);
assert.equal(forged.payload?.code,"MOVIE_MENTOR_CREATOR_STATE_AUTHORITY_INJECTION");
assert.equal(writes,1);
console.log("GREEN: injected server-owned authority fields refused by actual HTTP route.");
revoked=true;
const denied=await post({...body,expectedRevision:1});
assert.notEqual(denied.statusCode,200);
assert.equal(writes,1);
console.log("GREEN: revoked project ownership refused by actual HTTP route.");
console.log("LIMITATION: isolated route handler with simulated owner and in-memory CAS store; not production HTTP, authentication provider or MongoDB acceptance.");
