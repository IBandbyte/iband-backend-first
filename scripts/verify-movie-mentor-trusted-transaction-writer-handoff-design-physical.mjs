import assert from "node:assert/strict";
import mongoose from "mongoose";
// Audit-only synthetic physical design: demonstrates private transaction-scoped handoff.
// NOT production store integration, NOT genuine lease issuer evidence.
assert.equal(process.env.MONGO_URI,"mongodb://127.0.0.1:27017/iband_first_commit_takeover_court");
await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});
const execution=mongoose.connection.collection("court_trusted_handoff_execution");
const creator=mongoose.connection.collection("court_trusted_handoff_creator");
const issued=new WeakMap();
async function authoritativeWrite({id,expectedRevision,revision,authority},handoff){
 const session=issued.get(handoff);
 if(!session||!session.inTransaction())throw new Error("TRUSTED_TRANSACTION_HANDOFF_REQUIRED");
 if(authority!=="lineage-verified"||revision!==expectedRevision+1)throw new Error("CREATOR_MUTATION_AUTHORITY_REQUIRED");
 if(expectedRevision===0)await creator.insertOne({_id:id,revision},{session});
 else{
  const result=await creator.updateOne({_id:id,revision:expectedRevision},{$set:{revision}},{session});
  if(result.modifiedCount!==1)throw new Error("CREATOR_REVISION_CONFLICT");
 }
}
async function atomicCommit({id,expectedRevision,revision,authority,stale=false}){
 const session=await mongoose.startSession();
 let result="committed";
 try{
  await session.withTransaction(async()=>{
   const barrier=await execution.updateOne({_id:id,ownerId:"A",generation:1,$or:[{barrier:0},{barrier:{$exists:false}}],$expr:{$gt:["$expiresAt","$$NOW"]}},{$inc:{barrier:1}},{session});
   if(barrier.modifiedCount!==1)throw new Error("LEASE_FENCED");
   const handoff=Object.freeze({id});
   issued.set(handoff,session);
   try{
    await assert.rejects(authoritativeWrite({id,expectedRevision,revision,authority},Object.freeze({...handoff})),/TRUSTED_TRANSACTION_HANDOFF_REQUIRED/);
    await authoritativeWrite({id,expectedRevision,revision,authority},handoff);
   }finally{issued.delete(handoff);}
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});
 }catch(e){result=e.message;}
 finally{await session.endSession();}
 return result;
}
async function runCase({existing,stale,badAuthority=false}){
 const id=[existing?"update":"create",stale?"stale":"current",badAuthority?"bad":"good"].join("-");
 await execution.insertOne({_id:id,ownerId:stale?"B":"A",generation:stale?2:1,expiresAt:new Date(Date.now()+60000)});
 if(existing)await creator.insertOne({_id:id,revision:7});
 const result=await atomicCommit({id,expectedRevision:existing?7:0,revision:existing?8:1,authority:badAuthority?"forged":"lineage-verified"});
 assert.equal(result,stale?"LEASE_FENCED":badAuthority?"CREATOR_MUTATION_AUTHORITY_REQUIRED":"committed");
 const e=await execution.findOne({_id:id}),c=await creator.findOne({_id:id});
 assert.equal(e.barrier,stale||badAuthority?undefined:1);
 assert.equal(c?.revision??null,existing?(stale||badAuthority?7:8):stale||badAuthority?null:1);
 return {branch:existing?"update":"create",case:stale?"stale":badAuthority?"bad-lineage":"valid",result,barrier:e.barrier??"missing",revision:c?.revision??null};
}
try{
 const cases=[];
 for(const existing of [false,true]){
  cases.push(await runCase({existing,stale:false}));
  cases.push(await runCase({existing,stale:true}));
  cases.push(await runCase({existing,stale:false,badAuthority:true}));
 }
 console.log(JSON.stringify({court:"trusted-transaction-writer-handoff-design-physical",cases,classification:"synthetic physical design; NOT production integration or genuine lease evidence"}));
 console.log("PASS: private transaction handoff rejects copied tokens; creator CAS and barrier roll back together");
}finally{await mongoose.disconnect();}
