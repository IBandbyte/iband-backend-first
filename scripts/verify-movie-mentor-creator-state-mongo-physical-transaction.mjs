import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMongoCreatorStateAtomicAccept} from "../ai/MovieMentorCreatorStateMongoOperationAdapter.js";

const authorityFor=({envelope,proposedState})=>({domain:"iband.movie-mentor.creator-state-mutation-authority",schema:1,principalId:envelope.principalId,projectId:envelope.projectId,assertCurrentMutation:async target=>({domain:"iband.movie-mentor.creator-state-mutation-proof",schema:1,authorized:true,currentOwnershipVerified:true,principalId:envelope.principalId,projectId:envelope.projectId,ownershipRef:"isolated-owner-proof",ownershipRevision:1,...target})});
const withProof=async(adapter,args)=>adapter({...args,creatorStateMutationAuthority:authorityFor(args)});
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(uri&&/127\.0\.0\.1|localhost/.test(uri),"Isolated local MongoDB URI required; never run against production.");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
const db=mongoose.connection.db,states=db.collection("isolated_creator_state"),operations=db.collection("isolated_creator_operations");
try{
 await states.createIndex({projectId:1},{unique:true});
 await operations.createIndex({projectId:1,principalId:1,operationId:1},{unique:true});
 const accept=createMongoCreatorStateAtomicAccept({client:mongoose.connection.getClient(),states,operations});
 const lineage=(id)=>({revisionAuthorityReference:"revision-"+id,creatorAuthorityReference:"authority-"+id,snapshotReference:"snapshot-"+id,capturedAt:new Date("2026-11-04T00:00:00.000Z")});
 const make=(id,expectedRevision)=>({envelope:{projectId:"physical-project",principalId:"owner",operationId:id,source:"creator-memory",expectedRevision,requestDigest:"digest-"+id},proposedState:{projectId:"physical-project",revision:expectedRevision+1,creatorStateGeneration:expectedRevision+1,creatorStateFingerprint:"physical-fingerprint-"+id,memoryContext:{id},...lineage(id)}}});
 const first=await withProof(accept,make("one",0));
 assert.equal(first.kind,"accepted");
 const replay=await withProof(accept,make("one",0));
 assert.equal(replay.kind,"replay");assert.deepEqual(replay.result,first.result);
 const collision=await withProof(accept,{...make("one",0),envelope:{...make("one",0).envelope,requestDigest:"different"}});
 assert.equal(collision.kind,"conflict");
 const contenders=await Promise.allSettled([withProof(accept,make("two",1)),withProof(accept,make("three",1))]);
 const accepted=contenders.filter(x=>x.status==="fulfilled"&&x.value.kind==="accepted");
 assert.equal(accepted.length,1,"Only one distinct operation may win revision 2.");
 const current=await states.findOne({projectId:"physical-project"});
 assert.equal(current.revision,2);
 assert.equal(await operations.countDocuments({projectId:"physical-project"}),2);
 const winner=accepted[0].value.result.memoryContext.id;
 const restarted=createMongoCreatorStateAtomicAccept({client:mongoose.connection.getClient(),states,operations});
 const recovered=await withProof(restarted,make(winner,1));
 assert.equal(recovered.kind,"replay");assert.equal(recovered.result.revision,2);
 assert.equal(await operations.countDocuments({projectId:"physical-project"}),2);
 // Two simultaneous identical first submissions on an independent project.
 const same=(id)=>({envelope:{projectId:"same-key-project",principalId:"owner",operationId:id,source:"creator-memory",expectedRevision:0,requestDigest:"same-digest"},proposedState:{projectId:"same-key-project",revision:1,creatorStateGeneration:1,creatorStateFingerprint:"physical-fingerprint-"+id,memoryContext:{id},...lineage(id)}}});
 const simultaneous=await Promise.allSettled([withProof(accept,same("shared")),withProof(accept,same("shared"))]);
 const sameAccepted=simultaneous.filter(x=>x.status==="fulfilled"&&x.value.kind==="accepted");
 const sameReplay=simultaneous.filter(x=>x.status==="fulfilled"&&x.value.kind==="replay");
 const sameRejected=simultaneous.filter(x=>x.status==="rejected");
 assert.equal(await states.countDocuments({projectId:"same-key-project"}),1,"Duplicate workers must persist only one creator-state record.");
 assert.equal(await operations.countDocuments({projectId:"same-key-project"}),1,"Duplicate workers must persist only one operation claim.");
 assert.equal(sameAccepted.length,1,"Exactly one worker must accept the first submission.");
 assert.equal(sameReplay.length+sameRejected.length,1,"Other worker must replay or receive an explicit transient error.");
 if(sameRejected.length)console.error("CONTENTTION GAP: simultaneous duplicate returned error:",sameRejected[0].reason?.code||sameRejected[0].reason?.message);
 assert.equal(sameReplay.length,1,"Concurrent identical operation must return the committed replay result, not fail with a raw transaction conflict.");
 assert.deepEqual(sameReplay[0].value.result,sameAccepted[0].value.result);
 // The server commits but the transport drops its acknowledgement. The client
 // retries using the identical operation envelope after a new adapter instance
 // and a fresh database connection. No second revision may be created.
 const lost=(id)=>({envelope:{projectId:"lost-ack-project",principalId:"owner",operationId:id,source:"creator-memory",expectedRevision:0,requestDigest:"lost-ack-digest"},proposedState:{projectId:"lost-ack-project",revision:1,creatorStateGeneration:1,creatorStateFingerprint:"physical-fingerprint-"+id,memoryContext:{id},...lineage(id)}}});
 const committed=await withProof(accept,lost("ack-dropped"));
 assert.equal(committed.kind,"accepted");
 const committedState=await states.findOne({projectId:"lost-ack-project"});
 assert.equal(committedState.revision,1);
 // Simulate loss of the response: do not pass committed.result to the retry.
 const separateClient=new mongoose.mongo.MongoClient(uri,{serverSelectionTimeoutMS:10000});
 await separateClient.connect();
 try{
  const newAdapter=createMongoCreatorStateAtomicAccept({client:separateClient,states:separateClient.db().collection("isolated_creator_state"),operations:separateClient.db().collection("isolated_creator_operations")});
  const recoveredAck=await withProof(newAdapter,lost("ack-dropped"));
  assert.equal(recoveredAck.kind,"replay");
  assert.equal(recoveredAck.result.revision,1);
  assert.deepEqual(recoveredAck.result,committed.result);
  assert.equal(await states.countDocuments({projectId:"lost-ack-project"}),1);
  assert.equal(await operations.countDocuments({projectId:"lost-ack-project"}),1);
 }finally{await separateClient.close();}
 console.log("GREEN: lost acknowledgement recovered through independent Mongo client without second authoritative revision.");
 console.log("GREEN: concurrent identical operation IDs return one accepted result and one replay with exactly one durable effect.");
 console.log("GREEN: real isolated replica-set transaction persisted two revisions, refused duplicate effect, and recovered replay using fresh adapter.");
}finally{await mongoose.disconnect();}
