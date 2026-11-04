import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMongoCreatorStateAtomicAccept} from "../ai/MovieMentorCreatorStateMongoOperationAdapter.js";
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(uri&&/127\.0\.0\.1|localhost/.test(uri),"Isolated localhost replica set required.");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
try{
 const db=mongoose.connection.db,client=mongoose.connection.getClient();
 const states=db.collection("isolated_canonical_overlap_states"),operations=db.collection("isolated_canonical_overlap_operations"),ownerships=db.collection("movie_mentor_project_ownership");
 await states.createIndex({projectId:1},{unique:true});
 await operations.createIndex({projectId:1,principalId:1,operationId:1},{unique:true});
 await ownerships.createIndex({projectId:1},{unique:true});
 const projectId="isolated-canonical-overlap";
 await ownerships.insertOne({projectId,ownerPrincipalId:"owner",ownershipReference:"ref-v1",ownershipRevision:1,status:"active"});
 let revocationPromise=null,revocationResolved=false,overlapObserved=false;
 const instrumentedStates={indexes:(...args)=>states.indexes(...args),findOne:(...args)=>states.findOne(...args),replaceOne:async(...args)=>{
  revocationPromise=ownerships.updateOne({projectId},{$set:{ownerPrincipalId:"other",ownershipRevision:2,status:"revoked"}},{maxTimeMS:10000}).then(value=>{revocationResolved=true;return value;});
  await new Promise(resolve=>setTimeout(resolve,150));
  overlapObserved=true;
  assert.equal(revocationResolved,false,"Direct ownership mutation must not commit while acceptance holds transactional fence.");
  return states.replaceOne(...args);
 }};
 const authority={domain:"iband.movie-mentor.creator-state-mutation-authority",schema:1,principalId:"owner",projectId,assertCurrentMutation:async target=>({domain:"iband.movie-mentor.creator-state-mutation-proof",schema:1,authorized:true,currentOwnershipVerified:true,principalId:"owner",projectId,ownershipRef:"ref-v1",ownershipRevision:1,...target})};
 const accept=createMongoCreatorStateAtomicAccept({client,states:instrumentedStates,operations,ownerships});
 const outcome=await accept({envelope:{projectId,principalId:"owner",operationId:"overlap",source:"creator-memory",expectedRevision:0,requestDigest:"overlap-digest"},proposedState:{projectId,revision:1,creatorStateGeneration:1,creatorStateFingerprint:"fingerprint",revisionAuthorityReference:"revision",creatorAuthorityReference:"creator",snapshotReference:"snapshot",capturedAt:new Date("2026-11-04T00:00:00Z")},creatorStateMutationAuthority:authority});
 assert.equal(overlapObserved,true);
 assert.equal(outcome?.kind,"accepted");
 assert.equal((await revocationPromise).modifiedCount,1);
 assert.equal(await states.countDocuments({projectId}),1);
 assert.equal(await operations.countDocuments({projectId}),1);
 const after=await ownerships.findOne({projectId});
 assert.equal(after.creatorStateFenceEpoch,1);
 assert.equal(after.status,"revoked");
 console.log("GREEN: canonical adapter transaction serialized concurrent direct Mongo ownership mutation until acceptance committed.");
 console.log("LIMITATION: acceptance-first overlap only; original adversarial race courts and production mount remain separate.");
}finally{await mongoose.disconnect();}
