import assert from "node:assert/strict";
import mongoose from "mongoose";
import {listMovieMentorOwnedProjectIdentities} from "../ai/MovieMentorProjectOwnershipRegistry.js";
const uri=process.env.MONGO_URI||"";
assert.match(uri,/^mongodb:\/\/127\.0\.0\.1:27017\/movie_mentor_recovery_ci$/,"Owner-isolation test must use only the isolated CI database.");
await mongoose.connect(uri);
try {
 const collection=mongoose.connection.db.collection("movie_mentor_project_ownership");
 await collection.deleteMany({projectId:{$in:["discovery-a","discovery-b"]}});
 const now=new Date();
 const make=(projectId,ownerPrincipalId)=>({domain:"iband.movie-mentor.project-ownership",schema:1,projectId,ownerPrincipalId,ownershipRevision:1,ownershipReference:"proof-"+projectId,establishmentAuthorityId:"establish-"+projectId,establishmentSource:"native-project-establishment",status:"active",establishedAt:now});
 await collection.insertMany([make("discovery-a","creator-a"),make("discovery-b","creator-b")]);
 const a=await listMovieMentorOwnedProjectIdentities({principalId:"creator-a"});
 const b=await listMovieMentorOwnedProjectIdentities({principalId:"creator-b"});
 assert.deepEqual(a,[{projectId:"discovery-a"}]);
 assert.deepEqual(b,[{projectId:"discovery-b"}]);
 assert.deepEqual(await listMovieMentorOwnedProjectIdentities({principalId:"stranger"}),[]);
 await assert.rejects(()=>listMovieMentorOwnedProjectIdentities({principalId:""}),/principal/i);
 console.log("GREEN: physical MongoDB ownership list is isolated between authenticated creator identities.");
}finally{
 await mongoose.connection.db.collection("movie_mentor_project_ownership").deleteMany({projectId:{$in:["discovery-a","discovery-b"]}});
 await mongoose.disconnect();
}
