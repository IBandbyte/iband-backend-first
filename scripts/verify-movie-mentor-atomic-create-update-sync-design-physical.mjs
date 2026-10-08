import assert from "node:assert/strict";
import mongoose from "mongoose";

// Design-feasibility court. Synthetic collections: NOT production integration.
assert.equal(process.env.MONGO_URI,"mongodb://127.0.0.1:27017/iband_first_commit_takeover_court");
await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});
const execution=mongoose.connection.collection("court_both_branches_execution");
const creator=mongoose.connection.collection("court_both_branches_creator");
async function seed(id,{existing=false,owner="A"}={}){
 await execution.insertOne({_id:id,phase:"active",ownerId:owner,leaseGeneration:owner==="A"?1:2,leaseReference:owner,fencingToken:"fence-"+owner,leaseExpiresAt:new Date(Date.now()+60000),barrier:0});
 if(existing)await creator.insertOne({_id:id,revision:7,decisions:[]});
}
async function decision(id,{existing=false,owner="A",fail=false}={}){
 const session=await mongoose.startSession();
 try{return await session.withTransaction(async()=>{
  const fence=await execution.updateOne({_id:id,phase:"active",ownerId:owner,leaseGeneration:owner==="A"?1:2,leaseReference:owner,fencingToken:"fence-"+owner,barrier:0,leaseExpiresAt:{$gt:new Date()}},{$inc:{barrier:1}},{session});
  if(fence.modifiedCount!==1)return "fenced";
  if(existing){
   const cas=await creator.updateOne({_id:id,revision:7},{$set:{revision:8,decisions:["turn"]}},{session});
   if(cas.modifiedCount!==1)throw Error("REVISION_CONFLICT");
  }else{
   await creator.insertOne({_id:id,revision:1,decisions:["turn"]},{session});
  }
  if(fail)throw Error("INJECTED_FAILURE");
  return "committed";
 },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});}finally{await session.endSession();}
}
async function stateSync(id,expectedRevision){
 const update=await creator.updateOne({_id:id,revision:expectedRevision},{$inc:{revision:1}});
 return update.modifiedCount===1;
}
try{
 for(const existing of [false,true]){
  const suffix=existing?"update":"create";
  await seed("stale-"+suffix,{existing,owner:"B"});
  assert.equal(await decision("stale-"+suffix,{existing}),"fenced");
  assert.equal((await creator.findOne({_id:"stale-"+suffix}))?.revision,existing?7:undefined);
  await seed("rollback-"+suffix,{existing});
  await assert.rejects(decision("rollback-"+suffix,{existing,fail:true}),/INJECTED_FAILURE/);
  assert.equal((await creator.findOne({_id:"rollback-"+suffix}))?.revision,existing?7:undefined);
  assert.equal((await execution.findOne({_id:"rollback-"+suffix})).barrier,0);
  await seed("current-"+suffix,{existing});
  assert.equal(await decision("current-"+suffix,{existing}),"committed");
  assert.equal((await creator.findOne({_id:"current-"+suffix})).revision,existing?8:1);
  assert.equal((await execution.findOne({_id:"current-"+suffix})).barrier,1);
 }
 await seed("sync",{existing:true,owner:"B"});
 assert.equal(await stateSync("sync",7),true);
 assert.equal((await creator.findOne({_id:"sync"})).revision,8);
 assert.equal((await execution.findOne({_id:"sync"})).barrier,0);
 console.log(JSON.stringify({court:"atomic-create-update-and-independent-sync-design",create:"stale-fenced-rollback-current-committed",update:"stale-fenced-rollback-current-committed",stateSync:"allowed-without-execution-barrier",qualification:"synthetic design feasibility only; not production integration"}));
 console.log("PASS: physical create/update transaction and independent sync design");
}finally{await mongoose.disconnect();}
