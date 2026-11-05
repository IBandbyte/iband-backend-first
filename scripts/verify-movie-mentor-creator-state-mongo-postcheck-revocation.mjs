import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMongoCreatorStateAtomicAccept} from "../ai/MovieMentorCreatorStateMongoOperationAdapter.js";

// RED-first: physically coordinate ownership revocation after the post-read mutation-authority recheck, at the final Mongo write boundary.
// No production credentials, route, or collection are used.
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(uri&&/127\.0\.0\.1|localhost/.test(uri),"Isolated localhost replica set required.");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
try{
 const db=mongoose.connection.db,states=db.collection("isolated_postcheck_fence_state"),operations=db.collection("isolated_postcheck_fence_ops"),ownerships=db.collection("movie_mentor_project_ownership");
 await states.createIndex({projectId:1},{unique:true});
 await operations.createIndex({projectId:1,principalId:1,operationId:1},{unique:true});
 await ownerships.createIndex({projectId:1},{unique:true});
 await ownerships.insertOne({projectId:"fence-project",ownerPrincipalId:"owner",ownershipReference:"ownership-v1",ownershipRevision:1,status:"active"});
 let active=true;
 const proof={domain:"iband.movie-mentor.creator-state-mutation-authority",schema:1,principalId:"owner",projectId:"fence-project",assertCurrentMutation:async target=>({domain:"iband.movie-mentor.creator-state-mutation-proof",schema:1,authorized:active,currentOwnershipVerified:active,principalId:"owner",projectId:"fence-project",ownershipRef:"ownership-v1",ownershipRevision:1,...target})};
 const instrumentedStates={indexes:(...args)=>states.indexes(...args),findOne:(...args)=>states.findOne(...args),replaceOne:(...args)=>{active=false;return states.replaceOne(...args);}};
 const accept=createMongoCreatorStateAtomicAccept({client:mongoose.connection.getClient(),states:instrumentedStates,operations,ownerships});
 const pending=accept({envelope:{projectId:"fence-project",principalId:"owner",operationId:"fenced",source:"creator-memory",expectedRevision:0,requestDigest:"fenced-digest"},proposedState:{projectId:"fence-project",revision:1,creatorStateGeneration:1,creatorStateFingerprint:"fenced-fingerprint",revisionAuthorityReference:"fence-revision",creatorAuthorityReference:"fence-authority",snapshotReference:"fence-snapshot",capturedAt:new Date("2026-11-04T00:00:00.000Z")},creatorStateMutationAuthority:proof});
 let outcome=null,reason=null;
 try{outcome=await pending;}catch(error){reason=error;}
 assert.notEqual(outcome?.kind,"accepted","RED: revoked owner must never receive accepted result");
 assert.equal(await states.countDocuments({projectId:"fence-project"}),0,"RED: revoked owner must not commit creator state");
 assert.equal(await operations.countDocuments({projectId:"fence-project"}),0,"RED: revoked owner must not claim operation");
 assert.equal(reason?.code,"MOVIE_MENTOR_CREATOR_STATE_OWNERSHIP_CHANGED","RED: ownership revocation must return explicit fence denial");
 console.log("GREEN: post-recheck revocation at the write boundary denied with zero durable effects.");
}finally{await mongoose.disconnect();}
