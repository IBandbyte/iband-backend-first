import assert from "node:assert/strict";
import { MongoClient } from "mongodb";
// Genuine MongoDB index-collision ordering probe, not production-store exploit evidence.
const uri=process.env.MONGO_URI;
assert.equal(uri,"mongodb://127.0.0.1:27017/iband_candidate_index_collision");
const client=new MongoClient(uri,{serverSelectionTimeoutMS:10000});
await client.connect();
try{
 const c=client.db().collection("candidate_index_collision_court");
 await c.createIndex({executionId:1},{unique:true});
 const a=client.startSession(),b=client.startSession();
 let observed;
 try{
  a.startTransaction({readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});
  b.startTransaction({readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});
  const firstRead=await c.findOne({executionId:"E"},{session:a});
  const secondRead=await c.findOne({executionId:"E"},{session:b});
  assert.equal(firstRead,null);assert.equal(secondRead,null);
  await c.insertOne({executionId:"E",resultDigest:"same"},{session:a});
  await a.commitTransaction();
  try{
   await c.insertOne({executionId:"E",resultDigest:"same"},{session:b});
   await b.commitTransaction();
   observed={status:"committed"};
  }catch(error){
   observed={status:"rejected",code:error.code??null,codeName:error.codeName??null,labels:error.errorLabels??[]};
   await b.abortTransaction().catch(()=>{});
  }
 }finally{await a.endSession();await b.endSession();}
 const count=await c.countDocuments({executionId:"E"});
 console.log(JSON.stringify({court:"candidate-genuine-unique-index-collision-ordering",classification:"isolated physical MongoDB index collision only; no production store or lease claim",observed,count}));
 assert.equal(count,1);
 assert.equal(observed.status,"rejected");
}finally{await client.close();}
