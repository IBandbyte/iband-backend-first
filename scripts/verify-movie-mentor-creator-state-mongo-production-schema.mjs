import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMongoCreatorStateAtomicAccept} from "../ai/MovieMentorCreatorStateMongoOperationAdapter.js";

// Physical production-shaped schema court, isolated Mongo only. The adapter
// must not be wired to production until strict Mongoose round-trip is proven.
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(uri&&/127\.0\.0\.1|localhost/.test(uri),"Isolated local Mongo required.");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
try{
 const schema=new mongoose.Schema({
  projectId:{type:String,trim:true,index:true},
  creatorSessionId:{type:String,trim:true,index:true},
  revision:{type:Number,min:0,required:true},
  revisionAuthorityReference:{type:String,trim:true,required:true},
  creatorStateGeneration:{type:Number,min:0,required:true},
  creatorStateFingerprint:{type:String,trim:true,required:true},
  creatorAuthorityReference:{type:String,trim:true,required:true},
  snapshotReference:{type:String,trim:true,required:true},
  creatorConfirmedContext:{type:[mongoose.Schema.Types.Mixed],default:[]},
  projectJourney:{type:mongoose.Schema.Types.Mixed,default:null},
  memoryContext:{type:mongoose.Schema.Types.Mixed,default:null},
  responseBlueprint:{type:mongoose.Schema.Types.Mixed,default:null},
  communicationPlan:{type:mongoose.Schema.Types.Mixed,default:null},
  capturedAt:{type:Date,required:true},
 },{collection:"isolated_production_schema_creator_state",timestamps:true,minimize:false,strict:true});
 schema.index({projectId:1},{unique:true,partialFilterExpression:{projectId:{$type:"string"}}});
 const Model=mongoose.model("IsolatedProductionSchemaCreatorState",schema);
 await Model.createIndexes();
 const states=mongoose.connection.db.collection("isolated_production_schema_creator_state");
 const operations=mongoose.connection.db.collection("isolated_production_schema_creator_operations");
 await operations.createIndex({projectId:1,principalId:1,operationId:1},{unique:true});
 const accept=createMongoCreatorStateAtomicAccept({client:mongoose.connection.getClient(),states,operations});
 const envelope={projectId:"schema-project",principalId:"owner",operationId:"schema-commit",source:"creator-memory",expectedRevision:0,requestDigest:"schema-request"};
 const proposedState={projectId:envelope.projectId,creatorSessionId:"session",revision:1,revisionAuthorityReference:"revision-1",creatorStateGeneration:1,creatorStateFingerprint:"fingerprint-1",creatorAuthorityReference:"authority-1",snapshotReference:"snapshot-1",creatorConfirmedContext:[{id:"confirmed"}],projectJourney:{step:1},memoryContext:{projectMemories:[{id:"memory"}]},responseBlueprint:null,communicationPlan:null,capturedAt:new Date("2026-11-04T00:00:00.000Z"),transition:{source:"creator-memory",expectedRevision:0}};
 const authority={domain:"iband.movie-mentor.creator-state-mutation-authority",schema:1,principalId:"owner",projectId:envelope.projectId,assertCurrentMutation:async target=>({domain:"iband.movie-mentor.creator-state-mutation-proof",schema:1,authorized:true,currentOwnershipVerified:true,principalId:"owner",projectId:envelope.projectId,ownershipRef:"owner-v1",ownershipRevision:1,...target})};
 const outcome=await accept({envelope,proposedState,creatorStateMutationAuthority:authority});
 assert.equal(outcome.kind,"accepted");
 const raw=await states.findOne({projectId:envelope.projectId});
 assert.equal(raw.revisionAuthorityReference,proposedState.revisionAuthorityReference);
 assert.equal(raw.creatorAuthorityReference,proposedState.creatorAuthorityReference);
 assert.equal(raw.snapshotReference,proposedState.snapshotReference);
 assert.equal(raw.creatorStateFingerprint,proposedState.creatorStateFingerprint);
 assert.ok(raw.capturedAt instanceof Date);
 assert.equal(raw.transition,undefined,"RED: strict production schema must not persist transition metadata");
 assert.ok(raw.createdAt instanceof Date&&raw.updatedAt instanceof Date,"RED: production timestamp semantics required");
 const modelRead=await Model.findOne({projectId:envelope.projectId}).lean().exec();
 assert.equal(modelRead.revision,1);
 assert.deepEqual(modelRead.memoryContext,proposedState.memoryContext);
 console.log("GREEN: transactional write round-trips exact strict production creator-state schema and partial index.");
}finally{await mongoose.disconnect();}
