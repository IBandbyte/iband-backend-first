import assert from "node:assert/strict";
import mongoose from "mongoose";
// Synthetic physical authority-design challenge, NOT production integration.
assert.equal(process.env.MONGO_URI,"mongodb://127.0.0.1:27017/iband_first_commit_takeover_court");
await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});
const execution=mongoose.connection.collection("court_identity_takeover_execution");
const creator=mongoose.connection.collection("court_identity_takeover_creator");
async function seed(id,owner="B"){await execution.insertOne({_id:id,phase:"active",projectId:"project-"+id,creatorTurnId:"turn-"+id,ownerId:owner,leaseGeneration:owner==="B"?2:1,leaseReference:owner,fencingToken:"fence-"+owner,leaseExpiresAt:new Date(Date.now()+60000),creatorDecisionBarrierRevision:0});await creator.insertOne({_id:id,revision:7,decisions:[]});}
async function attempt(id,proof,expectedTurn){
 const session=await mongoose.startSession();
 try{return await session.withTransaction(async()=>{
  if(proof.trusted!==true)return "rejected-untrusted";
  const filter={_id:id,phase:"active",projectId:"project-"+id,creatorTurnId:expectedTurn,ownerId:proof.ownerId,leaseGeneration:proof.leaseGeneration,leaseReference:proof.leaseReference,fencingToken:proof.fencingToken,creatorDecisionBarrierRevision:0,$expr:{$gt:["$leaseExpiresAt","$$NOW"]}};
  const barrier=await execution.updateOne(filter,{$inc:{creatorDecisionBarrierRevision:1}},{session});
  if(barrier.modifiedCount!==1)return "fenced";
  const state=await creator.updateOne({_id:id,revision:7},{$set:{revision:8,decisions:[expectedTurn]}},{session});
  assert.equal(state.modifiedCount,1);
  return "committed";
 },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});
 }finally{await session.endSession();}
}
try{
 await seed("stale");const stale=await attempt("stale",{trusted:true,ownerId:"A",leaseGeneration:1,leaseReference:"A",fencingToken:"fence-A"},"turn-stale");
 assert.equal(stale,"fenced");
 await seed("forged");const forged=await attempt("forged",{trusted:false,ownerId:"B",leaseGeneration:2,leaseReference:"B",fencingToken:"fence-B"},"turn-forged");
 assert.equal(forged,"rejected-untrusted");
 await seed("cross");const cross=await attempt("cross",{trusted:true,ownerId:"B",leaseGeneration:2,leaseReference:"B",fencingToken:"fence-B"},"turn-other");
 assert.equal(cross,"fenced");
 await seed("valid");const valid=await attempt("valid",{trusted:true,ownerId:"B",leaseGeneration:2,leaseReference:"B",fencingToken:"fence-B"},"turn-valid");
 assert.equal(valid,"committed");
 for(const id of ["stale","forged","cross"]){assert.equal((await creator.findOne({_id:id})).revision,7);assert.equal((await execution.findOne({_id:id})).creatorDecisionBarrierRevision,0);}
 assert.equal((await creator.findOne({_id:"valid"})).revision,8);
 console.log(JSON.stringify({court:"takeover-first-and-identity-design",stale,forged,cross,valid,qualification:"synthetic physical design; trusted boolean is a TEST FIXTURE, not a secure production proof mechanism"}));
 console.log("PASS: synthetic physical takeover-first and identity challenges");
}finally{await mongoose.disconnect();}
