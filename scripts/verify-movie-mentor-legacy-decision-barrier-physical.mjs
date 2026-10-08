import assert from "node:assert/strict";
import mongoose from "mongoose";
assert.equal(process.env.MONGO_URI,"mongodb://127.0.0.1:27017/iband_first_commit_takeover_court");
await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});
const executions=mongoose.connection.collection("court_legacy_decision_barrier_execution");
const creators=mongoose.connection.collection("court_legacy_decision_barrier_creator");
async function runCase(legacy,stale){
 const id=(legacy?"missing":"zero")+(stale?"-stale":"-active");
 const lease={_id:id,creatorTurnId:"turn-"+id,phase:"active",ownerId:stale?"B":"A",leaseGeneration:stale?2:1,leaseReference:stale?"B":"A",fencingToken:stale?"fence-B":"fence-A",leaseExpiresAt:new Date(Date.now()+60000)};
 if(!legacy)lease.creatorDecisionBarrierRevision=0;
 await executions.insertOne(lease);
 await creators.insertOne({_id:id,revision:7,decisions:[]});
 const session=await mongoose.startSession();
 let accepted=false;
 try{
  await session.withTransaction(async()=>{
   const barrier=await executions.updateOne({_id:id,phase:"active",ownerId:"A",leaseGeneration:1,leaseReference:"A",fencingToken:"fence-A",creatorTurnId:"turn-"+id,$or:[{creatorDecisionBarrierRevision:0},{creatorDecisionBarrierRevision:{$exists:false}}],$expr:{$gt:["$leaseExpiresAt","$$NOW"]}},{$inc:{creatorDecisionBarrierRevision:1}},{session});
   if(barrier.modifiedCount!==1)throw new Error("FENCED");
   const creator=await creators.updateOne({_id:id,revision:7},{$set:{revision:8,decisions:["A"]}},{session});
   assert.equal(creator.modifiedCount,1);
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});
  accepted=true;
 }catch(e){assert.equal(e.message,"FENCED");}finally{await session.endSession();}
 const finalExecution=await executions.findOne({_id:id});
 const finalCreator=await creators.findOne({_id:id});
 assert.equal(accepted,!stale);
 assert.equal(finalCreator.revision,stale?7:8);
 assert.equal(finalExecution.creatorDecisionBarrierRevision,stale?(legacy?undefined:0):1);
 return {representation:legacy?"missing":"zero",owner:stale?"B":"A",outcome:accepted?"committed":"fenced",creatorRevision:finalCreator.revision,barrier:finalExecution.creatorDecisionBarrierRevision??"missing"};
}
try{
 const results=[];
 for(const legacy of [true,false])for(const stale of [false,true])results.push(await runCase(legacy,stale));
 console.log(JSON.stringify({court:"legacy-creator-decision-barrier-physical",results,classification:"synthetic physical MongoDB design, NOT production integration"}));
 console.log("PASS: missing and zero barriers admit legitimate owner; both fence stale owner");
}finally{await mongoose.disconnect();}
