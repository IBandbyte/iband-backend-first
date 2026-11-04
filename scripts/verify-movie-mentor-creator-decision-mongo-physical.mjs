import assert from "node:assert/strict";
import mongoose from "mongoose";
import {commitCreatorDecision,buildCreatorDecisionCandidate} from "../ai/MovieMentorCreatorDecisionAuthority.js";
import {applyMovieMentorCreatorStateTransition} from "../ai/MovieMentorCreatorStateTransition.js";
import {createMongoCreatorStateAtomicAccept} from "../ai/MovieMentorCreatorStateMongoOperationAdapter.js";
import {MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_DOMAIN as AUTH_DOMAIN,MOVIE_MENTOR_CREATOR_STATE_MUTATION_PROOF_DOMAIN as PROOF_DOMAIN,MOVIE_MENTOR_CREATOR_STATE_MUTATION_SCHEMA as SCHEMA} from "../ai/MovieMentorCreatorStateMutationAuthority.js";

const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost)(?::|\/)/.test(uri),"Disposable localhost MongoDB required");
const projectId="creator-decision-physical-project",principalId="isolated-owner",creatorTurnId="stable-decision-turn";
const authority={domain:AUTH_DOMAIN,schema:SCHEMA,principalId,projectId,assertCurrentMutation:async target=>({domain:PROOF_DOMAIN,schema:SCHEMA,authorized:true,currentOwnershipVerified:true,principalId,projectId,ownershipRef:"isolated-owner-ref",ownershipRevision:1,...target})};
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
const client=mongoose.connection.getClient(),db=mongoose.connection.db;
const states=db.collection("decision_physical_states"),operations=db.collection("decision_physical_operations");
try{
 await states.createIndex({projectId:1},{unique:true});
 await operations.createIndex({projectId:1,principalId:1,operationId:1},{unique:true});
 const depsFor=(mongoClient,dbFor)=>({
  principalId,creatorStateMutationAuthority:authority,
  atomicAcceptCreatorStateOperation:createMongoCreatorStateAtomicAccept({client:mongoClient,states:dbFor.collection("decision_physical_states"),operations:dbFor.collection("decision_physical_operations")}),
  readAuthoritativeTurnSource:async({projectId:id})=>{
   const state=await dbFor.collection("decision_physical_states").findOne({projectId:id});
   if(!state)throw Object.assign(new Error("not found"),{code:"MOVIE_MENTOR_CREATOR_STATE_NOT_FOUND"});
   return state;
  },
  writeAuthoritativeCreatorState:async()=>{throw Error("RED: legacy writer reached");}
 });
 const deps=depsFor(client,db);
 await applyMovieMentorCreatorStateTransition({projectId,source:"creator-memory",operationId:"seed-op",expectedRevision:0,state:{memoryContext:{scene:1}}},deps);
 const candidateResult=buildCreatorDecisionCandidate({creatorMessage:"Let's use a blue dragon",creatorTurnId,projectId,semanticIntelligence:{understoodContext:[{key:"dragon-colour",value:"blue",confidenceSource:"creator-explicit"}]}});
 assert.equal(candidateResult.status,"candidate");
 const args={candidate:candidateResult.candidate,expectedRevision:1,projectId,creatorTurnId};
 const first=await commitCreatorDecision(args,deps);
 assert.equal(first.status,"committed");
 assert.equal(first.revision,2);
 assert.equal((await commitCreatorDecision(args,deps)).status,"committed");
 const restartedClient=new mongoose.mongo.MongoClient(uri,{serverSelectionTimeoutMS:10000});
 await restartedClient.connect();
 try{
  const restarted=depsFor(restartedClient,restartedClient.db());
  const replay=await commitCreatorDecision(args,restarted);
  assert.equal(replay.status,"committed");
  assert.equal(replay.revision,2);
  const latest=await restartedClient.db().collection("decision_physical_states").findOne({projectId});
  assert.equal(latest.revision,2);
  assert.equal(latest.creatorConfirmedContext.filter(item=>item.creatorTurnId===creatorTurnId).length,1);
  assert.equal(await restartedClient.db().collection("decision_physical_operations").countDocuments({projectId}),2,"RED: seed plus exactly one creator decision operation");
 }finally{await restartedClient.close();}
 console.log("GREEN: creator-decision real Mongo atomic commit, same-process retry and independent-connection restart replay produced exactly one decision effect.");
}finally{await mongoose.disconnect();}
