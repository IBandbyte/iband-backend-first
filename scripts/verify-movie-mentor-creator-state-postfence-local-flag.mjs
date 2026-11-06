import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMongoCreatorStateAtomicAccept} from "../ai/MovieMentorCreatorStateMongoOperationAdapter.js";

// Characterization only: the original RED is untouched. A local flag change at the final write is not durable revocation.
// No production credentials, route, or collection are used.
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(uri&&/127\.0\.0\.1|localhost/.test(uri),"Isolated localhost replica set required.");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
try{
 const db=mongoose.connection.db,states=db.collection("isolated_postfence_local_state"),operations=db.collection("isolated_postfence_local_ops"),ownerships=db.collection("movie_mentor_project_ownership");
 await states.createIndex({projectId:1},{unique:true});
 await operations.createIndex({projectId:1,principalId:1,operationId:1},{unique:true});
 await ownerships.createIndex({projectId:1},{unique:true});
 await ownerships.insertOne({projectId:"postfence-local-project",ownerPrincipalId:"owner",ownershipReference:"ownership-v1",ownershipRevision:1,status:"active"});
 let active=true;let flagChangedAtFinalWrite=false;
 const proof={domain:"iband.movie-mentor.creator-state-mutation-authority",schema:1,principalId:"owner",projectId:"postfence-local-project",assertCurrentMutation:async target=>({domain:"iband.movie-mentor.creator-state-mutation-proof",schema:1,authorized:active,currentOwnershipVerified:active,principalId:"owner",projectId:"postfence-local-project",ownershipRef:"ownership-v1",ownershipRevision:1,...target})};
 const instrumentedStates={indexes:(...args)=>states.indexes(...args),findOne:(...args)=>states.findOne(...args),replaceOne:(...args)=>{active=false;flagChangedAtFinalWrite=true;return states.replaceOne(...args);}};
 const accept=createMongoCreatorStateAtomicAccept({client:mongoose.connection.getClient(),states:instrumentedStates,operations,ownerships});
 const pending=accept({envelope:{projectId:"postfence-local-project",principalId:"owner",operationId:"postfence-local-op",source:"creator-memory",expectedRevision:0,requestDigest:"fenced-digest"},proposedState:{projectId:"postfence-local-project",revision:1,creatorStateGeneration:1,creatorStateFingerprint:"fenced-fingerprint",revisionAuthorityReference:"fence-revision",creatorAuthorityReference:"fence-authority",snapshotReference:"fence-snapshot",capturedAt:new Date("2026-11-04T00:00:00.000Z")},creatorStateMutationAuthority:proof});
 const outcome=await pending;
 assert.equal(flagChangedAtFinalWrite,true,"Local flag must flip at the final write boundary.");
 assert.equal(active,false,"Local authority must now report inactive.");
 assert.equal(outcome?.kind,"accepted","Post-fence process-local flag alone must not be treated as a durable revocation.");
 assert.equal(await states.countDocuments({projectId:"postfence-local-project"}),1,"Fenced transaction must commit one creator-state record.");
 assert.equal(await operations.countDocuments({projectId:"postfence-local-project"}),1,"Fenced transaction must commit one operation.");
 const durable=await ownerships.findOne({projectId:"postfence-local-project"});
 assert.equal(durable.ownershipRevision,1,"No durable ownership revision change was performed.");
 assert.equal(durable.status,"active","Durable ownership remains active.");
 assert.equal(durable.creatorStateFenceEpoch,1,"Durable fence must have been acquired.");
 console.log("GREEN: process-local flag flipped after durable fence; ownership unchanged; accepted transaction committed exactly once.");
}finally{await mongoose.disconnect();}
