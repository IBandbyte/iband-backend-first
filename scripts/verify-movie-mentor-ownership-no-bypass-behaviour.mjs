import assert from "node:assert/strict";
import {createMongoCreatorStateAtomicAccept} from "../ai/MovieMentorCreatorStateMongoOperationAdapter.js";
// A missing ownership participant must fail before any Mongo session or state
// mutation. This test is deliberately dependency-free and does not access DB.
let sessions=0,writes=0;
const client={startSession(){sessions++;throw Error("Unexpected session");}};
const states={findOne(){},replaceOne(){writes++;},indexes(){}};
const operations={findOne(){},insertOne(){writes++;},indexes(){}};
assert.throws(()=>createMongoCreatorStateAtomicAccept({client,states,operations}),error=>error.code==="MOVIE_MENTOR_CREATOR_STATE_OWNERSHIP_STORAGE_REQUIRED");
assert.equal(sessions,0);
assert.equal(writes,0);
assert.throws(()=>createMongoCreatorStateAtomicAccept({client,states,operations,ownerships:{collectionName:"wrong",updateOne(){writes++;}}}),error=>error.code==="MOVIE_MENTOR_CREATOR_STATE_OWNERSHIP_STORAGE_REQUIRED");
assert.equal(sessions,0);
assert.equal(writes,0);
console.log("GREEN: missing or noncanonical ownership storage rejected before session and writes.");
