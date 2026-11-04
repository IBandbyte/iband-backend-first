import assert from "node:assert/strict";
import fs from "node:fs";

// Execute the real helper body against an isolated Mongoose test double.
// Never import the production server, connect to MongoDB, or write records.
const source=fs.readFileSync(new URL("../ai/MovieMentorCreatorMongoStartupPreparation.js",import.meta.url),"utf8");
assert.match(source,/import mongoose from "mongoose"/,"Helper must retain canonical Mongoose import.");
const connection={readyState:0};
let calls=0;
let fail=false;
const mongoose={
 connection,
 async connect(uri,options){
  calls++;
  assert.equal(uri,"mongodb://example.invalid/movie-mentor-isolated-test");
  assert.equal(options.autoIndex,false);
  if(fail)throw Object.assign(new Error("unavailable"),{code:"TEST_CONNECTION_UNAVAILABLE"});
  connection.readyState=1;
  return mongoose;
 }
};
const rewritten=source.replace('import mongoose from "mongoose";','const mongoose=globalThis.__movieMentorStartupTestMongoose;');
globalThis.__movieMentorStartupTestMongoose=mongoose;
let prepare;
try{
 const mod=await import("data:text/javascript;base64,"+Buffer.from(rewritten).toString("base64"));
 prepare=mod.prepareMovieMentorCreatorMongoConnection;
}finally{delete globalThis.__movieMentorStartupTestMongoose;}
assert.equal(typeof prepare,"function");
const env={MONGO_URI:"mongodb://example.invalid/movie-mentor-isolated-test"};
connection.readyState=1;
let result=await prepare({env:{}});
assert.equal(result.ready,true);
assert.equal(result.connection,connection);
assert.equal(calls,0,"Connected singleton must not reconnect.");
connection.readyState=0;
result=await prepare({env:{}});
assert.equal(result.ready,false);
assert.equal(calls,0,"Missing URI must not connect.");
for(const state of [2,3]){
 connection.readyState=state;
 result=await prepare({env});
 assert.equal(result.ready,false);
 assert.equal(calls,0,"In-flight/disconnecting singleton must not create a competing connection.");
}
connection.readyState=0;
result=await prepare({env});
assert.equal(result.ready,true);
assert.equal(result.connection,connection);
assert.equal(calls,1);
connection.readyState=0;fail=true;
result=await prepare({env});
assert.equal(result.ready,false);
assert.equal(result.reason,"canonical-creator-state-mongo-connection-unavailable");
assert.equal(calls,2);
console.log("GREEN: canonical Mongo helper reuses connected singleton, denies missing/in-flight, connects once, and fails closed on error.");
