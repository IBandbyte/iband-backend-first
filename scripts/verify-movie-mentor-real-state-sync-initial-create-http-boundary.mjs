import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorTurnRouter} from "../movieMentorTurn.js";
import {readAuthoritativeTurnSource} from "../ai/MovieMentorCreatorStateStore.js";
assert.equal(process.env.MONGO_URI,"mongodb://127.0.0.1:27017/iband_state_sync_initial_create_court");
await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});
const creators=mongoose.connection.collection("movie_mentor_creator_state");
const projectId="physical-state-sync-project";
const owner="physical-owner";
let allowed=true,authCalls=0;
const requestAuthority={async authorize({request,projectId:requested}){authCalls++;if(!allowed||request?.headers?.authorization!=="Bearer court-owner"||requested!==projectId){const e=new Error("denied");e.code="MOVIE_MENTOR_CREATOR_PROJECT_NOT_AUTHORIZED";throw e;}return{authorized:true,principalId:owner,projectId,ownershipRef:"ownership:physical",ownershipRevision:1};}};
const executionMethods=["findExecutionByCreatorTurn","openExecution","acquireExecution","assertFence","claimProviderCall","beginProviderDispatch","assertProviderDispatch","contributeProviderEffectEvidence","stageResultCandidate","readResultCandidate","beginExecutionClosing","reconcileExecutionClosure","assertCurrentExecutionClosure","commitCanonicalResult","readCanonicalResult"];
const execution=Object.fromEntries(executionMethods.map(name=>[name,async()=>{throw new Error("UNEXPECTED_EXECUTION_LEASE_CALL:"+name);}]));
const router=createMovieMentorTurnRouter({requestAuthority,inferenceSpendAuthority:{reserveTurn:async()=>{throw Error("UNEXPECTED_SPEND");},readReservation:async()=>{throw Error("UNEXPECTED_SPEND");}},inferenceExecutionAuthority:execution,inferenceSettlementAuthority:{reconcile:async()=>{throw Error("UNEXPECTED_SETTLEMENT");},releaseUnclaimed:async()=>{throw Error("UNEXPECTED_SETTLEMENT");},releaseUnbound:async()=>{throw Error("UNEXPECTED_SETTLEMENT");}}});
const layer=router.stack.find(x=>x.route?.path==="/state/sync");
assert.ok(layer);
function response(){return{statusCode:200,payload:null,status(n){this.statusCode=n;return this;},json(v){this.payload=v;return this;}};}
async function invoke(body,credential="Bearer court-owner"){const res=response();await layer.route.stack[0].handle({body,headers:{authorization:credential}},res);return res;}
const body={projectId,creatorSessionId:"physical-session",source:"creator-memory",expectedRevision:0,state:{memoryContext:{beat:"opening"}}};
try{
 await creators.createIndex({projectId:1},{unique:true,partialFilterExpression:{projectId:{$type:"string"}}});
 const unauthorized=await invoke(body,"Bearer intruder");
 assert.notEqual(unauthorized.statusCode,200);
 assert.equal(await creators.countDocuments({projectId}),0);
 const first=await invoke(body);
 assert.equal(first.statusCode,200,JSON.stringify(first.payload));
 assert.equal(first.payload.state.revision,1);
 assert.equal((await readAuthoritativeTurnSource({projectId})).revision,1);
 const duplicate=await invoke(body);
 assert.notEqual(duplicate.statusCode,200);
 assert.equal((await creators.findOne({projectId})).revision,1);
 const forbidden=await invoke({...body,expectedRevision:1,source:"creator-memory",state:{creatorConfirmedContext:[{value:"forged"}]}});
 assert.notEqual(forbidden.statusCode,200);
 assert.equal((await creators.findOne({projectId})).revision,1);
 allowed=false;
 const revoked=await invoke({...body,expectedRevision:1,state:{memoryContext:{beat:"unauthorized"}}});
 assert.notEqual(revoked.statusCode,200);
 assert.equal((await creators.findOne({projectId})).revision,1);
 console.log(JSON.stringify({court:"real-state-sync-initial-create-http-boundary",classification:"audit-only isolated MongoDB physical real router, transition and creator-state writer with synthetic authenticated ownership authority; no real credential verifier or live deployment; NOT execution lease court",results:{unauthorizedRejected:true,initialCreateRevision:1,duplicateRejected:true,forgedCreatorTruthRejected:true,revokedOwnershipRejected:true,authCalls}}));
 console.log("PASS: authenticated state-sync initial create and rejection boundaries");
}finally{await mongoose.disconnect();}
