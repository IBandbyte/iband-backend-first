import assert from "node:assert/strict";
import mongoose from "mongoose";
import {MOVIE_MENTOR_PROJECT_OWNERSHIP_COLLECTION} from "../ai/MovieMentorProjectOwnershipRegistry.js";

// Isolated protocol feasibility court, NOT production acceptance certification.
// Demonstrates a conditional ownership-document write in a transaction can
// serialize against a direct MongoDB ownership mutation. No production access.
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(uri&&/127\.0\.0\.1|localhost/.test(uri),"Isolated localhost replica set required.");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
try{
 const client=mongoose.connection.getClient(),db=mongoose.connection.db;
 const ownership=db.collection(MOVIE_MENTOR_PROJECT_OWNERSHIP_COLLECTION);
 await ownership.createIndex({projectId:1},{unique:true});
 for(const order of ["revocation-first","acceptance-first"]){
  const projectId="isolated-ownership-protocol-"+order;
  await ownership.insertOne({projectId,ownerPrincipalId:"owner",ownershipReference:"ref",ownershipRevision:1,status:"active",fenceEpoch:0});
  const session=client.startSession();
  try{
   if(order==="revocation-first"){
    const changed=await ownership.updateOne({projectId},{$set:{ownerPrincipalId:"other",ownershipRevision:2,status:"revoked"}});
    assert.equal(changed.modifiedCount,1);
    await session.withTransaction(async()=>{
     const fenced=await ownership.updateOne({projectId,ownerPrincipalId:"owner",ownershipRevision:1,status:"active"},{$inc:{fenceEpoch:1}},{session});
     assert.equal(fenced.matchedCount,0,"Revoked owner must not acquire ownership write fence.");
    });
    const after=await ownership.findOne({projectId});
    assert.equal(after.ownerPrincipalId,"other");
    assert.equal(after.fenceEpoch,0);
   }else{
    await session.startTransaction({readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});
    const fenced=await ownership.updateOne({projectId,ownerPrincipalId:"owner",ownershipRevision:1,status:"active"},{$inc:{fenceEpoch:1}},{session});
    assert.equal(fenced.matchedCount,1,"Original owner must acquire transactional ownership write fence.");
    // A direct-driver mutation cannot silently commit before the active
    // transaction holding this document's write conflict resolves.
    let resolved=false;
    const mutation=ownership.updateOne({projectId},{$set:{ownerPrincipalId:"other",ownershipRevision:2,status:"revoked"}}).then(x=>{resolved=true;return x;});
    await new Promise(resolve=>setTimeout(resolve,120));
    assert.equal(resolved,false,"Concurrent ownership mutation must wait for the ownership write fence.");
    await session.commitTransaction();
    const changed=await mutation;
    assert.equal(changed.modifiedCount,1);
    const after=await ownership.findOne({projectId});
    assert.equal(after.ownerPrincipalId,"other");
    assert.equal(after.fenceEpoch,1);
   }
   console.log("GREEN isolated ownership write-conflict protocol:",order);
  }finally{if(session.inTransaction())await session.abortTransaction();await session.endSession();}
 }
 console.log("LIMITATION: feasibility only; production adapter, credential permissions, and complete creator-state acceptance remain uncertified.");
}finally{await mongoose.disconnect();}
