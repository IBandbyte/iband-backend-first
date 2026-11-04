import assert from "node:assert/strict";
import {createMovieMentorCreatorStateAtomicCompositionFromMongoose} from "../ai/MovieMentorCreatorStateAtomicComposition.js";

const client={startSession(){}};
const seen=[];
const db={client,collection(name){seen.push(name);return{collectionName:name,indexes:async()=>[]}}};
const connection={readyState:1,getClient(){return client},db};
const composition=createMovieMentorCreatorStateAtomicCompositionFromMongoose(connection);
assert.equal(composition.ready,false);
assert.equal(composition.activated,false);
assert.equal(typeof composition.atomicCreatorStateReadiness,"function");
assert.deepEqual(seen,["movie_mentor_creator_state","movie_mentor_creator_state_operations"]);
assert.equal(Object.isFrozen(composition),true);
assert.throws(()=>createMovieMentorCreatorStateAtomicCompositionFromMongoose({readyState:0,getClient(){return client},db}),e=>e?.code==="MOVIE_MENTOR_CREATOR_STATE_CANONICAL_MONGO_CONNECTION_REQUIRED");
console.log("GREEN: atomic composition consumes canonical Mongoose client/database identity without activation.");
