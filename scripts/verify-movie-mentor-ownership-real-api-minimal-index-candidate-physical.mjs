import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorProjectOwnershipAuthority} from "../ai/MovieMentorProjectOwnershipRegistry.js";
assert.equal(process.env.MONGO_URI,"mongodb://127.0.0.1:27017/iband_ownership_real_api_candidate_court");
mongoose.set("autoIndex",false);
await mongoose.connect(process.env.MONGO_URI);
try {
 const authority=createMovieMentorProjectOwnershipAuthority();
 const owner={authenticated:true,principalId:"owner-A"},intruder={authenticated:true,principalId:"owner-B"};
 const projectId="real-api-candidate-project",authorityId="real-api-authority-A";
 const before=await authority.authorizeProject({principal:owner,projectId});
 assert.equal(before.authorized,false);
 const model=mongoose.models.MovieMentorProjectOwnership;
 assert.ok(model);
 const projectPath=model.schema.path("projectId");
 assert.equal(Boolean(projectPath.options.index),true);
 delete projectPath.options.index;
 projectPath._index=null;
 const definitions=model.schema.indexes().filter(([keys])=>keys.projectId===1&&Object.keys(keys).length===1);
 assert.equal(definitions.length,1);
 assert.equal(definitions[0][1].unique,true);
 const proof=(principal,pid,id)=>({verified:true,type:"native-project-creation",authorityId:id,projectId:pid,principalId:principal.principalId});
 const first=await authority.establishNativeOwnership({principal:owner,projectId,establishmentAuthority:proof(owner,projectId,authorityId)});
 assert.equal(first.status,"established");
 assert.equal(first.ownership.ownerPrincipalId,"owner-A");
 const repeat=await authority.establishNativeOwnership({principal:owner,projectId,establishmentAuthority:proof(owner,projectId,authorityId)});
 assert.equal(repeat.status,"already-established");
 const permitted=await authority.authorizeProject({principal:owner,projectId});
 assert.equal(permitted.authorized,true);
 const forbidden=await authority.authorizeProject({principal:intruder,projectId});
 assert.equal(forbidden.authorized,false);
 let hijack;try{await authority.establishNativeOwnership({principal:intruder,projectId,establishmentAuthority:proof(intruder,projectId,"real-api-authority-B")});}catch(e){hijack=e;}
 assert.equal(hijack?.code,"MOVIE_MENTOR_PROJECT_OWNERSHIP_HIJACK_REJECTED");
 let replay;try{await authority.establishNativeOwnership({principal:owner,projectId:"other-project",establishmentAuthority:proof(owner,"other-project",authorityId)});}catch(e){replay=e;}
 assert.equal(replay?.code,"MOVIE_MENTOR_PROJECT_OWNERSHIP_AUTHORITY_REPLAY_REJECTED");
 const indexes=await mongoose.connection.collection("movie_mentor_project_ownership").indexes();
 assert.ok(indexes.some(i=>i.key?.projectId===1&&i.unique===true));
 assert.ok(indexes.some(i=>i.key?.establishmentAuthorityId===1&&i.unique===true));
 assert.equal(await mongoose.connection.collection("movie_mentor_project_ownership").countDocuments({}),1);
 assert.equal(authority.getStatus().ownershipTransfer,false);
 console.log(JSON.stringify({court:"ownership-real-api-minimal-index-candidate-physical",classification:"audit-only in-memory Mongoose schema correction before real production authority API use; NOT production source change or migration",first:first.status,repeat:repeat.status,ownerAuthorized:permitted.authorized,intruderAuthorized:forbidden.authorized,hijack:hijack.code,authorityReplay:replay.code,rows:1,physicalUniqueIndexes:true,ownershipTransfer:false}));
 console.log("PASS: real production ownership API with isolated in-memory index correction enforces create-once and owner-only authorization");
}finally{await mongoose.disconnect();}
