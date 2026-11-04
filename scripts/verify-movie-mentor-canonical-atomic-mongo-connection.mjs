import assert from "node:assert/strict";
import {createMovieMentorCanonicalAtomicMongoConnection} from "../ai/MovieMentorCreatorStateCanonicalMongoConnection.js";

// RED-first: no network, database creation, connection or writes.
const client={startSession(){}};
const db={client,collection(name){return{collectionName:name}}};
const mongooseConnection={readyState:1,getClient(){return client},db};
const proven=createMovieMentorCanonicalAtomicMongoConnection(mongooseConnection);
assert.equal(proven.client,client);
assert.equal(proven.db,db);
assert.equal(Object.isFrozen(proven),true);
for(const invalid of [
 null,
 {readyState:0,getClient(){return client},db},
 {readyState:1,getClient(){return null},db},
 {readyState:1,getClient(){return client},db:{...db,client:{}}},
 {readyState:1,getClient(){return client},db:{client}},
]){
 assert.throws(()=>createMovieMentorCanonicalAtomicMongoConnection(invalid),error=>error?.code==="MOVIE_MENTOR_CREATOR_STATE_CANONICAL_MONGO_CONNECTION_REQUIRED");
}
console.log("GREEN: canonical Mongoose Mongo client and database identity proven; disconnected and mismatched authorities denied.");
