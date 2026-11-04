import assert from "node:assert/strict";
import mongoose from "mongoose";
import {MOVIE_MENTOR_PROJECT_OWNERSHIP_COLLECTION} from "../ai/MovieMentorProjectOwnershipRegistry.js";

// Isolated physical negative control: test direct-driver mutation, not a
// supported production ownership API. Never use production credentials.
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(uri&&/127\.0\.0\.1|localhost/.test(uri),"Isolated localhost Mongo replica set required.");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
try{
 const ownership=mongoose.connection.db.collection(MOVIE_MENTOR_PROJECT_OWNERSHIP_COLLECTION);
 const projectId="isolated-direct-driver-ownership-proof";
 await ownership.insertOne({domain:"iband.movie-mentor.project-ownership",schema:1,projectId,ownerPrincipalId:"owner-a",ownershipRevision:1,ownershipReference:"ref-a",establishmentAuthorityId:"mint-a",establishmentSource:"isolated-court",status:"active",establishedAt:new Date()});
 const changed=await ownership.updateOne({projectId,ownerPrincipalId:"owner-a"},{$set:{ownerPrincipalId:"owner-b",ownershipRevision:2,status:"revoked"}});
 assert.equal(changed.modifiedCount,1,"Direct MongoDB driver must demonstrate physical ability to bypass Mongoose schema immutability.");
 const record=await ownership.findOne({projectId});
 assert.equal(record.ownerPrincipalId,"owner-b");
 assert.equal(record.ownershipRevision,2);
 assert.equal(record.status,"revoked");
 console.log("GREEN NEGATIVE CONTROL: direct MongoDB driver can mutate ownership despite Mongoose immutable fields.");
 console.log("LIMITATION: this is an isolated adversarial database operation, not a supported production transfer or revocation API.");
}finally{await mongoose.disconnect();}
