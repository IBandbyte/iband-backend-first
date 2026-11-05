import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMongoCreatorStateAtomicAccept} from "../ai/MovieMentorCreatorStateMongoOperationAdapter.js";
// Characterization, NOT certification: process-local authority can flip after
// the durable fence. This deliberately records the distinction from a durable
// ownership mutation and must not replace the original postcheck RED court.
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\//.test(uri),"Isolated localhost Mongo replica set required.");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
try{
 const db=mongoose.connection.db,states=db.collection("isolated_late_local_flip_states"),operations=db.collection("isolated_late_local_flip_operations"),ownerships=db.collection("movie_mentor_project_ownership");
 const projectId="isolated-late-local-flip";
 await states.createIndex({projectId:1},{unique:true});
 await operations.createIndex({projectId:1,principalId:1,operationId:1},{unique:true});
 await ownerships.createIndex({projectId:1},{unique:true});
 await ownerships.insertOne({projectId,ownerPrincipalId:"owner",ownershipReference:"ref-v1",ownershipRevision:1,status:"active"});
 let active=true,flipped=false;
 const authority={domain:"iband.movie-mentor.creator-state-mutation-authority",schema:1,principalId:"owner",projectId,assertCurrentMutation:async target=>({domain:"iband.movie-mentor.creator-state-mutation-proof",schema:1,authorized:active,currentOwnershipVerified:active,principalId:"owner",projectId,ownershipRef:"ref-v1",ownershipRevision:1,...target})};
 const instrumentedStates={indexes:(...a)=>states.indexes(...a),findOne:(...a)=>states.findOne(...a),replaceOne:(...a)=>{active=false;flipped=true;return states.replaceOne(...a);}};
 const accept=createMongoCreatorStateAtomicAccept({client:mongoose.connection.getClient(),states:instrumentedStates,operations,ownerships});
 const outcome=await accept({envelope:{projectId,principalId:"owner",operationId:"late-flip",source:"creator-memory",expectedRevision:0,requestDigest:"late-flip"},proposedState:{projectId,revision:1,creatorStateGeneration:1,creatorStateFingerprint:"late-flip",revisionAuthorityReference:"revision",creatorAuthorityReference:"creator",snapshotReference:"snapshot",capturedAt:new Date("2026-11-04T00:00:00Z")},creatorStateMutationAuthority:authority});
 assert.equal(flipped,true);
 assert.equal(outcome.kind,"accepted","Characterization: process-local flip after fence does not revoke durable ownership.");
 assert.equal(await states.countDocuments({projectId}),1);
 assert.equal(await operations.countDocuments({projectId}),1);
 assert.equal((await ownerships.findOne({projectId})).status,"active");
 console.log("GREEN CHARACTERIZATION ONLY: late process-local flag flip does not mutate durable ownership; acceptance commits.");
 console.log("NOT CERTIFIED: original postcheck RED requires a separate authority/linearization contract decision.");
}finally{await mongoose.disconnect();}
