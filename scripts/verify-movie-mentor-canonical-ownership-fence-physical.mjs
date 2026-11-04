import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMongoCreatorStateAtomicAccept} from "../ai/MovieMentorCreatorStateMongoOperationAdapter.js";
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(uri&&/127\.0\.0\.1|localhost/.test(uri),"Local isolated replica set required.");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
try{
 const client=mongoose.connection.getClient(),db=mongoose.connection.db;
 const states=db.collection("isolated_canonical_fence_states"),operations=db.collection("isolated_canonical_fence_operations"),ownerships=db.collection("movie_mentor_project_ownership");
 await states.createIndex({projectId:1},{unique:true});
 await operations.createIndex({projectId:1,principalId:1,operationId:1},{unique:true});
 await ownerships.createIndex({projectId:1},{unique:true});
 for(const order of ["valid-owner","revoked-before-accept"]){
  const projectId="canonical-fence-"+order;
  await ownerships.insertOne({projectId,ownerPrincipalId:"owner",ownershipReference:"ref-v1",ownershipRevision:1,status:"active"});
  if(order==="revoked-before-accept")await ownerships.updateOne({projectId},{$set:{ownerPrincipalId:"other",ownershipRevision:2,status:"revoked"}});
  const authority={domain:"iband.movie-mentor.creator-state-mutation-authority",schema:1,principalId:"owner",projectId,assertCurrentMutation:async target=>({domain:"iband.movie-mentor.creator-state-mutation-proof",schema:1,authorized:true,currentOwnershipVerified:true,principalId:"owner",projectId,ownershipRef:"ref-v1",ownershipRevision:1,...target})};
  const accept=createMongoCreatorStateAtomicAccept({client,states,operations,ownerships});
  let result=null,failure=null;
  try{result=await accept({envelope:{projectId,principalId:"owner",operationId:"operation",source:"creator-memory",expectedRevision:0,requestDigest:"digest"},proposedState:{projectId,revision:1,creatorStateGeneration:1,creatorStateFingerprint:"fingerprint",revisionAuthorityReference:"rev",creatorAuthorityReference:"creator",snapshotReference:"snapshot",capturedAt:new Date("2026-11-04T00:00:00Z")},creatorStateMutationAuthority:authority});}catch(e){failure=e;}
  if(order==="valid-owner"){
   assert.equal(result?.kind,"accepted","Valid canonical owner should atomically accept.");
   assert.equal(await states.countDocuments({projectId}),1);
   assert.equal(await operations.countDocuments({projectId}),1);
   assert.equal((await ownerships.findOne({projectId})).creatorStateFenceEpoch,1);
  }else{
   assert.equal(result,null,"Revoked owner must never accept.");
   assert.equal(failure?.code,"MOVIE_MENTOR_CREATOR_STATE_OWNERSHIP_CHANGED");
   assert.equal(await states.countDocuments({projectId}),0);
   assert.equal(await operations.countDocuments({projectId}),0);
  }
  console.log("GREEN canonical physical ownership fence:",order);
 }
 console.log("LIMITATION: sequential canonical physical court; concurrent race, production credentials and HTTP mount not certified.");
}finally{await mongoose.disconnect();}
