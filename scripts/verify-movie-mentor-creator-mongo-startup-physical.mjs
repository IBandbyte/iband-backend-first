import assert from "node:assert/strict";
import mongoose from "mongoose";
import {prepareMovieMentorCreatorMongoConnection} from "../ai/MovieMentorCreatorMongoStartupPreparation.js";
import {createMovieMentorCreatorStateAtomicCompositionFromMongoose} from "../ai/MovieMentorCreatorStateAtomicComposition.js";
import {assertMovieMentorCreatorGatewayAtomicMountReadiness} from "../ai/MovieMentorCreatorGatewayAtomicMountGate.js";

// Disposable localhost Mongo replica set only. This court writes test indexes
// to its isolated database; never targets production.
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost)(?::|\/)/.test(uri),"Isolated localhost Mongo URI required");
assert.equal(mongoose.connection.readyState,0,"Start with disconnected canonical singleton.");
try{
 const result=await prepareMovieMentorCreatorMongoConnection({env:{MONGO_URI:uri}});
 assert.equal(result.ready,true,"Fresh-process canonical startup connection must succeed.");
 assert.equal(result.connection,mongoose.connection);
 assert.equal(mongoose.connection.readyState,1);
 const db=mongoose.connection.db;
 const states=db.collection("movie_mentor_creator_state");
 const operations=db.collection("movie_mentor_creator_state_operations");
 await states.createIndex({projectId:1},{unique:true,partialFilterExpression:{projectId:{$type:"string"}}});
 await operations.createIndex({projectId:1,principalId:1,operationId:1},{unique:true});
 const composition=createMovieMentorCreatorStateAtomicCompositionFromMongoose(mongoose.connection);
 const verified=await assertMovieMentorCreatorGatewayAtomicMountReadiness({atomicCreatorStateReadiness:composition.atomicCreatorStateReadiness});
 assert.equal(typeof verified.atomicAcceptCreatorStateOperation,"function");
 const repeat=await prepareMovieMentorCreatorMongoConnection({env:{}});
 assert.equal(repeat.ready,true);
 assert.equal(repeat.connection,mongoose.connection);
 // Recovery court: deliberately close only the disposable test connection,
 // then prove the same startup helper can re-establish canonical readiness.
 await mongoose.disconnect();
 assert.equal(mongoose.connection.readyState,0,"Isolated disconnect must settle before recovery.");
 const recovered=await prepareMovieMentorCreatorMongoConnection({env:{MONGO_URI:uri}});
 assert.equal(recovered.ready,true,"Canonical startup must reconnect after isolated disconnect.");
 assert.equal(recovered.connection,mongoose.connection);
 const recoveredComposition=createMovieMentorCreatorStateAtomicCompositionFromMongoose(mongoose.connection);
 const recoveredGate=await assertMovieMentorCreatorGatewayAtomicMountReadiness({atomicCreatorStateReadiness:recoveredComposition.atomicCreatorStateReadiness});
 assert.equal(typeof recoveredGate.atomicAcceptCreatorStateOperation,"function","Recovered connection must retain physical atomic readiness.");
 console.log("GREEN: fresh canonical startup, physical indexes, atomic readiness, singleton reuse and isolated disconnect/reconnect recovery.");
}finally{
 await mongoose.disconnect();
}
