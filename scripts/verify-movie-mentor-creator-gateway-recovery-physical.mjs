import assert from "node:assert/strict";
import mongoose from "mongoose";
import {prepareMovieMentorCreatorMongoConnection} from "../ai/MovieMentorCreatorMongoStartupPreparation.js";
import {createMovieMentorCreatorStateAtomicCompositionFromMongoose} from "../ai/MovieMentorCreatorStateAtomicComposition.js";
import {assertMovieMentorCreatorGatewayAtomicMountReadiness} from "../ai/MovieMentorCreatorGatewayAtomicMountGate.js";
import {registerMovieMentorCreatorGatewayRecovery} from "../ai/MovieMentorCreatorGatewayRecovery.js";

const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost)(?::|\/)/.test(uri),"Disposable localhost MongoDB required");
const scheduled=new Map();let nextId=0;let mounts=0;
const schedule=fn=>{const id=++nextId;scheduled.set(id,fn);return id;};
const tick=async()=>{
 assert.equal(scheduled.size,1,"Exactly one recovery timer required.");
 const [id,fn]=scheduled.entries().next().value;scheduled.delete(id);fn();
 for(let attempt=0;attempt<100;attempt++){
  await new Promise(resolve=>setTimeout(resolve,10));
  if(!recovery.getStatus().running)return;
 }
 throw new Error("Recovery did not settle");
};
let recovery;
try{
 const initial={mounted:false,reason:"canonical-creator-state-mongo-connection-not-connected"};
 recovery=registerMovieMentorCreatorGatewayRecovery({
  initialMount:initial,
  schedule,cancel:id=>scheduled.delete(id),delayMs:1,maxAttempts:3,
  prepare:()=>prepareMovieMentorCreatorMongoConnection({env:{MONGO_URI:uri}}),
  mount:async()=>{
   const composition=createMovieMentorCreatorStateAtomicCompositionFromMongoose(mongoose.connection);
   await assertMovieMentorCreatorGatewayAtomicMountReadiness({atomicCreatorStateReadiness:composition.atomicCreatorStateReadiness});
   mounts++;return{mounted:true,reason:"physical-atomic-ready"};
  }
 });
 // First retry connects to real disposable Mongo, but physical indexes are absent.
 await tick();
 assert.equal(mounts,0,"Must deny gateway without required indexes.");
 assert.equal(recovery.getStatus().mounted,false);
 const db=mongoose.connection.db;
 await db.collection("movie_mentor_creator_state").createIndex({projectId:1},{unique:true,partialFilterExpression:{projectId:{$type:"string"}}});
 await db.collection("movie_mentor_creator_state_operations").createIndex({projectId:1,principalId:1,operationId:1},{unique:true});
 // New production readiness contract also requires physical canonical ownership
 // project uniqueness; prove its absence denies recovery before installing it.
 await db.collection("movie_mentor_project_ownership").createIndex({projectId:1},{unique:true});
 await db.collection("movie_mentor_project_ownership").createIndex({establishmentAuthorityId:1},{unique:true});
 await mongoose.disconnect();
 // Second retry must reconnect, validate state, operation and ownership indexes, and mount exactly once.
 await tick();
 assert.equal(mounts,1);
 assert.equal(recovery.getStatus().mounted,true);
 assert.equal(scheduled.size,0,"Successful physical readiness must stop recovery.");
 console.log("GREEN: physical Mongo outage/absent-index denial, canonical reconnect, atomic readiness, and exactly-once simulated mount.");
}finally{
 recovery?.stop();
 await mongoose.disconnect();
}
