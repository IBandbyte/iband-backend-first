import assert from "node:assert/strict";
import { MongoClient } from "mongodb";
// Real MongoDB unique candidateReference collision across independent executions.
// Audit-only mechanics: this does not invoke the production store or claim exploitation.
const uri=process.env.MONGO_URI;
assert.equal(uri,"mongodb://127.0.0.1:27017/iband_candidate_reference_collision");
const client=new MongoClient(uri,{serverSelectionTimeoutMS:10000});
await client.connect();
try{
 const c=client.db().collection("candidate_reference_collision_court");
 await c.createIndex({executionId:1},{unique:true});
 await c.createIndex({candidateReference:1},{unique:true});
 await c.insertOne({executionId:"A",candidateReference:"same-ref",digest:"A"});
 const session=client.startSession();let observed;
 try{
  session.startTransaction({readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});
  const existing=await c.findOne({executionId:"B"},{session});
  assert.equal(existing,null);
  try{
   await c.insertOne({executionId:"B",candidateReference:"same-ref",digest:"B"},{session});
   await session.commitTransaction();observed={status:"committed"};
  }catch(error){
   observed={status:"rejected",code:error.code??null,codeName:error.codeName??null,keyPattern:error.keyPattern??null,labels:error.errorLabels??[]};
   await session.abortTransaction().catch(()=>{});
  }
 }finally{await session.endSession();}
 const readback=await c.findOne({executionId:"B"});
 const facts={court:"candidate-reference-unique-index-physical-collision",classification:"real MongoDB index error only; separate executions, no production stageCandidate or stale lease",observed,matchingExecutionReadback:!!readback,count:await c.countDocuments({})};
 console.log(JSON.stringify(facts));
 assert.equal(facts.count,1);
 assert.equal(observed.status,"rejected");
 assert.equal(readback,null);
}finally{await client.close();}
