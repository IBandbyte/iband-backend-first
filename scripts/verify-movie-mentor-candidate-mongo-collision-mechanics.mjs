import assert from "node:assert/strict";
import { MongoClient } from "mongodb";

// Isolated MongoDB transaction collision mechanics, not a production-store exploit court.
// No injected duplicate-key exceptions: all error codes come from mongod.
const uri=process.env.MONGO_URI;
assert.equal(uri,"mongodb://127.0.0.1:27017/iband_candidate_collision_mechanics");
const client=new MongoClient(uri,{serverSelectionTimeoutMS:10000});
await client.connect();
try{
 const db=client.db(), candidates=db.collection("movie_mentor_result_candidate_collision_court");
 const executions=db.collection("movie_mentor_inference_execution_collision_court");
 const creators=db.collection("movie_mentor_creator_state_collision_court");
 await Promise.all([candidates.createIndex({executionId:1},{unique:true}),executions.createIndex({executionId:1},{unique:true}),creators.createIndex({projectId:1},{unique:true})]);
 await executions.insertOne({executionId:"E",ownerId:"A",leaseGeneration:1,barrier:0});
 await creators.insertOne({projectId:"P",revision:7,barrier:0});
 const first=client.startSession(),second=client.startSession();
 let secondRead,secondOutcome,firstOutcome;
 try{
  first.startTransaction({readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});
  second.startTransaction({readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});
  await candidates.findOne({executionId:"E"},{session:first});
  secondRead=await candidates.findOne({executionId:"E"},{session:second});
  await creators.updateOne({projectId:"P",revision:7},{$inc:{barrier:1}},{session:first});
  await executions.updateOne({executionId:"E",ownerId:"A",leaseGeneration:1},{$inc:{barrier:1}},{session:first});
  await candidates.insertOne({executionId:"E",digest:"same"},{session:first});
  await first.commitTransaction();firstOutcome="committed";
  // Simulate takeover only after the first candidate is durably committed.
  await executions.updateOne({executionId:"E"},{$set:{ownerId:"B",leaseGeneration:2}});
  try{
   await creators.updateOne({projectId:"P",revision:7},{$inc:{barrier:1}},{session:second});
   await executions.updateOne({executionId:"E",ownerId:"A",leaseGeneration:1},{$inc:{barrier:1}},{session:second});
   await candidates.insertOne({executionId:"E",digest:"same"},{session:second});
   await second.commitTransaction();secondOutcome={status:"committed"};
  }catch(error){
   secondOutcome={status:"rejected",code:error.code??null,codeName:error.codeName??null,labels:typeof error.errorLabels?.values==="function"?Array.from(error.errorLabels):error.errorLabels??[]};
   await second.abortTransaction().catch(()=>{});
  }
 }finally{await first.endSession();await second.endSession();}
 const candidate=await candidates.findOne({executionId:"E"}),execution=await executions.findOne({executionId:"E"});
 const facts={court:"candidate-real-mongodb-collision-mechanics",classification:"physical MongoDB transaction collision; not production store and not a production defect verdict",firstOutcome,secondSnapshotCandidatePresent:!!secondRead,secondOutcome,candidateCount:await candidates.countDocuments({executionId:"E"}),currentOwner:execution.ownerId,currentLeaseGeneration:execution.leaseGeneration,candidateDigest:candidate?.digest??null};
 console.log(JSON.stringify(facts));
 assert.equal(firstOutcome,"committed");
 assert.equal(facts.candidateCount,1);
 assert.equal(facts.currentOwner,"B");
 assert.equal(secondOutcome.status,"rejected","stale snapshot must not commit a second candidate");
}finally{await client.close();}
