import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMongoCreatorStateAtomicAccept} from "../ai/MovieMentorCreatorStateMongoOperationAdapter.js";

// Physical competing Mongo ownership write at the final creator-state write boundary.
// This does not modify the original postcheck RED verifier or use production data.
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(uri),"Disposable localhost MongoDB required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
try{
 const db=mongoose.connection.db;
 const states=db.collection("isolated_durable_race_states");
 const operations=db.collection("isolated_durable_race_operations");
 const ownerships=db.collection("movie_mentor_project_ownership");
 await states.createIndex({projectId:1},{unique:true});
 await operations.createIndex({projectId:1,principalId:1,operationId:1},{unique:true});
 await ownerships.createIndex({projectId:1},{unique:true});
 const projectId="durable-write-race-"+Date.now();
 await ownerships.insertOne({projectId,ownerPrincipalId:"owner",ownershipReference:"ownership-v1",ownershipRevision:1,status:"active"});
 let revoked=false,writeBoundaryReached=false;
 const authority={domain:"iband.movie-mentor.creator-state-mutation-authority",schema:1,principalId:"owner",projectId,
  assertCurrentMutation:async target=>({domain:"iband.movie-mentor.creator-state-mutation-proof",schema:1,authorized:true,currentOwnershipVerified:true,principalId:"owner",projectId,ownershipRef:"ownership-v1",ownershipRevision:1,...target})};
 const instrumentedStates={
  indexes:(...args)=>states.indexes(...args),
  findOne:(...args)=>states.findOne(...args),
  replaceOne:async(...args)=>{
   writeBoundaryReached=true;
   if(!revoked){
    const result=await ownerships.updateOne({projectId,ownershipRevision:1},{$set:{ownerPrincipalId:"new-owner",ownershipReference:"ownership-v2",ownershipRevision:2}});
    assert.equal(result.matchedCount,1,"competing ownership revocation must physically commit");
    revoked=true;
   }
   return states.replaceOne(...args);
  }
 };
 const accept=createMongoCreatorStateAtomicAccept({client:mongoose.connection.getClient(),states:instrumentedStates,operations,ownerships});
 let outcome=null,reason=null;
 try{
  outcome=await accept({envelope:{projectId,principalId:"owner",operationId:"write-boundary-race",source:"creator-memory",expectedRevision:0,requestDigest:"durable-race-digest"},
   proposedState:{projectId,revision:1,creatorStateGeneration:1,creatorStateFingerprint:"race-fingerprint",revisionAuthorityReference:"race-revision",creatorAuthorityReference:"race-authority",snapshotReference:"race-snapshot",capturedAt:new Date("2026-11-08T00:00:00.000Z")},
   creatorStateMutationAuthority:authority});
 }catch(error){reason=error;}
 assert.equal(writeBoundaryReached,true,"must physically reach final state write boundary");
 assert.equal(revoked,true,"competing Mongo ownership revocation must commit");
 assert.notEqual(outcome?.kind,"accepted","revoked owner cannot receive accepted result");
 assert.equal(await states.countDocuments({projectId}),0,"revoked owner must not persist creator state");
 assert.equal(await operations.countDocuments({projectId}),0,"revoked owner must not claim operation");
 const durable=await ownerships.findOne({projectId});
 assert.equal(durable.ownerPrincipalId,"new-owner");
 assert.equal(durable.ownershipRevision,2);
 assert.ok(reason,"write conflict or explicit ownership denial required");
 console.log("GREEN PHYSICAL DURABLE WRITE-BOUNDARY RACE: competing Mongo ownership revocation committed; creator state and operation remained absent; acceptance denied; error="+String(reason.code||reason.name));
}finally{await mongoose.disconnect();}
