import assert from "node:assert/strict";
import mongoose from "mongoose";
import {applyMovieMentorCreatorStateTransition} from "../ai/MovieMentorCreatorStateTransition.js";
import {createMongoCreatorStateAtomicAccept} from "../ai/MovieMentorCreatorStateMongoOperationAdapter.js";
import {MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_DOMAIN as AUTH_DOMAIN,MOVIE_MENTOR_CREATOR_STATE_MUTATION_PROOF_DOMAIN as PROOF_DOMAIN,MOVIE_MENTOR_CREATOR_STATE_MUTATION_SCHEMA as SCHEMA} from "../ai/MovieMentorCreatorStateMutationAuthority.js";

const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost)(?::|\/)/.test(uri),"Disposable localhost MongoDB required.");
const projectId="transition-physical-project",principalId="isolated-owner";
const authority={domain:AUTH_DOMAIN,schema:SCHEMA,principalId,projectId,assertCurrentMutation:async target=>({domain:PROOF_DOMAIN,schema:SCHEMA,authorized:true,currentOwnershipVerified:true,principalId,projectId,ownershipRef:"isolated-ownership",ownershipRevision:1,...target})};
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
const client=mongoose.connection.getClient(),db=mongoose.connection.db;
const states=db.collection("transition_physical_states"),operations=db.collection("transition_physical_operations");
try{
 await states.createIndex({projectId:1},{unique:true});
 await operations.createIndex({projectId:1,principalId:1,operationId:1},{unique:true});
 const depsFor=(mongoClient,dbFor)=>({
  principalId,creatorStateMutationAuthority:authority,
  atomicAcceptCreatorStateOperation:createMongoCreatorStateAtomicAccept({client:mongoClient,states:dbFor.collection("transition_physical_states"),operations:dbFor.collection("transition_physical_operations")}),
  readAuthoritativeTurnSource:async({projectId:id})=>{
   const state=await dbFor.collection("transition_physical_states").findOne({projectId:id});
   if(!state)throw Object.assign(new Error("not found"),{code:"MOVIE_MENTOR_CREATOR_STATE_NOT_FOUND"});
   return state;
  },
  writeAuthoritativeCreatorState:async()=>{throw Error("RED: legacy write path forbidden");}
 });
 const deps=depsFor(client,db);
 const first={projectId,source:"creator-memory",operationId:"first-op",expectedRevision:0,state:{memoryContext:{scene:1}}};
 const accepted=await applyMovieMentorCreatorStateTransition(first,deps);
 assert.equal(accepted.revision,1);
 assert.equal((await applyMovieMentorCreatorStateTransition(first,deps)).revision,1);
 const second={...first,operationId:"second-op",expectedRevision:1,state:{memoryContext:{scene:2}}};
 assert.equal((await applyMovieMentorCreatorStateTransition(second,deps)).revision,2);
 const freshClient=new mongoose.mongo.MongoClient(uri,{serverSelectionTimeoutMS:10000});
 await freshClient.connect();
 try{
  const restarted=depsFor(freshClient,freshClient.db());
  assert.equal((await applyMovieMentorCreatorStateTransition(second,restarted)).revision,2,"RED: restart replay must return committed revision two");
  let collision=null;
  try{await applyMovieMentorCreatorStateTransition({...second,state:{memoryContext:{scene:"different"}}},restarted);}catch(e){collision=e;}
  assert.equal(collision?.code,"MOVIE_MENTOR_CREATOR_STATE_OPERATION_ID_CONFLICT","RED: payload collision after restart must be denied");
  assert.equal(await freshClient.db().collection("transition_physical_states").countDocuments({projectId}),1);
  assert.equal(await freshClient.db().collection("transition_physical_operations").countDocuments({projectId}),2);
  assert.equal((await applyMovieMentorCreatorStateTransition(first,restarted)).revision,1,"RED: old operation must replay its original revision after newer revision commits");
  const stale={...first,operationId:"stale-new-operation",state:{memoryContext:{scene:"stale"}}};
  let staleError=null;
  try{await applyMovieMentorCreatorStateTransition(stale,restarted);}catch(error){staleError=error;}
  assert.equal(staleError?.code,"MOVIE_MENTOR_CREATOR_STATE_REVISION_CONFLICT","RED: new operation with stale expected revision must not commit");
  assert.equal(await freshClient.db().collection("transition_physical_operations").countDocuments({projectId}),2,"RED: stale request cannot create an operation claim");
  assert.equal((await freshClient.db().collection("transition_physical_states").findOne({projectId})).revision,2);
 }finally{await freshClient.close();}
 console.log("GREEN: actual transition and Mongo transaction adapter recovered revision-two retry across independent connection, rejected collision, and persisted exactly two effects.");
}finally{await mongoose.disconnect();}
