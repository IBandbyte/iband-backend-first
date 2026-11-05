import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorTurnRouter} from "../movieMentorTurn.js";
import {createMovieMentorCreatorStateAtomicComposition} from "../ai/MovieMentorCreatorStateAtomicComposition.js";
import {applyMovieMentorCreatorStateTransition} from "../ai/MovieMentorCreatorStateTransition.js";
import {MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_DOMAIN as AUTH_DOMAIN,MOVIE_MENTOR_CREATOR_STATE_MUTATION_PROOF_DOMAIN as PROOF_DOMAIN,MOVIE_MENTOR_CREATOR_STATE_MUTATION_SCHEMA as SCHEMA} from "../ai/MovieMentorCreatorStateMutationAuthority.js";

const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost)(?::|\/)/.test(uri),"Disposable localhost MongoDB required");
const projectId="http-physical-atomic-project",principalId="http-physical-owner";
const authority={domain:AUTH_DOMAIN,schema:SCHEMA,principalId,projectId,assertCurrentMutation:async target=>({domain:PROOF_DOMAIN,schema:SCHEMA,authorized:true,currentOwnershipVerified:true,principalId,projectId,ownershipRef:"physical-owner-ref",ownershipRevision:1,...target})};
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
const client=mongoose.connection.getClient(),db=mongoose.connection.db;
const states=db.collection("movie_mentor_creator_state"),operations=db.collection("movie_mentor_creator_state_operations"),ownerships=db.collection("movie_mentor_project_ownership");
const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
const request=body=>({body:{projectId,...body},headers:{authorization:"Bearer isolated-credential"}});
try{
 await states.createIndex({projectId:1},{unique:true,partialFilterExpression:{projectId:{$type:"string"}}});
 await operations.createIndex({projectId:1,principalId:1,operationId:1},{unique:true});
 await ownerships.createIndex({projectId:1},{unique:true});
 await ownerships.createIndex({establishmentAuthorityId:1},{unique:true});
 const readiness=createMovieMentorCreatorStateAtomicComposition({client,db}).atomicCreatorStateReadiness;
 const read=async({projectId:id})=>{const state=await states.findOne({projectId:id});if(!state)throw Object.assign(new Error("not found"),{code:"MOVIE_MENTOR_CREATOR_STATE_NOT_FOUND"});return state;};
 const router=createMovieMentorTurnRouter({
  requestAuthority:{authorize:async({projectId:id})=>({authorized:true,projectId:id,principalId,ownershipRef:"physical-owner-ref",ownershipRevision:1})},
  inferenceSpendAuthority:{reserveTurn:async()=>({}),readReservation:async()=>({})},
  inferenceExecutionAuthority:Object.fromEntries(["findExecutionByCreatorTurn","openExecution","acquireExecution","assertFence","claimProviderCall","beginProviderDispatch","assertProviderDispatch","contributeProviderEffectEvidence","stageResultCandidate","readResultCandidate","beginExecutionClosing","reconcileExecutionClosure","assertCurrentExecutionClosure","commitCanonicalResult","readCanonicalResult"].map(key=>[key,async()=>({})])),
  inferenceSettlementAuthority:{reconcile:async()=>({}),releaseUnclaimed:async()=>({}),releaseUnbound:async()=>({})},
  atomicCreatorStateReadiness:readiness,
  applyStateTransition:(input,deps)=>applyMovieMentorCreatorStateTransition(input,{...deps,readAuthoritativeTurnSource:read,writeAuthoritativeCreatorState:async()=>{throw Error("RED: legacy HTTP writer reached");}})
 });
 const sync=router.stack.find(x=>x.route?.path==="/state/sync").route.stack[0].handle;
 const first={operationId:"http-stable-op",expectedRevision:0,state:{memoryContext:{scene:1}},source:"creator-memory"};
 const accepted=response();await sync(request(first),accepted);assert.equal(accepted.statusCode,200,JSON.stringify(accepted.body));assert.equal(accepted.body.state.revision,1);
 const replay=response();await sync(request(first),replay);assert.equal(replay.statusCode,200,JSON.stringify(replay.body));assert.equal(replay.body.state.revision,1);
 const collision=response();await sync(request({...first,state:{memoryContext:{scene:"forged"}}}),collision);assert.notEqual(collision.statusCode,200,"Operation payload collision must fail closed");
 const restartedClient=new mongoose.mongo.MongoClient(uri,{serverSelectionTimeoutMS:10000});
 await restartedClient.connect();
 try{
  const restartedDb=restartedClient.db();
  const restartedReadiness=createMovieMentorCreatorStateAtomicComposition({client:restartedClient,db:restartedDb}).atomicCreatorStateReadiness;
  const restartedRead=async({projectId:id})=>{const state=await restartedDb.collection("movie_mentor_creator_state").findOne({projectId:id});if(!state)throw Object.assign(new Error("not found"),{code:"MOVIE_MENTOR_CREATOR_STATE_NOT_FOUND"});return state;};
  const restartedRouter=createMovieMentorTurnRouter({
   requestAuthority:{authorize:async({projectId:id})=>({authorized:true,projectId:id,principalId,ownershipRef:"physical-owner-ref",ownershipRevision:1})},
   inferenceSpendAuthority:{reserveTurn:async()=>({}),readReservation:async()=>({})},
   inferenceExecutionAuthority:Object.fromEntries(["findExecutionByCreatorTurn","openExecution","acquireExecution","assertFence","claimProviderCall","beginProviderDispatch","assertProviderDispatch","contributeProviderEffectEvidence","stageResultCandidate","readResultCandidate","beginExecutionClosing","reconcileExecutionClosure","assertCurrentExecutionClosure","commitCanonicalResult","readCanonicalResult"].map(key=>[key,async()=>({})])),
   inferenceSettlementAuthority:{reconcile:async()=>({}),releaseUnclaimed:async()=>({}),releaseUnbound:async()=>({})},
   atomicCreatorStateReadiness:restartedReadiness,
   applyStateTransition:(input,deps)=>applyMovieMentorCreatorStateTransition(input,{...deps,readAuthoritativeTurnSource:restartedRead,writeAuthoritativeCreatorState:async()=>{throw Error("RED: legacy restarted HTTP writer reached");}})
  });
  const restartedSync=restartedRouter.stack.find(x=>x.route?.path==="/state/sync").route.stack[0].handle;
  const lostAckReplay=response();await restartedSync(request(first),lostAckReplay);
  assert.equal(lostAckReplay.statusCode,200,JSON.stringify(lostAckReplay.body));
  assert.equal(lostAckReplay.body.state.revision,1,"Restart replay must return original committed revision");
  assert.equal(await restartedDb.collection("movie_mentor_creator_state_operations").countDocuments({projectId}),1,"Restart replay cannot mint another operation");
 }finally{await restartedClient.close();}
 assert.equal(await states.countDocuments({projectId}),1);
 assert.equal(await operations.countDocuments({projectId}),1);
 console.log("GREEN: real HTTP /state/sync through readiness and disposable Mongo transaction commits once, replays after independent connection restart and rejects collision.");
}finally{await mongoose.disconnect();}
