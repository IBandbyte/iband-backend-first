import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMongoCreatorStateAtomicAccept} from "../ai/MovieMentorCreatorStateMongoOperationAdapter.js";

// RED-first integration contract: an adapter must preserve existing creator-state
// authority fields and the durable store's strict schema, not merely a test record.
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(uri&&/127\.0\.0\.1|localhost/.test(uri),"Local isolated replica-set URI required.");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
try{
 const db=mongoose.connection.db,states=db.collection("isolated_schema_creator_state"),operations=db.collection("isolated_schema_creator_operations");
 await states.createIndex({projectId:1},{unique:true});
 await operations.createIndex({projectId:1,principalId:1,operationId:1},{unique:true});
 const accept=createMongoCreatorStateAtomicAccept({client:mongoose.connection.getClient(),states,operations});
 const capturedAt=new Date().toISOString(),transitionId="isolated-transition";
 const proposedState={projectId:"schema-project",creatorSessionId:"schema-session",revision:1,revisionAuthorityReference:"movie-mentor:revision:1:"+transitionId,creatorStateGeneration:1,creatorStateFingerprint:"a".repeat(64),creatorAuthorityReference:"movie-mentor:creator-state:1:"+transitionId,snapshotReference:"movie-mentor:snapshot:1:"+ "a".repeat(24),creatorConfirmedContext:[],projectJourney:null,memoryContext:{projectMemories:[{id:"schema"}]},responseBlueprint:null,communicationPlan:null,capturedAt,transition:{id:transitionId,source:"creator-memory",expectedRevision:0}};
 const envelope={projectId:proposedState.projectId,principalId:"schema-owner",operationId:"schema-op",source:"creator-memory",expectedRevision:0,requestDigest:"schema-digest"};
 const accepted=await accept({envelope,proposedState});
 assert.equal(accepted.kind,"accepted");
 const doc=await states.findOne({projectId:envelope.projectId});
 for(const field of ["revisionAuthorityReference","creatorStateGeneration","creatorStateFingerprint","creatorAuthorityReference","snapshotReference","capturedAt"])assert.ok(doc[field],field+" must survive atomic write");
 const replay=await accept({envelope,proposedState});
 assert.equal(replay.kind,"replay");assert.deepEqual(replay.result,accepted.result);
 // Security requirement: the adapter must NOT accept an arbitrary state assembled
 // without validated current ownership and exact mutation authority.
 await assert.rejects(
  ()=>accept({envelope:{...envelope,projectId:"unauthorized-project",operationId:"unauthorized-op"},proposedState:{...proposedState,projectId:"unauthorized-project"}}),
  e=>e.code==="MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_REQUIRED",
  "RED: Mongo adapter must require exact server-created mutation authority before irreversible write"
 );
 assert.equal(await states.countDocuments({projectId:"unauthorized-project"}),0);
 console.log("GREEN: transactional store preserves authority fields and rejects unauthorized direct writes.");
}finally{await mongoose.disconnect();}
