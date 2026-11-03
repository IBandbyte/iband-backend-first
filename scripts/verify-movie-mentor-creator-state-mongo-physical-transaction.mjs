import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMongoCreatorStateAtomicAccept} from "../ai/MovieMentorCreatorStateMongoOperationAdapter.js";

const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(uri&&/127\.0\.0\.1|localhost/.test(uri),"Isolated local MongoDB URI required; never run against production.");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
const db=mongoose.connection.db,states=db.collection("isolated_creator_state"),operations=db.collection("isolated_creator_operations");
try{
 await states.createIndex({projectId:1},{unique:true});
 await operations.createIndex({projectId:1,principalId:1,operationId:1},{unique:true});
 const accept=createMongoCreatorStateAtomicAccept({client:mongoose.connection.getClient(),states,operations});
 const make=(id,expectedRevision)=>({envelope:{projectId:"physical-project",principalId:"owner",operationId:id,source:"creator-memory",expectedRevision,requestDigest:"digest-"+id},proposedState:{projectId:"physical-project",revision:expectedRevision+1,memoryContext:{id}}});
 const first=await accept(make("one",0));
 assert.equal(first.kind,"accepted");
 const replay=await accept(make("one",0));
 assert.equal(replay.kind,"replay");assert.deepEqual(replay.result,first.result);
 const collision=await accept({...make("one",0),envelope:{...make("one",0).envelope,requestDigest:"different"}});
 assert.equal(collision.kind,"conflict");
 const contenders=await Promise.allSettled([accept(make("two",1)),accept(make("three",1))]);
 const accepted=contenders.filter(x=>x.status==="fulfilled"&&x.value.kind==="accepted");
 assert.equal(accepted.length,1,"Only one distinct operation may win revision 2.");
 const current=await states.findOne({projectId:"physical-project"});
 assert.equal(current.revision,2);
 assert.equal(await operations.countDocuments({projectId:"physical-project"}),2);
 const winner=accepted[0].value.result.memoryContext.id;
 const restarted=createMongoCreatorStateAtomicAccept({client:mongoose.connection.getClient(),states,operations});
 const recovered=await restarted(make(winner,1));
 assert.equal(recovered.kind,"replay");assert.equal(recovered.result.revision,2);
 assert.equal(await operations.countDocuments({projectId:"physical-project"}),2);
 console.log("GREEN: real isolated replica-set transaction persisted two revisions, refused duplicate effect, and recovered replay using fresh adapter.");
}finally{await mongoose.disconnect();}
