import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMongoCreatorStateAtomicAccept} from "../ai/MovieMentorCreatorStateMongoOperationAdapter.js";
import {MOVIE_MENTOR_PROJECT_OWNERSHIP_COLLECTION} from "../ai/MovieMentorProjectOwnershipRegistry.js";

// RED-first physical court. A direct-driver ownership mutation is a privileged
// adversarial test action, NOT a supported production ownership-transfer API.
// Revoke durably after the last authority check and before creator-state write.
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(uri&&/127\.0\.0\.1|localhost/.test(uri),"Isolated localhost replica set required.");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
try{
 const db=mongoose.connection.db,states=db.collection("isolated_durable_ownership_race_state"),operations=db.collection("isolated_durable_ownership_race_ops"),ownership=db.collection(MOVIE_MENTOR_PROJECT_OWNERSHIP_COLLECTION);
 const projectId="isolated-durable-race";
 await states.createIndex({projectId:1},{unique:true});
 await operations.createIndex({projectId:1,principalId:1,operationId:1},{unique:true});
 await ownership.createIndex({projectId:1},{unique:true});
 await ownership.insertOne({projectId,ownerPrincipalId:"owner",ownershipReference:"ownership-v1",ownershipRevision:1,status:"active",establishmentAuthorityId:"isolated-mint",establishmentSource:"isolated-court"});
 let authorityChecks=0,revocationCount=0;
 const proof={domain:"iband.movie-mentor.creator-state-mutation-authority",schema:1,principalId:"owner",projectId,assertCurrentMutation:async target=>{
  authorityChecks++;
  const current=await ownership.findOne({projectId});
  const valid=current?.ownerPrincipalId==="owner"&&current?.ownershipReference==="ownership-v1"&&current?.ownershipRevision===1&&current?.status==="active";
  return {domain:"iband.movie-mentor.creator-state-mutation-proof",schema:1,authorized:valid,currentOwnershipVerified:valid,principalId:"owner",projectId,ownershipRef:"ownership-v1",ownershipRevision:1,...target};
 }};
 const instrumentedStates={
  indexes:(...args)=>states.indexes(...args),
  findOne:(...args)=>states.findOne(...args),
  replaceOne:(...args)=>states.replaceOne(...args)
 };
 const instrumentedOwnership={
  collectionName:MOVIE_MENTOR_PROJECT_OWNERSHIP_COLLECTION,
  updateOne:async(...args)=>{
   assert.ok(authorityChecks>=2,"Revocation must happen after the post-read authority recheck.");
   const changed=await ownership.updateOne({projectId,ownerPrincipalId:"owner",status:"active"},{$set:{ownerPrincipalId:"other-owner",ownershipRevision:2,status:"revoked"}});
   assert.equal(changed.modifiedCount,1,"Adversarial durable revocation must physically commit before the ownership fence.");
   revocationCount++;
   return ownership.updateOne(...args);
  }
 };
 const accept=createMongoCreatorStateAtomicAccept({client:mongoose.connection.getClient(),states:instrumentedStates,operations,ownerships:instrumentedOwnership});
 let outcome=null,reason=null;
 try{
  outcome=await accept({envelope:{projectId,principalId:"owner",operationId:"durable-race",source:"creator-memory",expectedRevision:0,requestDigest:"durable-race-digest"},proposedState:{projectId,revision:1,creatorStateGeneration:1,creatorStateFingerprint:"durable-race-fingerprint",revisionAuthorityReference:"durable-revision",creatorAuthorityReference:"durable-authority",snapshotReference:"durable-snapshot",capturedAt:new Date("2026-11-04T00:00:00.000Z")},creatorStateMutationAuthority:proof});
 }catch(error){reason=error;}
 assert.equal(revocationCount,1,"Physical durable ownership mutation must occur exactly once.");
 assert.notEqual(outcome?.kind,"accepted","RED: durable ownership change after authority check must not commit creator state.");
 assert.equal(await states.countDocuments({projectId}),0,"RED: no creator-state write after durable ownership change.");
 assert.equal(await operations.countDocuments({projectId}),0,"RED: no operation ledger claim after durable ownership change.");
 assert.equal(reason?.code,"MOVIE_MENTOR_CREATOR_STATE_OWNERSHIP_CHANGED","RED: durable ownership race must fail closed with ownership-changed denial.");
 console.log("GREEN: durable Mongo ownership mutation before creator-state write caused fail-closed denial with no durable creator effects.");
}finally{await mongoose.disconnect();}
